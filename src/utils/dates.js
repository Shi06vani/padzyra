const env = require('../config/env');

function parts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: env.tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const bag = {};
  for (const piece of fmt.formatToParts(date)) {
    if (piece.type !== 'literal') bag[piece.type] = piece.value;
  }
  return bag;
}

function todayISO(date = new Date()) {
  const p = parts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function nowHM(date = new Date()) {
  const p = parts(date);
  return `${p.hour}:${p.minute}`;
}

function toMinutes(hm) {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

function diffDays(from, to) {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

function addDays(iso, days) {
  const ms = Date.parse(`${iso}T00:00:00Z`) + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function inQuiet(hm, start, end) {
  if (!start || !end) return false;
  if (start === end) return false;
  if (start < end) return hm >= start && hm < end;
  return hm >= start || hm < end;
}

function inWindow(hm, start, minutes) {
  if (!start) return false;
  const cur = toMinutes(hm);
  const from = toMinutes(start);
  const span = from + minutes;
  if (span < 24 * 60) return cur >= from && cur < span;
  return cur >= from || cur < span % (24 * 60);
}

function shiftHM(hm, minutes) {
  const total = (toMinutes(hm) + minutes) % (24 * 60);
  const wrapped = total < 0 ? total + 24 * 60 : total;
  const h = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const m = String(wrapped % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function monthStart(iso) {
  return `${iso.slice(0, 7)}-01`;
}

module.exports = {
  todayISO,
  nowHM,
  diffDays,
  addDays,
  inQuiet,
  inWindow,
  shiftHM,
  monthStart,
};
