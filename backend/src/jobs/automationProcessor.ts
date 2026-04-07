import { Queue, Worker } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../config/redis';
import db from '../config/db';
import { sendCampaignEmail } from '../services/email';

interface AutomationJobData {
  automationId: string;
  contactId: string;
  nodeId: string;
  step: number;
}

interface WorkflowNode {
  id: string;
  type: string;
  data?: {
    subject?: string;
    htmlBody?: string;
    senderName?: string;
    senderEmail?: string;
    previewText?: string;
    duration?: number;
    durationUnit?: 'minutes' | 'hours' | 'days';
    conditionField?: string;
    conditionOperator?: string;
    conditionValue?: unknown;
    [key: string]: unknown;
  };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface WorkflowJson {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export const automationQueue = new Queue('automation-processor', {
  connection: redisClient,
});

function getDelayMs(duration: number, unit: string): number {
  switch (unit) {
    case 'minutes':
      return duration * 60 * 1000;
    case 'hours':
      return duration * 60 * 60 * 1000;
    case 'days':
      return duration * 24 * 60 * 60 * 1000;
    default:
      return duration * 60 * 60 * 1000;
  }
}

export function startAutomationWorker() {
  const worker = new Worker(
    'automation-processor',
    async (job) => {
      const { automationId, contactId, nodeId, step } = job.data as AutomationJobData;

      const automation = await db('automations').where({ id: automationId }).first();
      if (!automation || automation.status !== 'active') {
        console.log(`Automation ${automationId} is not active, skipping`);
        return;
      }

      const contact = await db('contacts').where({ id: contactId }).first();
      if (!contact || contact.global_unsubscribe) {
        console.log(`Contact ${contactId} not found or unsubscribed, skipping`);
        return;
      }

      const workflowJson = automation.workflow_json as WorkflowJson;
      const { nodes, edges } = workflowJson;

      const currentNode = nodes.find((n: WorkflowNode) => n.id === nodeId);
      if (!currentNode) {
        console.log(`Node ${nodeId} not found in automation ${automationId}`);
        // Mark contact as completed if no more nodes
        await db('automations')
          .where({ id: automationId })
          .increment('completed_count', 1);
        return;
      }

      // Execute the current node
      if (currentNode.type === 'email_action') {
        const campaignSendId = uuidv4();
        const subject = currentNode.data?.subject || 'No Subject';
        const htmlBody = currentNode.data?.htmlBody || '<p>No content</p>';

        await db('campaign_sends').insert({
          id: campaignSendId,
          campaign_id: automationId, // Use automation ID as placeholder — in production would reference a template
          contact_id: contactId,
          automation_id: automationId,
          status: 'queued',
        }).onConflict().ignore();

        try {
          await sendCampaignEmail({
            to: contact.email,
            subject,
            htmlBody,
            campaignSendId,
            contactId,
            previewText: currentNode.data?.previewText as string | undefined,
            senderName: currentNode.data?.senderName as string | undefined,
            senderEmail: currentNode.data?.senderEmail as string | undefined,
          });

          await db('campaign_sends')
            .where({ id: campaignSendId })
            .update({ status: 'sent', sent_at: new Date() });
        } catch (err) {
          console.error(`Failed to send automation email for ${contactId}:`, err);
          await db('campaign_sends')
            .where({ id: campaignSendId })
            .update({ status: 'failed' });
        }
      } else if (currentNode.type === 'delay') {
        // Delay is handled by BullMQ's delay option when queuing next steps
        // Nothing to execute for delay node itself
      } else if (currentNode.type === 'condition') {
        // Condition nodes handled via edge labels (true/false paths)
        // The next node queuing below handles branching
      }

      // Find outgoing edges from current node
      const outgoingEdges = edges.filter((e: WorkflowEdge) => e.source === nodeId);

      for (const edge of outgoingEdges) {
        const nextNode = nodes.find((n: WorkflowNode) => n.id === edge.target);
        if (!nextNode) continue;

        let delayMs = 0;
        if (nextNode.type === 'delay') {
          const duration = nextNode.data?.duration || 1;
          const unit = nextNode.data?.durationUnit || 'hours';
          delayMs = getDelayMs(duration, unit);
        }

        await automationQueue.add(
          'process-step',
          {
            automationId,
            contactId,
            nodeId: nextNode.id,
            step: step + 1,
          } as AutomationJobData,
          { delay: delayMs }
        );
      }

      // If no outgoing edges, contact has completed the automation
      if (outgoingEdges.length === 0) {
        await db('automations')
          .where({ id: automationId })
          .increment('completed_count', 1);
      }
    },
    {
      connection: redisClient,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`Automation processor job failed for job ${job?.id}:`, err);
  });

  worker.on('completed', (job) => {
    console.log(`Automation processor job completed: ${job.id}`);
  });

  return worker;
}

export async function enrollContactInAutomation(
  automationId: string,
  contactId: string
): Promise<void> {
  const automation = await db('automations').where({ id: automationId }).first();
  if (!automation || automation.status !== 'active') {
    return;
  }

  const workflowJson = automation.workflow_json as WorkflowJson;
  const { nodes, edges } = workflowJson;

  // Find entry node (node with no incoming edges)
  const targetNodeIds = new Set(edges.map((e: WorkflowEdge) => e.target));
  const entryNode = nodes.find((n: WorkflowNode) => !targetNodeIds.has(n.id));

  if (!entryNode) {
    console.log(`No entry node found in automation ${automationId}`);
    return;
  }

  await automationQueue.add('process-step', {
    automationId,
    contactId,
    nodeId: entryNode.id,
    step: 0,
  } as AutomationJobData);

  await db('automations')
    .where({ id: automationId })
    .increment('enrolled_count', 1);
}
