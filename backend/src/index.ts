import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { startCampaignSendWorker } from './jobs/campaignSend';
import { startAutomationWorker } from './jobs/automationProcessor';

import authRouter from './routes/auth';
import datamapRouter from './routes/datamap';
import contactsRouter from './routes/contacts';
import segmentsRouter from './routes/segments';
import campaignsRouter from './routes/campaigns';
import automationsRouter from './routes/automations';
import reportsRouter from './routes/reports';
import importsRouter from './routes/imports';
import dashboardRouter from './routes/dashboard';
import trackingRouter from './routes/tracking';

const app = express();

// CORS
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/datamap', datamapRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/segments', segmentsRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/automations', automationsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/imports', importsRouter);
app.use('/api/dashboard', dashboardRouter);

// Public tracking routes (no /api prefix)
app.use('/track', trackingRouter);
app.use('/unsubscribe', trackingRouter);

app.get('/run-setup', async (req, res) => {
  try {
    const bcrypt = await import('bcrypt');
    const { v4: uuidv4 } = await import('uuid');
    const db = (await import('./config/db')).default;
    await db('users').insert({
      id: uuidv4(),
      email: 'admin@example.com',
      password_hash: await bcrypt.hash('password123', 10),
    }).onConflict('email').ignore();
    await db('attribute_definitions').insert([
      { id: uuidv4(), name: 'test_credit_score', data_type: 'number' },
      { id: uuidv4(), name: 'test_credit_score_type', data_type: 'text' },
    ]).onConflict('name').ignore();
    await db('event_definitions').insert([
      { id: uuidv4(), name: 'test_credit_score_created', description: 'Fired when a credit score record is first created' },
      { id: uuidv4(), name: 'test_credit_score_changed', description: 'Fired when the credit score changes' },
      { id: uuidv4(), name: 'test_last_email_opened', description: 'Fired when the contact opens any email' },
    ]).onConflict('name').ignore();
    res.json({ success: true, data: 'Setup complete! Admin user and definitions created.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start workers
startCampaignSendWorker();
startAutomationWorker();

// Start server
const server = app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

export { app, server };
