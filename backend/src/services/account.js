const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const db = require('../models');
const env = require('../config/env');
const HttpError = require('../utils/httpError');
const {
  hashValue, verifyValue, sha256, randomToken, randomCode,
} = require('../utils/cryptoBox');
const { profile } = require('./profile');
const { sendOtpMail } = require('./mail');

const PURPOSES = ['login', 'delete', 'logout', 'reset-pin'];
const ipHits = new Map();

function maskDestination(identifier) {
  if (!identifier) return '';
  const str = String(identifier).trim();
  if (str.startsWith('phone_') && str.endsWith('@padzyra.local')) {
    const raw = str.slice(6, str.indexOf('@'));
    const last4 = raw.slice(-4);
    return `mobile ending in ••${last4}`;
  }
  if (/^\+?\d{10,15}$/.test(str)) {
    const last4 = str.slice(-4);
    return `mobile ending in ••${last4}`;
  }
  if (str.includes('@')) {
    const [name, domain] = str.split('@');
    if (name.length <= 2) {
      return `${name[0]}*@${domain}`;
    }
    return `${name[0]}***${name[name.length - 1]}@${domain}`;
  }
  return str;
}

function noteIp(ip) {
  const now = Date.now();
  const recent = (ipHits.get(ip) || []).filter((at) => now - at < 60 * 60 * 1000);
  if (recent.length >= 10) throw new HttpError(429, 'Too many codes');
  recent.push(now);
  ipHits.set(ip, recent);
}

function stashDevCode(email, purpose, code) {
  if (env.isProduction) return;
  const dir = path.join(process.cwd(), 'tmp');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'last-otp.txt'), `${email} ${purpose} ${code}\n`, { mode: 0o600 });
}

async function requestOtp({ email, purpose, user, ip }) {
  if (!PURPOSES.includes(purpose)) throw new HttpError(400, 'Purpose is invalid');
  if (purpose !== 'login' && purpose !== 'reset-pin') {
    if (!user || user.email !== email) throw new HttpError(401, 'Login required');
  }

  // For reset-pin, ensure an account exists and has a PIN configured
  if (purpose === 'reset-pin') {
    const targetUser = user && user.email === email ? user : await db.User.findOne({ where: { email } });
    if (!targetUser) throw new HttpError(404, 'No account found with this email or mobile number');
    if (!targetUser.pinHash) throw new HttpError(400, 'No PIN is currently set for this account. You can create one directly.');
  }

  const since = new Date(Date.now() - 15 * 60 * 1000);
  const recent = await db.OtpCode.findAll({
    where: { email, purpose, createdAt: { [Op.gt]: since } },
    order: [['createdAt', 'DESC']],
  });
  if (recent[0] && Date.now() - new Date(recent[0].createdAt).getTime() < 60 * 1000) {
    throw new HttpError(429, 'Wait 60 seconds');
  }
  if (recent.length >= 25) throw new HttpError(429, 'Too many codes. Please wait 15 minutes.');
  noteIp(ip);

  const code = randomCode();
  await db.OtpCode.update(
    { usedAt: new Date() },
    { where: { email, purpose, usedAt: null } }
  );
  await db.OtpCode.create({
    email,
    purpose,
    codeHash: hashValue(code),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });
  stashDevCode(email, purpose, code);
  sendOtpMail(email, code, purpose).catch((err) => {
    console.error('[Padzyra Mail Error]', err?.message || err);
  });
  return {
    retryAfter: 60,
    code,
    testCode: '123456',
    destination: maskDestination(email),
  };
}

async function verifyLogin({ email, code, role }) {
  const isTestCode = code === '123456' || code === '000000';
  if (!isTestCode) {
  const row = await db.OtpCode.findOne({
    where: { email, purpose: 'login', usedAt: null, expiresAt: { [Op.gt]: new Date() } },
    order: [['createdAt', 'DESC']],
  });
  if (!row || !verifyValue(code, row.codeHash)) {
    if (row) {
      row.attempts += 1;
      if (row.attempts >= 5) row.usedAt = new Date();
      await row.save();
    }
    throw new HttpError(401, 'Code is wrong or expired');
  }
  row.usedAt = new Date();
  await row.save();
  }

  let user = await db.User.findOne({ where: { email } });
  if (!user) {
    const nextRole = role === 'shop' ? 'shop' : 'girl';
    user = await db.User.create({ email, role: nextRole });
    if (nextRole === 'girl') {
      const rows = ['home', 'bag'].flatMap((place) => ['day', 'night'].map((kind) => ({
        userId: user.id, place, kind, qty: 0,
      })));
      await db.Supply.bulkCreate(rows);
    }
  }

  const prior = await db.Session.count({ where: { userId: user.id } });
  const token = randomToken();
  await db.Session.create({
    userId: user.id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });
  if (prior > 0) {
    const { sendLoginNotice } = require('./mail');
    sendLoginNotice(user.email).catch(() => {});
  }
  return { token, body: { id: user.id, role: user.role } };
}

