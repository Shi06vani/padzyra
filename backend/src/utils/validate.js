const HttpError = require('./httpError');

function required(value, message) {
  if (value == null || value === '') throw new HttpError(400, message);
  return value;
}

function emailOf(value) {
  const email = String(required(value, 'Email is required')).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new HttpError(400, 'Email is invalid');
  }
  return email;
}

function codeOf(value) {
  const code = String(required(value, 'Code is required')).trim();
  if (!/^\d{6}$/.test(code)) throw new HttpError(400, 'Code is invalid');
  return code;
}

function pinOf(value) {
  const pin = String(required(value, 'PIN is required')).trim();
  if (!/^\d{4}$/.test(pin)) throw new HttpError(400, 'PIN must be 4 digits');
  return pin;
}

function dateOf(value, message) {
  const date = String(required(value, message));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new HttpError(400, message);
  }
  return date;
}

function optionalDate(value, message) {
  if (value == null || value === '') return null;
  return dateOf(value, message);
}

function timeOf(value, message) {
  if (value == null || value === '') return null;
  const time = String(value);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new HttpError(400, message);
  return time;
}

function oneOf(value, allowed, message) {
  if (!allowed.includes(value)) throw new HttpError(400, message);
  return value;
}

function intOf(value, message, { min = 0, max = 99 } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, message);
  return n;
}

function coord(value, message) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new HttpError(400, message);
  return n;
}

function pointOf(body) {
  const lat = coord(body.lat, 'Location is invalid');
  const lng = coord(body.lng, 'Location is invalid');
  if ((lat == null) !== (lng == null)) throw new HttpError(400, 'Location is invalid');
  if (lat != null && (lat < -90 || lat > 90 || lng < -180 || lng > 180)) {
    throw new HttpError(400, 'Location is invalid');
  }
  return { lat, lng };
}

function textOf(value, max, message) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) throw new HttpError(400, message);
  return text;
}

module.exports = {
  required,
  emailOf,
  codeOf,
  pinOf,
  dateOf,
  optionalDate,
  timeOf,
  oneOf,
  intOf,
  coord,
  pointOf,
  textOf,
};
