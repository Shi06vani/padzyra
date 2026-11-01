const crypto = require('crypto');
const env = require('../config/env');

function key() {
  return crypto.createHash('sha256').update(env.appSecret).digest();
}

function hashValue(value) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(value), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

function verifyValue(value, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const next = crypto.scryptSync(String(value), salt, 32);
  const prev = Buffer.from(hash, 'hex');
  if (prev.length !== next.length) return false;
  return crypto.timingSafeEqual(prev, next);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function randomCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function encryptJson(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, body]).toString('base64');
}

function decryptJson(payload) {
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const body = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  const text = Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  return JSON.parse(text);
}

function shopCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

module.exports = {
  hashValue,
  verifyValue,
  sha256,
  randomToken,
  randomCode,
  encryptJson,
  decryptJson,
  shopCode,
};
