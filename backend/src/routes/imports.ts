import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import XLSX from 'xlsx';
import { parse as csvParse } from 'csv-parse/sync';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/db';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .csv files are allowed'));
    }
  },
});

function parseFile(
  buffer: Buffer,
  originalname: string
): { columns: string[]; rows: unknown[][] } {
  const ext = path.extname(originalname).toLowerCase();

  if (ext === '.xlsx') {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
    if (data.length === 0) return { columns: [], rows: [] };
    const columns = data[0].map(String);
    const rows = data.slice(1);
    return { columns, rows };
  } else {
    const records = csvParse(buffer, { relax_column_count: true }) as unknown[][];
    if (records.length === 0) return { columns: [], rows: [] };
    const columns = records[0].map(String);
    const rows = records.slice(1);
    return { columns, rows };
  }
}

router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const { columns, rows } = parseFile(req.file.buffer, req.file.originalname);
    const preview = rows.slice(0, 5);

    res.json({ success: true, data: { columns, preview } });
  } catch (err) {
    const error = err as Error;
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/execute', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const importType = req.body.importType as string;
    if (!importType || !['contacts', 'events'].includes(importType)) {
      res.status(400).json({ success: false, error: 'importType must be contacts or events' });
      return;
    }

    let mapping: Record<string, string>;
    try {
      mapping = JSON.parse(req.body.mapping || '{}');
    } catch {
      res.status(400).json({ success: false, error: 'mapping must be valid JSON' });
      return;
    }

    const { columns, rows } = parseFile(req.file.buffer, req.file.originalname);
    const fileName = req.file.originalname;

    // Build column index map
    const colIndexMap: Record<string, number> = {};
    for (const [fileCol, mappedCol] of Object.entries(mapping)) {
      if (mappedCol !== 'skip') {
        const idx = columns.indexOf(fileCol);
        if (idx !== -1) {
          colIndexMap[mappedCol] = idx;
        }
      }
    }

    const errorLog: Array<{ row: number; reason: string }> = [];
    let rowsProcessed = 0;
    let contactsCreated = 0;
    let contactsUpdated = 0;
    let eventsCreated = 0;

    if (importType === 'contacts') {
      const emailIdx = colIndexMap['email'];
      if (emailIdx === undefined) {
        res.status(400).json({ success: false, error: 'email column mapping is required' });
        return;
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        rowsProcessed++;

        const email = String(row[emailIdx] || '').trim().toLowerCase();
        if (!email || !email.includes('@')) {
          errorLog.push({ row: i + 2, reason: `Invalid email: ${email}` });
          continue;
        }

        // Build attributes from mapping
        const attributes: Record<string, unknown> = {};
        for (const [mappedCol, colIdx] of Object.entries(colIndexMap)) {
          if (mappedCol === 'email') continue;
          const val = row[colIdx];
          if (val !== undefined && val !== null && val !== '') {
            attributes[mappedCol] = val;
          }
        }

        // Validate known fields
        if (attributes.test_credit_score !== undefined) {
          const score = Number(attributes.test_credit_score);
          if (isNaN(score) || score < 0 || score > 1200) {
            errorLog.push({
              row: i + 2,
              reason: `test_credit_score value ${attributes.test_credit_score} is outside expected range (0-1200)`,
            });
          } else {
            attributes.test_credit_score = score;
          }
        }

        if (
          attributes.test_credit_score_type !== undefined &&
          !['Equifax', 'Experian'].includes(String(attributes.test_credit_score_type))
        ) {
          errorLog.push({
            row: i + 2,
            reason: `test_credit_score_type value '${attributes.test_credit_score_type}' should be Equifax or Experian`,
          });
        }

        try {
          const existing = await db('contacts').where({ email }).first();
          if (existing) {
            const merged = { ...existing.custom_attributes, ...attributes };
            await db('contacts')
              .where({ id: existing.id })
              .update({ custom_attributes: JSON.stringify(merged), updated_at: db.fn.now() });
            contactsUpdated++;
          } else {
            await db('contacts').insert({
              id: uuidv4(),
              email,
              custom_attributes: JSON.stringify(attributes),
            });
            contactsCreated++;
          }
        } catch (dbErr) {
          const dbError = dbErr as Error;
          errorLog.push({ row: i + 2, reason: dbError.message });
        }
      }
    } else if (importType === 'events') {
      const emailIdx = colIndexMap['email'];
      const eventNameIdx = colIndexMap['event_name'];
      const occurredAtIdx = colIndexMap['occurred_at'];
      const metadataIdx = colIndexMap['metadata'];

      if (emailIdx === undefined || eventNameIdx === undefined || occurredAtIdx === undefined) {
        res.status(400).json({
          success: false,
          error: 'email, event_name, and occurred_at column mappings are required',
        });
        return;
      }

      // Fetch all event definitions for case-insensitive matching
      const eventDefs = await db('event_definitions').select('name');
      const validEventNames = new Set(eventDefs.map((e: { name: string }) => e.name.toLowerCase()));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        rowsProcessed++;

        const email = String(row[emailIdx] || '').trim().toLowerCase();
        const eventName = String(row[eventNameIdx] || '').trim();
        const occurredAtStr = String(row[occurredAtIdx] || '').trim();

        if (!email || !email.includes('@')) {
          errorLog.push({ row: i + 2, reason: `Invalid email: ${email}` });
          continue;
        }

        if (!validEventNames.has(eventName.toLowerCase())) {
          errorLog.push({
            row: i + 2,
            reason: `Unknown event name: ${eventName}. Must match a registered event definition.`,
          });
          continue;
        }

        const occurredAt = new Date(occurredAtStr);
        if (isNaN(occurredAt.getTime())) {
          errorLog.push({ row: i + 2, reason: `Invalid occurred_at date: ${occurredAtStr}` });
          continue;
        }

        const contact = await db('contacts').where({ email }).first();
        if (!contact) {
          errorLog.push({ row: i + 2, reason: `Contact not found for email: ${email}` });
          continue;
        }

        let metadata: Record<string, unknown> = {};
        if (metadataIdx !== undefined && row[metadataIdx]) {
          try {
            metadata = JSON.parse(String(row[metadataIdx]));
          } catch {
            // ignore invalid JSON metadata
          }
        }

        try {
          await db('custom_events').insert({
            id: uuidv4(),
            contact_id: contact.id,
            event_name: eventName,
            occurred_at: occurredAt,
            metadata: JSON.stringify(metadata),
          });
          eventsCreated++;
        } catch (dbErr) {
          const dbError = dbErr as Error;
          errorLog.push({ row: i + 2, reason: dbError.message });
        }
      }
    }

    // Save import history
    const [importRecord] = await db('import_history')
      .insert({
        id: uuidv4(),
        import_type: importType,
        file_name: fileName,
        rows_processed: rowsProcessed,
        contacts_created: contactsCreated,
        contacts_updated: contactsUpdated,
        events_created: eventsCreated,
        errors_count: errorLog.length,
        error_log: JSON.stringify(errorLog),
      })
      .returning('*');

    res.json({
      success: true,
      data: {
        importId: importRecord.id,
        rowsProcessed,
        contactsCreated,
        contactsUpdated,
        eventsCreated,
        errorsCount: errorLog.length,
        errors: errorLog.slice(0, 20),
      },
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(String(req.query.page || '1'));
    const pageSize = parseInt(String(req.query.pageSize || '25'));
    const offset = (page - 1) * pageSize;

    const [{ count }] = await db('import_history').count('id as count');
    const total = parseInt(String(count));
    const items = await db('import_history')
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    res.json({ success: true, data: { items, total, page, pageSize } });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/history/:id/errors', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const record = await db('import_history').where({ id }).first();
    if (!record) {
      res.status(404).json({ success: false, error: 'Import record not found' });
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="import-errors-${id}.json"`
    );
    res.json(record.error_log);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sample/contacts', async (req: Request, res: Response): Promise<void> => {
  try {
    const filePath = path.join(
      __dirname,
      '../db/seeds/sample_contacts_import.xlsx'
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="sample_contacts_import.xlsx"');
    res.sendFile(filePath);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sample/events', async (req: Request, res: Response): Promise<void> => {
  try {
    const filePath = path.join(
      __dirname,
      '../db/seeds/sample_events_import.xlsx'
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="sample_events_import.xlsx"');
    res.sendFile(filePath);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