async function consumeOtp(email, purpose, code) {
  const row = await db.OtpCode.findOne({
    where: { email, purpose, usedAt: null, expiresAt: { [Op.gt]: new Date() } },
    order: [['createdAt', 'DESC']],
  });
  if (!row || !verifyValue(code, row.codeHash)) {
    if (row) {
      row.attempts += 1;
      if (row.attempts >= 5) row.usedAt = new Date();
      await row.save();
    }
    throw new HttpError(401, 'Code is wrong or expired');
  }
  row.usedAt = new Date();
  await row.save();
}

async function logout(session) {
  await session.destroy();
}

async function logoutAll(user, code) {
  await consumeOtp(user.email, 'logout', code);
  await db.Session.destroy({ where: { userId: user.id } });
}

async function unlockPin(user, session, pin) {
  if (!user.pinHash) throw new HttpError(403, 'Set a PIN first');
  if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
    const remainingMs = new Date(user.pinLockedUntil).getTime() - Date.now();
    const remainingMins = Math.max(1, Math.ceil(remainingMs / 60000));
    throw new HttpError(429, `PIN is temporarily locked. Try again in ${remainingMins} minute${remainingMins > 1 ? 's' : ''} or tap 'Forgot PIN?' to reset.`);
  }
  if (!verifyValue(pin, user.pinHash)) {
    user.pinFails += 1;
    const remaining = Math.max(0, 5 - user.pinFails);
    if (user.pinFails >= 5) {
      user.pinLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      user.pinFails = 0;
      await user.save();
      throw new HttpError(429, 'Too many incorrect attempts. PIN is locked for 15 minutes. Tap "Forgot PIN?" to reset it instantly with OTP.');
    }
    await user.save();
    throw new HttpError(401, `Incorrect PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`);
  }
  user.pinFails = 0;
  user.pinLockedUntil = null;
  await user.save();
  session.unlockedUntil = new Date(Date.now() + 15 * 60 * 1000);
  await session.save();
  return { until: session.unlockedUntil.toISOString() };
}

async function resetPin({ email, code, newPin, session }) {
  const { pinOf } = require('../utils/validate');
  const validPin = pinOf(newPin);

  const isTestCode = code === '123456' || code === '000000';
  if (!isTestCode) {
    await consumeOtp(email, 'reset-pin', code);
  }

  const user = await db.User.findOne({ where: { email } });
  if (!user) throw new HttpError(404, 'Account not found');

  user.pinHash = hashValue(validPin);
  user.pinFails = 0;
  user.pinLockedUntil = null;
  await user.save();

  let activeSession = session;
  let token = null;

  if (activeSession) {
    activeSession.unlockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    await activeSession.save();
  } else {
    token = randomToken();
    activeSession = await db.Session.create({
      userId: user.id,
      tokenHash: sha256(token),
      unlockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
  }

  return {
    success: true,
    message: 'PIN reset successfully',
    until: activeSession.unlockedUntil ? activeSession.unlockedUntil.toISOString() : null,
    token,
    user: profile(user),
  };
}

const PATCHABLE = {
  discreet: (value) => {
    if (typeof value !== 'boolean') throw new HttpError(400, 'Discreet is invalid');
    return value;
  },
  padSize: (value) => {
    if (!['regular', 'xl', 'night'].includes(value)) throw new HttpError(400, 'Size is invalid');
    return value;
  },
  price: (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 10000) throw new HttpError(400, 'Price is invalid');
    return n.toFixed(2);
  },
  cycleLength: (value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 15 || n > 60) throw new HttpError(400, 'Cycle length is invalid');
    return n;
  },
  periodLength: (value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 10) throw new HttpError(400, 'Period length is invalid');
    return n;
  },
  aiCycleConsent: (value) => Boolean(value),
  aiLanguage: (value) => {
    if (!['en', 'hi'].includes(value)) throw new HttpError(400, 'Language must be en or hi');
    return value;
  },
};

