import { Router, Request, Response } from 'express';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/campaigns', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(String(req.query.page || '1'));
    const pageSize = parseInt(String(req.query.pageSize || '25'));
    const offset = (page - 1) * pageSize;

    const [{ count }] = await db('campaigns')
      .whereIn('status', ['sent', 'sending'])
      .count('id as count');
    const total = parseInt(String(count));

    const campaigns = await db('campaigns')
      .whereIn('campaigns.status', ['sent', 'sending'])
      .leftJoin('segments', 'campaigns.segment_id', 'segments.id')
      .select('campaigns.*', 'segments.name as segment_name')
      .orderBy('campaigns.sent_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    const items = await Promise.all(
      campaigns.map(async (campaign) => {
        const [sends] = await db('campaign_sends')
          .where({ campaign_id: campaign.id })
          .select(
            db.raw('COUNT(*) as recipients'),
            db.raw("COUNT(*) FILTER (WHERE status = 'sent') as delivered"),
            db.raw("COUNT(*) FILTER (WHERE status = 'bounced') as bounces")
          );

        const [engagement] = await db('engagement_events')
          .join('campaign_sends', 'engagement_events.campaign_send_id', 'campaign_sends.id')
          .where({ 'campaign_sends.campaign_id': campaign.id })
          .select(
            db.raw(
              "COUNT(DISTINCT CASE WHEN engagement_events.type = 'open' THEN engagement_events.contact_id END) as opens_unique"
            ),
            db.raw(
              "COUNT(DISTINCT CASE WHEN engagement_events.type = 'click' THEN engagement_events.contact_id END) as clicks_unique"
            ),
            db.raw(
              "COUNT(*) FILTER (WHERE engagement_events.type = 'unsubscribe') as unsubscribes"
            ),
            db.raw(
              "COUNT(*) FILTER (WHERE engagement_events.type = 'spam_complaint') as spam_complaints"
            )
          );

        const recipients = parseInt(String(sends?.recipients || 0));
        const delivered = parseInt(String(sends?.delivered || 0));
        const bounces = parseInt(String(sends?.bounces || 0));
        const opensUnique = parseInt(String(engagement?.opens_unique || 0));
        const clicksUnique = parseInt(String(engagement?.clicks_unique || 0));
        const unsubscribes = parseInt(String(engagement?.unsubscribes || 0));
        const spamComplaints = parseInt(String(engagement?.spam_complaints || 0));

        const openRate = delivered > 0 ? (opensUnique / delivered) * 100 : 0;
        const clickRate = delivered > 0 ? (clicksUnique / delivered) * 100 : 0;
        const bounceRate = recipients > 0 ? (bounces / recipients) * 100 : 0;
        const unsubscribeRate = delivered > 0 ? (unsubscribes / delivered) * 100 : 0;

        return {
          ...campaign,
          recipients,
          delivered,
          opens_unique: opensUnique,
          clicks_unique: clicksUnique,
          unsubscribes,
          bounces,
          spam_complaints: spamComplaints,
          open_rate: Math.round(openRate * 100) / 100,
          click_rate: Math.round(clickRate * 100) / 100,
          bounce_rate: Math.round(bounceRate * 100) / 100,
          unsubscribe_rate: Math.round(unsubscribeRate * 100) / 100,
        };
      })
    );

    res.json({ success: true, data: { items, total, page, pageSize } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/campaigns/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const campaign = await db('campaigns')
      .where({ 'campaigns.id': id })
      .leftJoin('segments', 'campaigns.segment_id', 'segments.id')
      .select('campaigns.*', 'segments.name as segment_name')
      .first();

    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

    const [sends] = await db('campaign_sends')
      .where({ campaign_id: id })
      .select(
        db.raw('COUNT(*) as recipients'),
        db.raw("COUNT(*) FILTER (WHERE status = 'sent') as delivered"),
        db.raw("COUNT(*) FILTER (WHERE status = 'bounced') as bounces")
      );

    const [engagement] = await db('engagement_events')
      .join('campaign_sends', 'engagement_events.campaign_send_id', 'campaign_sends.id')
      .where({ 'campaign_sends.campaign_id': id })
      .select(
        db.raw(
          "COUNT(DISTINCT CASE WHEN engagement_events.type = 'open' THEN engagement_events.contact_id END) as opens_unique"
        ),
        db.raw(
          "COUNT(DISTINCT CASE WHEN engagement_events.type = 'click' THEN engagement_events.contact_id END) as clicks_unique"
        ),
        db.raw("COUNT(*) FILTER (WHERE engagement_events.type = 'unsubscribe') as unsubscribes"),
        db.raw(
          "COUNT(*) FILTER (WHERE engagement_events.type = 'spam_complaint') as spam_complaints"
        )
      );

    const recipients = parseInt(String(sends?.recipients || 0));
    const delivered = parseInt(String(sends?.delivered || 0));
    const bounces = parseInt(String(sends?.bounces || 0));
    const opensUnique = parseInt(String(engagement?.opens_unique || 0));
    const clicksUnique = parseInt(String(engagement?.clicks_unique || 0));
    const unsubscribes = parseInt(String(engagement?.unsubscribes || 0));
    const spamComplaints = parseInt(String(engagement?.spam_complaints || 0));

    const openRate = delivered > 0 ? (opensUnique / delivered) * 100 : 0;
    const clickRate = delivered > 0 ? (clicksUnique / delivered) * 100 : 0;
    const bounceRate = recipients > 0 ? (bounces / recipients) * 100 : 0;
    const unsubscribeRate = delivered > 0 ? (unsubscribes / delivered) * 100 : 0;

    // Engagement over time
    let engagementOverTime: Array<{ timestamp: string; opens: number; clicks: number }> = [];
    if (campaign.sent_at) {
      const sentAt = new Date(campaign.sent_at);
      const fortyEightHoursLater = new Date(sentAt.getTime() + 48 * 60 * 60 * 1000);

      const hourlyData = await db.raw(
        `
        SELECT
          date_trunc('hour', ee.occurred_at) as timestamp,
          COUNT(*) FILTER (WHERE ee.type = 'open') as opens,
          COUNT(*) FILTER (WHERE ee.type = 'click') as clicks
        FROM engagement_events ee
        JOIN campaign_sends cs ON ee.campaign_send_id = cs.id
        WHERE cs.campaign_id = ?
          AND ee.occurred_at >= ?
          AND ee.occurred_at < ?
        GROUP BY date_trunc('hour', ee.occurred_at)
        ORDER BY timestamp ASC
      `,
        [id, sentAt.toISOString(), fortyEightHoursLater.toISOString()]
      );

      const dailyData = await db.raw(
        `
        SELECT
          date_trunc('day', ee.occurred_at) as timestamp,
          COUNT(*) FILTER (WHERE ee.type = 'open') as opens,
          COUNT(*) FILTER (WHERE ee.type = 'click') as clicks
        FROM engagement_events ee
        JOIN campaign_sends cs ON ee.campaign_send_id = cs.id
        WHERE cs.campaign_id = ?
          AND ee.occurred_at >= ?
        GROUP BY date_trunc('day', ee.occurred_at)
        ORDER BY timestamp ASC
      `,
        [id, fortyEightHoursLater.toISOString()]
      );

      engagementOverTime = [
        ...hourlyData.rows.map((r: { timestamp: Date; opens: string; clicks: string }) => ({
          timestamp: r.timestamp.toISOString(),
          opens: parseInt(String(r.opens)),
          clicks: parseInt(String(r.clicks)),
        })),
        ...dailyData.rows.map((r: { timestamp: Date; opens: string; clicks: string }) => ({
          timestamp: r.timestamp.toISOString(),
          opens: parseInt(String(r.opens)),
          clicks: parseInt(String(r.clicks)),
        })),
      ];
    }

    res.json({
      success: true,
      data: {
        campaign,
        kpis: {
          recipients,
          delivered,
          opens_unique: opensUnique,
          clicks_unique: clicksUnique,
          unsubscribes,
          bounces,
          spam_complaints: spamComplaints,
          open_rate: Math.round(openRate * 100) / 100,
          click_rate: Math.round(clickRate * 100) / 100,
          bounce_rate: Math.round(bounceRate * 100) / 100,
          unsubscribe_rate: Math.round(unsubscribeRate * 100) / 100,
        },
        engagement_over_time: engagementOverTime,
      },
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/campaigns/:id/links', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const campaign = await db('campaigns').where({ id }).first();
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

    const [{ opens_unique }] = await db('engagement_events')
      .join('campaign_sends', 'engagement_events.campaign_send_id', 'campaign_sends.id')
      .where({ 'campaign_sends.campaign_id': id, 'engagement_events.type': 'open' })
      .select(
        db.raw('COUNT(DISTINCT engagement_events.contact_id) as opens_unique')
      );

    const totalOpens = parseInt(String(opens_unique || 0));

    const links = await db.raw(
      `
      SELECT
        ee.url,
        COUNT(*) as total_clicks,
        COUNT(DISTINCT ee.contact_id) as unique_clicks
      FROM engagement_events ee
      JOIN campaign_sends cs ON ee.campaign_send_id = cs.id
      WHERE cs.campaign_id = ?
        AND ee.type = 'click'
        AND ee.url IS NOT NULL
      GROUP BY ee.url
      ORDER BY total_clicks DESC
    `,
      [id]
    );

    const linksWithPct = links.rows.map(
      (r: { url: string; total_clicks: string; unique_clicks: string }) => ({
        url: r.url,
        total_clicks: parseInt(String(r.total_clicks)),
        unique_clicks: parseInt(String(r.unique_clicks)),
        pct_of_openers:
          totalOpens > 0
            ? Math.round((parseInt(String(r.unique_clicks)) / totalOpens) * 10000) / 100
            : 0,
      })
    );

    res.json({ success: true, data: linksWithPct });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/campaigns/:id/recipients', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const page = parseInt(String(req.query.page || '1'));
    const pageSize = parseInt(String(req.query.pageSize || '25'));
    const statusFilter = String(req.query.status || 'all');
    const offset = (page - 1) * pageSize;

    const campaign = await db('campaigns').where({ id }).first();
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

    // Build the base query with all engagement flags
    let query = db('campaign_sends')
      .where({ 'campaign_sends.campaign_id': id })
      .join('contacts', 'campaign_sends.contact_id', 'contacts.id')
      .leftJoin(
        db('engagement_events')
          .where({ type: 'open' })
          .select('campaign_send_id')
          .groupBy('campaign_send_id')
          .as('opens'),
        'campaign_sends.id',
        'opens.campaign_send_id'
      )
      .leftJoin(
        db('engagement_events')
          .where({ type: 'click' })
          .select('campaign_send_id')
          .groupBy('campaign_send_id')
          .as('clicks'),
        'campaign_sends.id',
        'clicks.campaign_send_id'
      )
      .leftJoin(
        db('engagement_events')
          .where({ type: 'unsubscribe' })
          .select('campaign_send_id')
          .groupBy('campaign_send_id')
          .as('unsubs'),
        'campaign_sends.id',
        'unsubs.campaign_send_id'
      )
      .select(
        'contacts.id as contact_id',
        'contacts.email',
        db.raw("campaign_sends.status = 'sent' as delivered"),
        db.raw("campaign_sends.status = 'bounced' as bounced"),
        db.raw('opens.campaign_send_id IS NOT NULL as opened'),
        db.raw('clicks.campaign_send_id IS NOT NULL as clicked'),
        db.raw('unsubs.campaign_send_id IS NOT NULL as unsubscribed')
      );

    // Apply status filter
    if (statusFilter === 'opened') {
      query = query.whereNotNull('opens.campaign_send_id');
    } else if (statusFilter === 'not_opened') {
      query = query.whereNull('opens.campaign_send_id');
    } else if (statusFilter === 'clicked') {
      query = query.whereNotNull('clicks.campaign_send_id');
    } else if (statusFilter === 'unsubscribed') {
      query = query.whereNotNull('unsubs.campaign_send_id');
    } else if (statusFilter === 'bounced') {
      query = query.where({ 'campaign_sends.status': 'bounced' });
    }

    const [{ count }] = await query.clone().count('campaign_sends.id as count');
    const total = parseInt(String(count));

    const items = await query.limit(pageSize).offset(offset);

    res.json({ success: true, data: { items, total, page, pageSize } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
