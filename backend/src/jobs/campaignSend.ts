import { Queue, Worker } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { getBullMQConnection } from '../config/redis';
import db from '../config/db';
import { sendCampaignEmail } from '../services/email';
import { evaluateSegment } from '../services/segmentEvaluator';

export const campaignSendQueue = new Queue('campaign-send', {
  connection: getBullMQConnection(),
});

export function startCampaignSendWorker() {
  const worker = new Worker(
    'campaign-send',
    async (job) => {
      const { campaignId } = job.data as { campaignId: string };
      console.log(`Processing campaign send job: ${campaignId}`);

      // 1. Fetch campaign
      const campaign = await db('campaigns').where({ id: campaignId }).first();
      if (!campaign) {
        console.error(`Campaign ${campaignId} not found`);
        await db('campaigns')
          .where({ id: campaignId })
          .update({ status: 'cancelled', updated_at: db.fn.now() });
        return;
      }

      // 2. Check for segment
      if (!campaign.segment_id) {
        console.error(`Campaign ${campaignId} has no segment assigned`);
        await db('campaigns')
          .where({ id: campaignId })
          .update({ status: 'cancelled', updated_at: db.fn.now() });
        return;
      }

      const segment = await db('segments').where({ id: campaign.segment_id }).first();
      if (!segment) {
        console.error(`Segment ${campaign.segment_id} not found for campaign ${campaignId}`);
        await db('campaigns')
          .where({ id: campaignId })
          .update({ status: 'cancelled', updated_at: db.fn.now() });
        return;
      }

      // 3. Evaluate segment to get contact IDs (exclude unsubscribed)
      let contactIds: string[];
      try {
        contactIds = await evaluateSegment(segment.logic, db);
      } catch (err) {
        console.error(`Failed to evaluate segment for campaign ${campaignId}:`, err);
        await db('campaigns')
          .where({ id: campaignId })
          .update({ status: 'cancelled', updated_at: db.fn.now() });
        return;
      }

      console.log(`Sending campaign ${campaignId} to ${contactIds.length} contacts`);

      // 4. Send to each contact
      for (const contactId of contactIds) {
        const contact = await db('contacts').where({ id: contactId }).first();
        if (!contact || contact.global_unsubscribe) {
          continue;
        }

        // Insert campaign_send record
        const sendId = uuidv4();
        await db('campaign_sends').insert({
          id: sendId,
          campaign_id: campaignId,
          contact_id: contactId,
          status: 'queued',
        });

        try {
          await sendCampaignEmail({
            to: contact.email,
            subject: campaign.subject_line,
            htmlBody: campaign.template_html || '<p>No content</p>',
            campaignSendId: sendId,
            contactId,
            previewText: campaign.preview_text,
            senderName: campaign.sender_name,
            senderEmail: campaign.sender_email,
          });

          await db('campaign_sends')
            .where({ id: sendId })
            .update({ status: 'sent', sent_at: new Date() });
        } catch (emailErr) {
          console.error(`Failed to send email to ${contact.email}:`, emailErr);
          await db('campaign_sends')
            .where({ id: sendId })
            .update({ status: 'failed' });
        }
      }

      // 5. Update campaign status
      await db('campaigns')
        .where({ id: campaignId })
        .update({ status: 'sent', sent_at: new Date(), updated_at: db.fn.now() });

      console.log(`Campaign ${campaignId} send complete`);
    },
    {
      connection: getBullMQConnection(),
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`Campaign send job failed for job ${job?.id}:`, err);
  });

  worker.on('completed', (job) => {
    console.log(`Campaign send job completed: ${job.id}`);
  });

  return worker;
}
