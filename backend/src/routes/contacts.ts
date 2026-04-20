import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(String(req.query.page || '1'));
    const pageSize = parseInt(String(req.query.pageSize || '25'));
    const emailFilter = String(req.query.email || '');
    const offset = (page - 1) * pageSize;

    let query = db('contacts');
    if (emailFilter) {
      query = query.whereILike('email', `%${emailFilter}%`);
    }

    const [{ count }] = await query.clone().count('id as count');
    const total = parseInt(String(count));

    const items = await query.orderBy('created_at', 'desc').limit(pageSize).offset(offset);

    res.json({ success: true, data: { items, total, page, pageSize } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.query;
    if (!email) {
      res.status(400).json({ success: false, error: 'email query param is required' });
      return;
    }

    const contact = await db('contacts').whereILike('email', `%${String(email)}%`).first();
    if (!contact) {
      res.status(404).json({ success: false, error: 'Contact not found' });
      return;
    }

    const [eventsCount] = await db('custom_events')
      .where({ contact_id: contact.id })
      .count('id as count');
    const [sendsCount] = await db('campaign_sends')
      .where({ contact_id: contact.id })
      .count('id as count');

    res.json({
      success: true,
      data: {
        ...contact,
        custom_events_count: parseInt(String(eventsCount.count)),
        campaign_sends_count: parseInt(String(sendsCount.count)),
      },
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const eventsPage = parseInt(String(req.query.page || '1'));
    const eventsPageSize = parseInt(String(req.query.pageSize || '25'));

    const contact = await db('contacts').where({ id }).first();
    if (!contact) {
      res.status(404).json({ success: false, error: 'Contact not found' });
      return;
    }

    // All attribute definitions mapped to contact values
    const attributeDefinitions = await db('attribute_definitions').orderBy('name', 'asc');
    const attributes = attributeDefinitions.map((attr) => ({
      ...attr,
      value: contact.custom_attributes?.[attr.name] ?? null,
    }));

    // Custom events paginated
    const eventsOffset = (eventsPage - 1) * eventsPageSize;
    const [{ count: eventsCount }] = await db('custom_events')
      .where({ contact_id: id })
      .count('id as count');
    const customEvents = await db('custom_events')
      .where({ contact_id: id })
      .orderBy('occurred_at', 'desc')
      .limit(eventsPageSize)
      .offset(eventsOffset);

    // Campaign sends with engagement events and campaign name
    const campaignSends = await db('campaign_sends')
      .where({ 'campaign_sends.contact_id': id })
      .join('campaigns', 'campaign_sends.campaign_id', 'campaigns.id')
      .select(
        'campaign_sends.*',
        'campaigns.name as campaign_name',
        'campaigns.subject_line'
      )
      .orderBy('campaign_sends.created_at', 'desc');

    // For each send, get engagement events
    const sendsWithEngagement = await Promise.all(
      campaignSends.map(async (send) => {
        const engagementEvents = await db('engagement_events')
          .where({ campaign_send_id: send.id })
          .orderBy('occurred_at', 'asc');
        return { ...send, engagement_events: engagementEvents };
      })
    );

    res.json({
      success: true,
      data: {
        contact,
        attributes,
        customEvents: {
          items: customEvents,
          total: parseInt(String(eventsCount)),
          page: eventsPage,
          pageSize: eventsPageSize,
        },
        campaignSends: sendsWithEngagement,
      },
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, attributes } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: 'email is required' });
      return;
    }

    const existing = await db('contacts').where({ email }).first();
    if (existing) {
      const merged = { ...existing.custom_attributes, ...(attributes || {}) };
      const [updated] = await db('contacts')
        .where({ id: existing.id })
        .update({ custom_attributes: JSON.stringify(merged), updated_at: db.fn.now() })
        .returning('*');
      res.json({ success: true, data: updated });
    } else {
      const [contact] = await db('contacts')
        .insert({
          id: uuidv4(),
          email,
          custom_attributes: JSON.stringify(attributes || {}),
        })
        .returning('*');
      res.status(201).json({ success: true, data: contact });
    }
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { email, globalUnsubscribe } = req.body;

    const contact = await db('contacts').where({ id }).first();
    if (!contact) {
      res.status(404).json({ success: false, error: 'Contact not found' });
      return;
    }

    const updateData: Record<string, unknown> = { updated_at: db.fn.now() };
    if (email !== undefined) {
      const existing = await db('contacts').where({ email }).whereNot({ id }).first();
      if (existing) {
        res.status(409).json({ success: false, error: 'Email already in use by another contact' });
        return;
      }
      updateData.email = email;
    }
    if (globalUnsubscribe !== undefined) updateData.global_unsubscribe = globalUnsubscribe;

    const [updated] = await db('contacts').where({ id }).update(updateData).returning('*');
    res.json({ success: true, data: updated });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/attributes', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { attributes } = req.body;

    const contact = await db('contacts').where({ id }).first();
    if (!contact) {
      res.status(404).json({ success: false, error: 'Contact not found' });
      return;
    }

    const merged = { ...contact.custom_attributes, ...attributes };
    const [updated] = await db('contacts')
      .where({ id })
      .update({ custom_attributes: JSON.stringify(merged), updated_at: db.fn.now() })
      .returning('*');

    res.json({ success: true, data: updated });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { eventName, occurredAt, metadata } = req.body;

    if (!eventName || !occurredAt) {
      res.status(400).json({ success: false, error: 'eventName and occurredAt are required' });
      return;
    }

    const contact = await db('contacts').where({ id }).first();
    if (!contact) {
      res.status(404).json({ success: false, error: 'Contact not found' });
      return;
    }

    const [event] = await db('custom_events')
      .insert({
        id: uuidv4(),
        contact_id: id,
        event_name: eventName,
        occurred_at: new Date(occurredAt),
        metadata: JSON.stringify(metadata || {}),
      })
      .returning('*');

    res.status(201).json({ success: true, data: event });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
