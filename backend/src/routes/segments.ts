import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { evaluateSegment, countSegment } from '../services/segmentEvaluator';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(String(req.query.page || '1'));
    const pageSize = parseInt(String(req.query.pageSize || '25'));
    const offset = (page - 1) * pageSize;

    const [{ count }] = await db('segments').count('id as count');
    const total = parseInt(String(count));
    const items = await db('segments')
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
    const { name, description, logic } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }

    const count = logic ? await countSegment(logic, db) : 0;

    const [segment] = await db('segments')
      .insert({
        id: uuidv4(),
        name,
        description: description || '',
        logic: JSON.stringify(logic || {}),
        contact_count: count,
      })
      .returning('*');

    res.status(201).json({ success: true, data: segment });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const segment = await db('segments').where({ id }).first();
    if (!segment) {
      res.status(404).json({ success: false, error: 'Segment not found' });
      return;
    }
    res.json({ success: true, data: segment });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, logic } = req.body;

    const existing = await db('segments').where({ id }).first();
    if (!existing) {
      res.status(404).json({ success: false, error: 'Segment not found' });
      return;
    }

    const updateData: Record<string, unknown> = { updated_at: db.fn.now() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (logic !== undefined) {
      updateData.logic = JSON.stringify(logic);
      updateData.contact_count = await countSegment(logic, db);
    }

    const [updated] = await db('segments').where({ id }).update(updateData).returning('*');
    res.json({ success: true, data: updated });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const segment = await db('segments').where({ id }).first();
    if (!segment) {
      res.status(404).json({ success: false, error: 'Segment not found' });
      return;
    }

    const deps: Array<{ type: string; name: string; id: string }> = [];

    const campaigns = await db('campaigns').where({ segment_id: id }).select('id', 'name');
    for (const c of campaigns) {
      deps.push({ type: 'campaign', name: c.name, id: c.id });
    }

    const automations = await db('automations')
      .where({ target_segment_id: id })
      .select('id', 'name');
    for (const a of automations) {
      deps.push({ type: 'automation', name: a.name, id: a.id });
    }

    if (deps.length > 0) {
      res.status(409).json({
        success: false,
        error: `Segment is referenced in ${deps.length} campaigns/automations`,
        dependencies: deps,
      });
      return;
    }

    await db('segments').where({ id }).del();
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/estimate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const segment = await db('segments').where({ id }).first();
    if (!segment) {
      res.status(404).json({ success: false, error: 'Segment not found' });
      return;
    }
    const count = await countSegment(segment.logic, db);
    res.json({ success: true, data: { count } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/estimate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { logic } = req.body;
    const count = await countSegment(logic || {}, db);
    res.json({ success: true, data: { count } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const segment = await db('segments').where({ id }).first();
    if (!segment) {
      res.status(404).json({ success: false, error: 'Segment not found' });
      return;
    }

    const contactIds = await evaluateSegment(segment.logic, db);
    const filename = segment.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    if (contactIds.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}-export.csv"`);
      res.send('id,email,global_unsubscribe,created_at\n');
      return;
    }

    const attrDefs = await db('attribute_definitions').orderBy('name', 'asc');
    const contacts = await db('contacts')
      .whereIn('id', contactIds)
      .select('id', 'email', 'global_unsubscribe', 'created_at', 'custom_attributes');
    const events = await db('custom_events')
      .whereIn('contact_id', contactIds)
      .select('contact_id', 'event_name', 'occurred_at')
      .orderBy('occurred_at', 'desc');

    // Distinct event names across this segment's contacts
    const eventNames: string[] = [...new Set(events.map((e: any) => (e.event_name ?? e.eventName) as string))].filter(Boolean).sort();

    // contact_id -> event_name -> most recent occurred_at
    const norm = (s: string) => s.toLowerCase().replace(/_/g, '');
    const eventMap: Record<string, Record<string, string>> = {};
    for (const ev of events) {
      const cid = ev.contact_id ?? ev.contactId;
      const ename = ev.event_name ?? ev.eventName;
      const oat = ev.occurred_at ?? ev.occurredAt;
      if (!cid || !ename) continue;
      if (!eventMap[cid]) eventMap[cid] = {};
      if (!eventMap[cid][ename]) eventMap[cid][ename] = oat;
    }

    // CSV escape: wrap in quotes if value contains comma, quote, or newline
    const esc = (v: any): string => {
      const s = v === null || v === undefined ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const attrHeaders = attrDefs.map((a: any) => `attr_${a.name}`);
    const eventHeaders = eventNames.map((n) => `event_${n}_last_at`);
    const headerRow = ['id', 'email', 'global_unsubscribe', 'created_at', ...attrHeaders, ...eventHeaders].join(',');

    const rows = contacts.map((c: any) => {
      const attrs = c.custom_attributes ?? c.customAttributes ?? {};
      const attrValues = attrDefs.map((a: any) => {
        const match = Object.entries(attrs).find(([k]) => norm(k) === norm(a.name));
        return esc(match ? match[1] : '');
      });
      const evValues = eventNames.map((n) => esc(eventMap[c.id]?.[n] ?? ''));
      return `${c.id},${esc(c.email)},${c.global_unsubscribe},${c.created_at},${attrValues.join(',')},${evValues.join(',')}`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}-export.csv"`);
    res.send([headerRow, ...rows].join('\n'));
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/duplicate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const original = await db('segments').where({ id }).first();
    if (!original) {
      res.status(404).json({ success: false, error: 'Segment not found' });
      return;
    }

    const [copy] = await db('segments')
      .insert({
        id: uuidv4(),
        name: `Copy of ${original.name}`,
        description: original.description,
        logic: JSON.stringify(original.logic),
        contact_count: original.contact_count,
      })
      .returning('*');

    res.status(201).json({ success: true, data: copy });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
