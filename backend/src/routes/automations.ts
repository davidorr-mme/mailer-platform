import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

interface WorkflowNode {
  id: string;
  type: string;
  data?: {
    subject?: string;
    duration?: number;
    durationUnit?: string;
    [key: string]: unknown;
  };
}

interface WorkflowEdge {
  source: string;
  target: string;
  id: string;
}

interface WorkflowJson {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

function validateWorkflow(
  entryCriteria: Record<string, unknown>,
  workflowJson: WorkflowJson
): Array<{ nodeId: string; message: string }> {
  const errors: Array<{ nodeId: string; message: string }> = [];

  // Check entry criteria has a trigger type
  if (!entryCriteria || !entryCriteria.trigger_type) {
    errors.push({ nodeId: 'entry', message: 'Entry criteria must have a trigger type set' });
  }

  const { nodes, edges } = workflowJson;

  if (!nodes || nodes.length === 0) {
    return errors;
  }

  // Check each node is configured
  for (const node of nodes) {
    if (node.type === 'email_action') {
      if (!node.data?.subject) {
        errors.push({ nodeId: node.id, message: 'Email node must have a subject line' });
      }
    } else if (node.type === 'delay') {
      if (!node.data?.duration) {
        errors.push({ nodeId: node.id, message: 'Delay node must have a duration set' });
      }
      if (!node.data?.durationUnit) {
        errors.push({ nodeId: node.id, message: 'Delay node must have a duration unit set' });
      }
    }
  }

  // Check for orphaned nodes (nodes with no edges connecting them)
  if (edges && edges.length > 0) {
    const connectedNodeIds = new Set<string>();
    for (const edge of edges) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }
    // Allow first node to have no incoming edge, but all others should be connected
    for (const node of nodes) {
      const hasIncoming = edges.some((e) => e.target === node.id);
      const hasOutgoing = edges.some((e) => e.source === node.id);
      if (!hasIncoming && !hasOutgoing && nodes.length > 1) {
        errors.push({ nodeId: node.id, message: 'Node is not connected to any other nodes' });
      }
    }
  }

  return errors;
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(String(req.query.page || '1'));
    const pageSize = parseInt(String(req.query.pageSize || '25'));
    const offset = (page - 1) * pageSize;

    const [{ count }] = await db('automations').count('id as count');
    const total = parseInt(String(count));
    const items = await db('automations')
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    res.json({ success: true, data: { items, total, page, pageSize } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, entryCriteria, exitCriteria, targetSegmentId, workflowJson } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }

    const [automation] = await db('automations')
      .insert({
        id: uuidv4(),
        name,
        status: 'draft',
        entry_criteria: JSON.stringify(entryCriteria || {}),
        exit_criteria: JSON.stringify(exitCriteria || []),
        target_segment_id: targetSegmentId || null,
        workflow_json: JSON.stringify(workflowJson || { nodes: [], edges: [] }),
      })
      .returning('*');

    res.status(201).json({ success: true, data: automation });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const automation = await db('automations').where({ id }).first();
    if (!automation) {
      res.status(404).json({ success: false, error: 'Automation not found' });
      return;
    }
    res.json({ success: true, data: automation });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const automation = await db('automations').where({ id }).first();
    if (!automation) {
      res.status(404).json({ success: false, error: 'Automation not found' });
      return;
    }

    if (automation.status === 'archived') {
      res.status(400).json({ success: false, error: 'Cannot update archived automation' });
      return;
    }

    const updateData: Record<string, unknown> = { updated_at: db.fn.now() };
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.entryCriteria !== undefined)
      updateData.entry_criteria = JSON.stringify(req.body.entryCriteria);
    if (req.body.exitCriteria !== undefined)
      updateData.exit_criteria = JSON.stringify(req.body.exitCriteria);
    if (req.body.targetSegmentId !== undefined)
      updateData.target_segment_id = req.body.targetSegmentId;
    if (req.body.workflowJson !== undefined)
      updateData.workflow_json = JSON.stringify(req.body.workflowJson);
    if (req.body.status !== undefined) updateData.status = req.body.status;

    const [updated] = await db('automations').where({ id }).update(updateData).returning('*');
    res.json({ success: true, data: updated });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const automation = await db('automations').where({ id }).first();
    if (!automation) {
      res.status(404).json({ success: false, error: 'Automation not found' });
      return;
    }

    await db('automations').where({ id }).del();
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/activate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const automation = await db('automations').where({ id }).first();
    if (!automation) {
      res.status(404).json({ success: false, error: 'Automation not found' });
      return;
    }

    const errors = validateWorkflow(
      automation.entry_criteria as Record<string, unknown>,
      automation.workflow_json as WorkflowJson
    );

    if (errors.length > 0) {
      res.status(400).json({ success: false, errors });
      return;
    }

    const [updated] = await db('automations')
      .where({ id })
      .update({ status: 'active', updated_at: db.fn.now() })
      .returning('*');

    res.json({ success: true, data: updated });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/pause', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const automation = await db('automations').where({ id }).first();
    if (!automation) {
      res.status(404).json({ success: false, error: 'Automation not found' });
      return;
    }

    const [updated] = await db('automations')
      .where({ id })
      .update({ status: 'paused', updated_at: db.fn.now() })
      .returning('*');

    res.json({ success: true, data: updated });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/duplicate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const original = await db('automations').where({ id }).first();
    if (!original) {
      res.status(404).json({ success: false, error: 'Automation not found' });
      return;
    }

    const [copy] = await db('automations')
      .insert({
        id: uuidv4(),
        name: `Copy of ${original.name}`,
        status: 'draft',
        entry_criteria: JSON.stringify(original.entry_criteria),
        exit_criteria: JSON.stringify(original.exit_criteria),
        target_segment_id: original.target_segment_id,
        workflow_json: JSON.stringify(original.workflow_json),
        enrolled_count: 0,
        completed_count: 0,
      })
      .returning('*');

    res.status(201).json({ success: true, data: copy });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
