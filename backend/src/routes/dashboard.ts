import { Router, Request, Response } from 'express';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/kpis', async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(String(req.query.days || '30'));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [{ count: totalContacts }] = await db('contacts').count('id as count');
    const [{ count: activeAutomations }] = await db('automations')
      .where({ status: 'active' })
      .count('id as count');
    const [{ count: campaignsSent }] = await db('campaigns')
      .where({ status: 'sent' })
      .where('sent_at', '>=', since)
      .count('id as count');

    // Aggregate rates across sent campaigns
    const campaigns = await db('campaigns')
      .where({ status: 'sent' })
      .where('sent_at', '>=', since)
      .select('id');

    const campaignIds = campaigns.map((c: { id: string }) => c.id);

    let avgOpenRate = 0;
    let avgClickRate = 0;
    let unsubscribeRate = 0;

    if (campaignIds.length > 0) {
      const [sendStats] = await db('campaign_sends')
        .whereIn('campaign_id', campaignIds)
        .select(
          db.raw('COUNT(*) as total_sends'),
          db.raw("COUNT(*) FILTER (WHERE status = 'sent') as delivered")
        );

      const [engagementStats] = await db('engagement_events')
        .join('campaign_sends', 'engagement_events.campaign_send_id', 'campaign_sends.id')
        .whereIn('campaign_sends.campaign_id', campaignIds)
        .select(
          db.raw(
            "COUNT(DISTINCT CASE WHEN engagement_events.type = 'open' THEN engagement_events.contact_id END) as opens_unique"
          ),
          db.raw(
            "COUNT(DISTINCT CASE WHEN engagement_events.type = 'click' THEN engagement_events.contact_id END) as clicks_unique"
          ),
          db.raw("COUNT(*) FILTER (WHERE engagement_events.type = 'unsubscribe') as unsubscribes")
        );

      const delivered = parseInt(String(sendStats?.delivered || 0));
      const opensUnique = parseInt(String(engagementStats?.opens_unique || 0));
      const clicksUnique = parseInt(String(engagementStats?.clicks_unique || 0));
      const unsubs = parseInt(String(engagementStats?.unsubscribes || 0));

      if (delivered > 0) {
        avgOpenRate = Math.round((opensUnique / delivered) * 10000) / 100;
        avgClickRate = Math.round((clicksUnique / delivered) * 10000) / 100;
        unsubscribeRate = Math.round((unsubs / delivered) * 10000) / 100;
      }
    }

    res.json({
      success: true,
      data: {
        totalContacts: parseInt(String(totalContacts)),
        activeAutomations: parseInt(String(activeAutomations)),
        campaignsSent: parseInt(String(campaignsSent)),
        avgOpenRate,
        avgClickRate,
        unsubscribeRate,
      },
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/recent-campaigns', async (req: Request, res: Response): Promise<void> => {
  try {
    const campaigns = await db('campaigns')
      .whereIn('status', ['sent', 'scheduled'])
      .leftJoin('segments', 'campaigns.segment_id', 'segments.id')
      .select('campaigns.*', 'segments.name as segment_name')
      .orderBy('campaigns.updated_at', 'desc')
      .limit(5);

    const items = await Promise.all(
      campaigns.map(async (campaign) => {
        const [sends] = await db('campaign_sends')
          .where({ campaign_id: campaign.id })
          .select(db.raw("COUNT(*) FILTER (WHERE status = 'sent') as delivered"));

        const [engagement] = await db('engagement_events')
          .join('campaign_sends', 'engagement_events.campaign_send_id', 'campaign_sends.id')
          .where({ 'campaign_sends.campaign_id': campaign.id })
          .select(
            db.raw(
              "COUNT(DISTINCT CASE WHEN engagement_events.type = 'open' THEN engagement_events.contact_id END) as opens_unique"
            ),
            db.raw(
              "COUNT(DISTINCT CASE WHEN engagement_events.type = 'click' THEN engagement_events.contact_id END) as clicks_unique"
            )
          );

        const delivered = parseInt(String(sends?.delivered || 0));
        const opensUnique = parseInt(String(engagement?.opens_unique || 0));
        const clicksUnique = parseInt(String(engagement?.clicks_unique || 0));

        return {
          ...campaign,
          open_rate: delivered > 0 ? Math.round((opensUnique / delivered) * 10000) / 100 : 0,
          click_rate: delivered > 0 ? Math.round((clicksUnique / delivered) * 10000) / 100 : 0,
        };
      })
    );

    res.json({ success: true, data: items });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/recent-automations', async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await db('automations')
      .where({ status: 'active' })
      .orderBy('updated_at', 'desc')
      .limit(5);

    res.json({ success: true, data: items });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/performance-chart', async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(String(req.query.days || '30'));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await db.raw(
      `
      SELECT
        date_trunc('day', ee.occurred_at) as date,
        COUNT(DISTINCT CASE WHEN ee.type = 'open' THEN ee.contact_id END)::float /
          NULLIF(COUNT(DISTINCT cs.contact_id), 0) * 100 as open_rate,
        COUNT(DISTINCT CASE WHEN ee.type = 'click' THEN ee.contact_id END)::float /
          NULLIF(COUNT(DISTINCT cs.contact_id), 0) * 100 as click_rate
      FROM engagement_events ee
      JOIN campaign_sends cs ON ee.campaign_send_id = cs.id
      JOIN campaigns c ON cs.campaign_id = c.id
      WHERE c.status = 'sent'
        AND ee.occurred_at >= ?
      GROUP BY date_trunc('day', ee.occurred_at)
      ORDER BY date ASC
    `,
      [since.toISOString()]
    );

    const chartData = result.rows.map(
      (r: { date: Date; open_rate: string; click_rate: string }) => ({
        date: r.date.toISOString().split('T')[0],
        openRate: Math.round(parseFloat(String(r.open_rate || '0')) * 100) / 100,
        clickRate: Math.round(parseFloat(String(r.click_rate || '0')) * 100) / 100,
      })
    );

    res.json({ success: true, data: chartData });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
