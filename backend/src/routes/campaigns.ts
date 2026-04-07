import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { campaignSendQueue } from '../jobs/campaignSend';

const router = Router();
router.use(authMiddleware);

async function getCampaignWithStats(campaignId: string) {
  const campaign = await db('campaigns')
    .where({ 'campaigns.id': campaignId })
    .leftJoin('segments', 'campaigns.segment_id', 'segments.id')
    .select('campaigns.*', 'segments.name as segment_name')
    .first();

  if (!campaign) return null;

  const [stats] = await db('campaign_sends')
    .where({ campaign_id: campaignId })
    .select(
      db.raw('COUNT(*) as recipients'),
      db.raw("COUNT(*) FILTER (WHERE status = 'sent') as delivered"),
      db.raw("COUNT(*) FILTER (WHERE status = 'bounced') as bounces")
    );

  const [engagementStats] = await db('engagement_events')
    .join('campaign_sends', 'engagement_events.campaign_send_id', 'campaign_sends.id')
    .where({ 'campaign_sends.campaign_id': campaignId })
    .select(
      db.raw("COUNT(DISTINCT CASE WHEN engagement_events.type = 'open' THEN engagement_events.contact_id END) as opens_unique"),
      db.raw("COUNT(DISTINCT CASE WHEN engagement_events.type = 'click' THEN engagement_events.contact_id END) as clicks_unique")
    );

  const recipients = parseInt(String(stats?.recipients || 0));
  const delivered = parseInt(String(stats?.delivered || 0));
  const opensUnique = parseInt(String(engagementStats?.opens_unique || 0));
  const clicksUnique = parseInt(String(engagementStats?.clicks_unique || 0));

  const openRate = delivered > 0 ? (opensUnique / delivered) * 100 : 0;
  const clickRate = delivered > 0 ? (clicksUnique / delivered) * 100 : 0;

  return {
    ...campaign,
    recipients,
    delivered,
    opens_unique: opensUnique,
    clicks_unique: clicksUnique,
    open_rate: Math.round(openRate * 100) / 100,
    click_rate: Math.round(clickRate * 100) / 100,
  };
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(String(req.query.page || '1'));
    const pageSize = parseInt(String(req.query.pageSize || '25'));
    const statusFilter = String(req.query.status || '');
    const offset = (page - 1) * pageSize;

    let query = db('campaigns').leftJoin('segments', 'campaigns.segment_id', 'segments.id');
    if (statusFilter) {
      query = query.where({ 'campaigns.status': statusFilter });
    }

    const [{ count }] = await query.clone().count('campaigns.id as count');
    const total = parseInt(String(count));

    const campaigns = await query
      .select('campaigns.*', 'segments.name as segment_name')
      .orderBy('campaigns.created_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    // Add stats for each campaign
    const items = await Promise.all(
      campaigns.map(async (c) => {
        const withStats = await getCampaignWithStats(c.id);
        return withStats || c;
      })
    );

    res.json({ success: true, data: { items, total, page, pageSize } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      subjectLine,
      previewText,
      senderName,
      senderEmail,
      segmentId,
      templateJson,
      templateHtml,
    } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }

    const [campaign] = await db('campaigns')
      .insert({
        id: uuidv4(),
        name,
        subject_line: subjectLine || '',
        preview_text: previewText || '',
        sender_name: senderName || '',
        sender_email: senderEmail || '',
        segment_id: segmentId || null,
        template_json: JSON.stringify(templateJson || []),
        template_html: templateHtml || '',
        status: 'draft',
      })
      .returning('*');

    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const campaign = await getCampaignWithStats(id);
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }
    res.json({ success: true, data: campaign });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const campaign = await db('campaigns').where({ id }).first();
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

    if (!['draft', 'scheduled'].includes(campaign.status)) {
      res.status(400).json({
        success: false,
        error: 'Campaign can only be updated when in draft or scheduled status',
      });
      return;
    }

    const updateData: Record<string, unknown> = { updated_at: db.fn.now() };
    const fieldMap: Record<string, string> = {
      name: 'name',
      subjectLine: 'subject_line',
      previewText: 'preview_text',
      senderName: 'sender_name',
      senderEmail: 'sender_email',
      segmentId: 'segment_id',
      templateHtml: 'template_html',
      status: 'status',
    };

    for (const [bodyKey, dbKey] of Object.entries(fieldMap)) {
      if (req.body[bodyKey] !== undefined) {
        updateData[dbKey] = req.body[bodyKey];
      }
    }

    if (req.body.templateJson !== undefined) {
      updateData.template_json = JSON.stringify(req.body.templateJson);
    }

    const [updated] = await db('campaigns').where({ id }).update(updateData).returning('*');
    res.json({ success: true, data: updated });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const campaign = await db('campaigns').where({ id }).first();
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

    if (!['draft', 'cancelled'].includes(campaign.status)) {
      res.status(400).json({
        success: false,
        error: 'Only draft or cancelled campaigns can be deleted',
      });
      return;
    }

    await db('campaign_sends').where({ campaign_id: id }).del();
    await db('campaigns').where({ id }).del();
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/send', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const campaign = await db('campaigns').where({ id }).first();
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

    if (!['draft', 'scheduled'].includes(campaign.status)) {
      res.status(400).json({
        success: false,
        error: 'Campaign can only be sent from draft or scheduled status',
      });
      return;
    }

    await db('campaigns')
      .where({ id })
      .update({ status: 'sending', updated_at: db.fn.now() });

    await campaignSendQueue.add('send-campaign', { campaignId: id });

    res.json({ success: true, data: { queued: true } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/schedule', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { scheduledAt } = req.body;

    if (!scheduledAt) {
      res.status(400).json({ success: false, error: 'scheduledAt is required' });
      return;
    }

    const campaign = await db('campaigns').where({ id }).first();
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

    const [updated] = await db('campaigns')
      .where({ id })
      .update({
        status: 'scheduled',
        scheduled_at: new Date(scheduledAt),
        updated_at: db.fn.now(),
      })
      .returning('*');

    res.json({ success: true, data: updated });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const campaign = await db('campaigns').where({ id }).first();
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

    const [updated] = await db('campaigns')
      .where({ id })
      .update({ status: 'cancelled', updated_at: db.fn.now() })
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
    const original = await db('campaigns').where({ id }).first();
    if (!original) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

    const [copy] = await db('campaigns')
      .insert({
        id: uuidv4(),
        name: `Copy of ${original.name}`,
        subject_line: original.subject_line,
        preview_text: original.preview_text,
        sender_name: original.sender_name,
        sender_email: original.sender_email,
        segment_id: original.segment_id,
        template_json: JSON.stringify(original.template_json),
        template_html: original.template_html,
        status: 'draft',
      })
      .returning('*');

    res.status(201).json({ success: true, data: copy });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