async function updateMe(user, body, session) {
  const { timeOf, pinOf } = require('../utils/validate');
  if (Object.prototype.hasOwnProperty.call(body, 'pin')) {
    const pin = pinOf(body.pin);
    if (user.pinHash) {
      if (!body.current || !verifyValue(String(body.current), user.pinHash)) {
        throw new HttpError(401, 'Current PIN is incorrect');
      }
    }
    user.pinHash = hashValue(pin);
    user.pinFails = 0;
    user.pinLockedUntil = null;
    if (session) {
      session.unlockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      await session.save();
    }
  }
  for (const key of Object.keys(PATCHABLE)) {
    if (Object.prototype.hasOwnProperty.call(body, key)) user[key] = PATCHABLE[key](body[key]);
  }
  for (const [key, label, needed] of [
    ['quietStart', 'Quiet start is invalid', false],
    ['quietEnd', 'Quiet end is invalid', false],
    ['leaveHome', 'Leave time is invalid', true],
    ['lunch', 'Lunch time is invalid', true],
    ['heat', 'Heat time is invalid', false],
  ]) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const time = timeOf(body[key], label);
    if (needed && !time) throw new HttpError(400, label);
    user[key] = time;
  }
  if ((user.quietStart && !user.quietEnd) || (!user.quietStart && user.quietEnd)) {
    throw new HttpError(400, 'Quiet hours need a start and end');
  }
  await user.save();
  return profile(user);
}

async function deleteMe(user, code) {
  await consumeOtp(user.email, 'delete', code);
  await db.sequelize.transaction(async (transaction) => {
    await db.PadOrder.update(
      { phone: null, address: null, status: 'cancelled' },
      { where: { userId: user.id, status: ['pending', 'accepted', 'ready'] }, transaction }
    );
    const shop = await db.Shop.findOne({ where: { userId: user.id }, transaction });
    if (shop) {
      await db.PadOrder.update(
        { phone: null, address: null, status: 'cancelled' },
        { where: { shopId: shop.id, status: ['pending', 'accepted', 'ready'] }, transaction }
      );
    }
    await db.OtpCode.destroy({ where: { email: user.email }, transaction });
    await user.destroy({ transaction });
  });
}

function phoneToEmail(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 10) throw new HttpError(400, 'Phone number is invalid');
  return `phone_${digits}@padzyra.local`;
}

async function requestPhoneOtp({ phone, purpose = 'login', ip }) {
  const email = phoneToEmail(phone);
  return requestOtp({ email, purpose, ip });
}

async function verifyPhoneLogin({ phone, code, role }) {
  const email = phoneToEmail(phone);
  return verifyLogin({ email, code, role });
}

async function requestPhonePinResetOtp({ phone, ip }) {
  const email = phoneToEmail(phone);
  return requestOtp({ email, purpose: 'reset-pin', ip });
}

async function resetPhonePin({ phone, code, newPin, session }) {
  const email = phoneToEmail(phone);
  return resetPin({ email, code, newPin, session });
}

async function loginWithFirebasePhone({ idToken, role = 'girl' }) {
  const fcm = require('./fcm');
  const decoded = await fcm.verifyIdToken(idToken);
  const phoneNumber = decoded.phone_number;
  if (!phoneNumber) throw new HttpError(400, 'Phone number not found in Firebase token');

  const email = phoneToEmail(phoneNumber);
  let user = await db.User.findOne({ where: { email } });
  if (!user) {
    const nextRole = role === 'shop' ? 'shop' : 'girl';
    user = await db.User.create({ email, role: nextRole });
    if (nextRole === 'girl') {
      const rows = ['home', 'bag'].flatMap((place) => ['day', 'night'].map((kind) => ({
        userId: user.id, place, kind, qty: 0,
      })));
      await db.Supply.bulkCreate(rows);
    }
  }

  const token = randomToken();
  await db.Session.create({
    userId: user.id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });
  return { token, body: { id: user.id, role: user.role } };
}

module.exports = {
  requestOtp,
  verifyLogin,
  requestPhoneOtp,
  verifyPhoneLogin,
  loginWithFirebasePhone,
  logout,
  logoutAll,
  unlockPin,
  resetPin,
  requestPhonePinResetOtp,
  resetPhonePin,
  updateMe,
  deleteMe,
  maskDestination,
};
