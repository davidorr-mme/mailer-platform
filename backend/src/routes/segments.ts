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
