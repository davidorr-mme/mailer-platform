import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../config/db';
import redisClient from '../config/redis';
import { env } from '../config/env';

const router = Router();

const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

router.get('/open/:sendId/:contactId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sendId, contactId } = req.params;

    const send = await db('campaign_sends').where({ id: sendId }).first();
    if (send) {
      await db('engagement_events').insert({
        id: uuidv4(),
        campaign_send_id: sendId,
        contact_id: contactId,
        type: 'open',
        occurred_at: new Date(),
      });
    }
  } catch {
    // Silently ignore tracking errors
  } finally {
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.send(TRACKING_PIXEL);
  }
});

router.get('/click/:sendId/:contactId/:linkHash', async (req: Request, res: Response): Promise<void> => {
  const { sendId, contactId, linkHash } = req.params;
  let redirectUrl = env.FRONTEND_URL;

  try {
    const storedUrl = await redisClient.get(`link:${linkHash}`);
    if (storedUrl) {
      redirectUrl = storedUrl;
    }

    const send = await db('campaign_sends').where({ id: sendId }).first();
    if (send) {
      await db('engagement_events').insert({
        id: uuidv4(),
        campaign_send_id: sendId,
        contact_id: contactId,
        type: 'click',
        url: redirectUrl !== env.FRONTEND_URL ? redirectUrl : null,
        occurred_at: new Date(),
      });
    }
  } catch {
    // Silently ignore tracking errors
  }

  res.redirect(302, redirectUrl);
});

router.get('/unsubscribe/:contactId/:token', async (req: Request, res: Response): Promise<void> => {
  const { contactId, token } = req.params;

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { contactId: string };
    if (decoded.contactId !== contactId) {
      res.status(400).send('<h1>Invalid unsubscribe link</h1>');
      return;
    }

    await db('contacts').where({ id: contactId }).update({ global_unsubscribe: true });

    // Find most recent campaign send for this contact
    const recentSend = await db('campaign_sends')
      .where({ contact_id: contactId })
      .orderBy('created_at', 'desc')
      .first();

    if (recentSend) {
      await db('engagement_events').insert({
        id: uuidv4(),
        campaign_send_id: recentSend.id,
        contact_id: contactId,
        type: 'unsubscribe',
        occurred_at: new Date(),
      });
    }

    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              max-width: 500px;
            }
            h1 { color: #333; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Unsubscribed Successfully</h1>
            <p>You have been unsubscribed successfully. You will no longer receive emails from us.</p>
          </div>
        </body>
      </html>
    `);
  } catch {
    res.status(400).send('<h1>Invalid or expired unsubscribe link</h1>');
  }
});

export default router;
