const { nowHM, todayISO } = require('../utils/dates');

/**
 * Brevo (Sendinblue) HTTP REST API
 * Uses standard HTTPS (Port 443), which works seamlessly on Render free tier.
 */
async function sendViaBrevo({ to, subject, html, text }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;

  const senderEmail =
    process.env.BREVO_SENDER_EMAIL ||
    process.env.SMTP_USER ||
    'shivanisuryavanshi612@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Padzyra Care';

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    console.error('[Padzyra Brevo Error]', errorJson);
    throw new Error(errorJson.message || `Brevo API HTTP ${res.status}`);
  }

  console.log(`[Padzyra Brevo] Email successfully delivered to ${to}`);
  return true;
}

/**
 * Resend HTTP REST API
 * Standard HTTPS (Port 443) fallback
 */
async function sendViaResend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const from = process.env.RESEND_FROM || 'Padzyra Care <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    console.error('[Padzyra Resend Error]', errorJson);
    throw new Error(errorJson.message || `Resend API HTTP ${res.status}`);
  }

  console.log(`[Padzyra Resend] Email successfully delivered to ${to}`);
  return true;
}

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (error) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  });
}

async function dispatchEmail({ to, subject, html, text }) {
  // 1. Try Brevo HTTP API (Port 443 - works on Render Free Tier!)
  if (process.env.BREVO_API_KEY) {
    return sendViaBrevo({ to, subject, html, text });
  }

  // 2. Try Resend HTTP API (Port 443 - works on Render Free Tier!)
  if (process.env.RESEND_API_KEY) {
    return sendViaResend({ to, subject, html, text });
  }

  // 3. Fallback to Nodemailer SMTP (Port 587)
  const transport = getTransport();
  if (transport) {
    return transport.sendMail({
      from: process.env.SMTP_FROM || `"Padzyra" <${process.env.SMTP_USER || 'no-reply@padzyra.local'}>`,
      to,
      subject,
      text,
      html,
    });
  }

  console.log(`[Padzyra Mail Fallback] Simulated email to ${to}: ${subject}`);
}

async function sendOtpMail(email, code, purpose = 'login') {
  const subjectTitles = {
    login: 'Your Padzyra Verification Code',
    delete: 'Confirm Account Deletion - Padzyra',
    logout: 'Confirm Logout All Devices - Padzyra',
    'reset-pin': 'Reset Your Padzyra Security PIN',
  };

  const purposeDescriptions = {
    login: 'login verification',
    delete: 'account deletion',
    logout: 'logout confirmation',
    'reset-pin': 'security PIN reset',
  };
  const purposeText = purposeDescriptions[purpose] || purpose;

  const subject = subjectTitles[purpose] || 'Your Padzyra Code';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; background-color: #fbf6f3; padding: 32px 24px; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #6a3b59; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Padzyra</h2>
        <p style="color: #c98cb0; margin: 4px 0 0 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">Period & Pad Care</p>
      </div>

      <div style="background-color: #ffffff; border-radius: 14px; padding: 24px; text-align: center; box-shadow: 0 4px 12px rgba(201, 140, 176, 0.15);">
        <p style="color: #4a2c40; font-size: 15px; margin: 0 0 16px 0; font-weight: 600;">Use the verification code below to complete your ${purposeText}:</p>
        <div style="display: inline-block; background-color: #fcebf4; padding: 12px 28px; border-radius: 12px; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #6a3b59; margin-bottom: 16px;">
          ${code}
        </div>
        <p style="color: #8b4f73; font-size: 13px; margin: 0;">This code is valid for <strong>15 minutes</strong>. Never share this code with anyone.</p>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <p style="color: #a38299; font-size: 12px; margin: 0;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
    </div>
  `;
  const text = `Your Padzyra ${purposeText} code is: ${code}. Valid for 15 minutes.`;

  try {
    await dispatchEmail({ to: email, subject, html, text });
  } catch (err) {
    console.error('[Padzyra Mail Dispatch Error]', err?.message || err);
  }
}

async function sendLoginNotice(email) {
  try {
    await dispatchEmail({
      to: email,
      subject: 'New login',
      text: `New login ${todayISO()} ${nowHM()}`,
      html: `<p>New login detected on ${todayISO()} at ${nowHM()}</p>`,
    });
  } catch (err) {
    console.error('[Padzyra Login Notice Error]', err?.message || err);
  }
}

async function sendReminder(email, token) {
  if (!email) return;
  const port = process.env.PORT || 3000;
  const appBase = process.env.APP_URL || (process.env.NODE_ENV === 'production' ? 'https://padzyra.onrender.com' : `http://localhost:${port}`);
  const link = token ? `${appBase}/#/act?token=${encodeURIComponent(token)}` : '';
  const text = link ? `Reminder\n\n${link}` : 'Reminder';
  try {
    await dispatchEmail({
      to: email,
      subject: 'Reminder',
      text,
      html: `<p>${text}</p>`,
    });
  } catch (err) {
    console.error('[Padzyra Reminder Error]', err?.message || err);
  }
}

module.exports = { sendOtpMail, sendLoginNotice, sendReminder };
