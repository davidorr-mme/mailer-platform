import nodemailer from 'nodemailer';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import redisClient from '../config/redis';

export function createTransporter() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
  });
}

async function processHtml(
  html: string,
  campaignSendId: string,
  contactId: string
): Promise<string> {
  const backendUrl = env.BACKEND_URL;

  // Replace all href attributes with tracking links
  const hrefRegex = /href="([^"]+)"/g;
  let processedHtml = html;
  const linkReplacements: Array<{ original: string; replacement: string }> = [];

  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const originalUrl = match[1];
    if (
      originalUrl.startsWith('mailto:') ||
      originalUrl.startsWith('#') ||
      originalUrl.includes('/track/') ||
      originalUrl.includes('/unsubscribe/')
    ) {
      continue;
    }

    const hash = crypto
      .createHash('sha256')
      .update(originalUrl + campaignSendId)
      .digest('hex')
      .slice(0, 12);

    await redisClient.set(`link:${hash}`, originalUrl, { EX: 30 * 24 * 60 * 60 });

    const trackingUrl = `${backendUrl}/track/click/${campaignSendId}/${contactId}/${hash}`;
    linkReplacements.push({
      original: `href="${originalUrl}"`,
      replacement: `href="${trackingUrl}"`,
    });
  }

  for (const { original, replacement } of linkReplacements) {
    processedHtml = processedHtml.split(original).join(replacement);
  }

  // Add unsubscribe link
  const unsubscribeToken = jwt.sign({ contactId }, env.JWT_SECRET, { expiresIn: '365d' });
  const unsubscribeUrl = `${backendUrl}/unsubscribe/${contactId}/${unsubscribeToken}`;
  const unsubscribeHtml = `<div style="text-align:center;font-size:12px;color:#999;margin-top:20px;"><a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a></div>`;

  // Add tracking pixel
  const trackingPixel = `<img src="${backendUrl}/track/open/${campaignSendId}/${contactId}" width="1" height="1" alt="" style="display:none;" />`;

  if (processedHtml.includes('</body>')) {
    processedHtml = processedHtml.replace(
      '</body>',
      `${trackingPixel}${unsubscribeHtml}</body>`
    );
  } else {
    processedHtml = `${processedHtml}${trackingPixel}${unsubscribeHtml}`;
  }

  return processedHtml;
}

export async function sendCampaignEmail(params: {
  to: string;
  subject: string;
  htmlBody: string;
  campaignSendId: string;
  contactId: string;
  previewText?: string;
  senderName?: string;
  senderEmail?: string;
}): Promise<void> {
  const {
    to,
    subject,
    htmlBody,
    campaignSendId,
    contactId,
    previewText,
    senderName,
    senderEmail,
  } = params;

  const processedHtml = await processHtml(htmlBody, campaignSendId, contactId);

  // Add preview text as hidden span if provided
  let finalHtml = processedHtml;
  if (previewText && processedHtml.includes('<body')) {
    const previewSpan = `<span style="display:none;font-size:1px;color:#ffffff;max-height:0;overflow:hidden;">${previewText}</span>`;
    finalHtml = processedHtml.replace(/<body[^>]*>/, (match) => `${match}${previewSpan}`);
  }

  const fromAddress = senderEmail
    ? senderName
      ? `"${senderName}" <${senderEmail}>`
      : senderEmail
    : env.SMTP_USER || 'noreply@example.com';

  // Check if SMTP is configured
  if (!env.SMTP_HOST || env.SMTP_HOST === 'localhost') {
    if (env.NODE_ENV === 'development') {
      console.log(`[EMAIL] Would send to: ${to}`);
      console.log(`[EMAIL] Subject: ${subject}`);
      console.log(`[EMAIL] From: ${fromAddress}`);
      console.log(`[EMAIL] Send ID: ${campaignSendId}`);
      return;
    }
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html: finalHtml,
  });
}
