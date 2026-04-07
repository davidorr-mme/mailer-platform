import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

async function checkDependencies(
  name: string
): Promise<Array<{ type: 'segment' | 'automation'; name: string; id: string }>> {
  const deps: Array<{ type: 'segment' | 'automation'; name: string; id: string }> = [];

  const segments = await db('segments').whereRaw('logic::text LIKE ?', [`%${name}%`]).select('id', 'name');
  for (const s of segments) {
    deps.push({ type: 'segment', name: s.name, id: s.id });
  }

  const automations = await db('automations')
    .where(function () {
      this.whereRaw('entry_criteria::text LIKE ?', [`%${name}%`]).orWhereRaw(
        'exit_criteria::text LIKE ?',
        [`%${name}%`]
      );
    })
    .select('id', 'name');

  for (const a of automations) {
    deps.push({ type: 'automation', name: a.name, id: a.id });
  }

  return deps;
}

// Attributes
router.get('/attributes', async (req: Request, res: Response): Promise<void> => {
  try {
    const attributes = await db('attribute_definitions').orderBy('created_at', 'asc');
    res.json({ success: true, data: attributes });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/attributes', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, dataType } = req.body;
    if (!name || !dataType) {
      res.status(400).json({ success: false, error: 'name and dataType are required' });
      return;
    }
    if (!['text', 'number', 'boolean'].includes(dataType)) {
      res.status(400).json({ success: false, error: 'dataType must be text, number, or boolean' });
      return;
    }
    const [attr] = await db('attribute_definitions')
      .insert({ id: uuidv4(), name, data_type: dataType })
      .returning('*');
    res.status(201).json({ success: true, data: attr });
  } catch (err) {
    const error = err as Error;
    if (error.message.includes('unique')) {
      res.status(409).json({ success: false, error: 'Attribute name already exists' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.put('/attributes/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }
    const [updated] = await db('attribute_definitions').where({ id }).update({ name }).returning('*');
    if (!updated) {
      res.status(404).json({ success: false, error: 'Attribute not found' });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/attributes/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const attr = await db('attribute_definitions').where({ id }).first();
    if (!attr) {
      res.status(404).json({ success: false, error: 'Attribute not found' });
      return;
    }
    const deps = await checkDependencies(attr.name);
    if (deps.length > 0) {
      res.status(409).json({
        success: false,
        error: `Attribute is referenced in ${deps.length} segments/automations`,
        dependencies: deps,
      });
      return;
    }
    await db('attribute_definitions').where({ id }).del();
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

// Events
router.get('/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const events = await db('event_definitions').orderBy('created_at', 'asc');
    res.json({ success: true, data: events });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }
    const [event] = await db('event_definitions')
      .insert({ id: uuidv4(), name, description: description || null })
      .returning('*');
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    const error = err as Error;
    if (error.message.includes('unique')) {
      res.status(409).json({ success: false, error: 'Event name already exists' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.put('/events/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const updateData: Record<string, string> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const [updated] = await db('event_definitions').where({ id }).update(updateData).returning('*');
    if (!updated) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/events/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const event = await db('event_definitions').where({ id }).first();
    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }
    const deps = await checkDependencies(event.name);
    if (deps.length > 0) {
      res.status(409).json({
        success: false,
        error: `Event is referenced in ${deps.length} segments/automations`,
        dependencies: deps,
      });
      return;
    }
    await db('event_definitions').where({ id }).del();
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
