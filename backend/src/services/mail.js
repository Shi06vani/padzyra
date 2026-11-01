const { nowHM, todayISO } = require('../utils/dates');

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

async function sendOtpMail(email, code, purpose = 'login') {
  const transport = getTransport();
  if (!transport) {
    console.log(`[Padzyra SMTP] (Dev mode fallback) OTP for ${email} [${purpose}]: ${code}`);
    return;
  }

  const subjectTitles = {
    login: 'Your Padzyra Verification Code',
    delete: 'Confirm Account Deletion - Padzyra',
    logout: 'Confirm Logout All Devices - Padzyra',
  };

  const subject = subjectTitles[purpose] || 'Your Padzyra Code';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; background-color: #fbf6f3; padding: 32px 24px; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #6a3b59; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Padzyra</h2>
        <p style="color: #c98cb0; margin: 4px 0 0 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">Period & Pad Care</p>
      </div>

      <div style="background-color: #ffffff; border-radius: 14px; padding: 24px; text-align: center; box-shadow: 0 4px 12px rgba(201, 140, 176, 0.15);">
        <p style="color: #4a2c40; font-size: 15px; margin: 0 0 16px 0; font-weight: 600;">Use the verification code below to complete your ${purpose}:</p>
        <div style="display: inline-block; background-color: #fcebf4; padding: 12px 28px; border-radius: 12px; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #6a3b59; margin-bottom: 16px;">
          ${code}
        </div>
        <p style="color: #8b4f73; font-size: 13px; margin: 0;">This code is valid for <strong>5 minutes</strong>. Never share this code with anyone.</p>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <p style="color: #a38299; font-size: 12px; margin: 0;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
    </div>
  `;

  await transport.sendMail({
    from: process.env.SMTP_FROM || `"Padzyra" <${process.env.SMTP_USER || 'no-reply@padzyra.local'}>`,
    to: email,
    subject,
    text: `Your Padzyra ${purpose} code is: ${code}. Valid for 5 minutes.`,
    html,
  });
}

async function sendLoginNotice(email) {
  const transport = getTransport();
  if (!transport) return;
  await transport.sendMail({
    from: process.env.SMTP_FROM || `"Padzyra" <${process.env.SMTP_USER || 'no-reply@padzyra.local'}>`,
    to: email,
    subject: 'New login',
    text: `New login ${todayISO()} ${nowHM()}`,
  });
}

async function sendReminder(email, token) {
  const transport = getTransport();
  if (!transport || !email) return;
  const port = process.env.PORT || 3000;
  const link = token ? `http://localhost:${port}/#/act?token=${encodeURIComponent(token)}` : '';
  const text = link ? `Reminder\n\n${link}` : 'Reminder';
  await transport.sendMail({
    from: process.env.SMTP_FROM || `"Padzyra" <${process.env.SMTP_USER || 'no-reply@padzyra.local'}>`,
    to: email,
    subject: 'Reminder',
    text,
  });
}

module.exports = { sendOtpMail, sendLoginNotice, sendReminder };
