const db = require('../models');
const env = require('../config/env');
const HttpError = require('../utils/httpError');
const { encryptJson, decryptJson, sha256 } = require('../utils/cryptoBox');
const { todayISO, addDays } = require('../utils/dates');
const { loadCycles } = require('./state');

const CRAMPS = ['none', 'mild', 'strong'];
const MOODS = ['calm', 'okay', 'low', 'irritable'];

function dayKey(userId, date) {
  return sha256(`${env.appSecret}:${userId}:${date}`);
}

function onCycleDay(cycles, date, today) {
  return cycles.some((cycle) => {
    const last = cycle.end || today;
    if (date >= cycle.start && date <= last && date <= today) return true;
    return date >= addDays(cycle.start, -5) && date < cycle.start && date <= today;
  });
}

function view(date, body) {
  const out = { date };
  if (body.cramps) out.cramps = body.cramps;
  if (body.mood) out.mood = body.mood;
  return out;
}

async function assertCycleDay(user, date) {
  const today = todayISO();
  if (date > today) throw new HttpError(400, 'Date is in the future');
  const cycles = await loadCycles(user.id);
  if (!onCycleDay(cycles, date, today)) throw new HttpError(400, 'Not a cycle day');
}

async function list(user, from, to) {
  const rows = await db.DayLog.findAll({ where: { userId: user.id } });
  return rows
    .map((row) => {
      const body = decryptJson(row.secret);
      return view(body.date, body);
    })
    .filter((item) => (!from || item.date >= from) && (!to || item.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date));
}

async function save(user, date, patch) {
  if (!Object.prototype.hasOwnProperty.call(patch, 'cramps') && !Object.prototype.hasOwnProperty.call(patch, 'mood')) {
    throw new HttpError(400, 'Cramps or mood is required');
  }
  await assertCycleDay(user, date);
  const key = dayKey(user.id, date);
  const row = await db.DayLog.findOne({ where: { userId: user.id, dayKey: key } });
  const current = row ? decryptJson(row.secret) : { date, cramps: null, mood: null };
  const next = {
    date,
    cramps: Object.prototype.hasOwnProperty.call(patch, 'cramps') ? patch.cramps : (current.cramps || null),
    mood: Object.prototype.hasOwnProperty.call(patch, 'mood') ? patch.mood : (current.mood || null),
  };
  if (!next.cramps && !next.mood) throw new HttpError(400, 'Cramps or mood is required');
  const secret = encryptJson(next);
  if (row) {
    row.secret = secret;
    await row.save();
  } else {
    await db.DayLog.create({ userId: user.id, dayKey: key, secret });
  }
  return view(date, next);
}

async function getOne(user, date) {
  const key = dayKey(user.id, date);
  const row = await db.DayLog.findOne({ where: { userId: user.id, dayKey: key } });
  if (!row) return { date, cramps: null, mood: null };
  const body = decryptJson(row.secret);
  return view(date, body);
}

async function remove(user, date) {
  const key = dayKey(user.id, date);
  const row = await db.DayLog.findOne({ where: { userId: user.id, dayKey: key } });
  if (!row) throw new HttpError(404, 'Day not found');
  await row.destroy();
}

module.exports = { CRAMPS, MOODS, onCycleDay, list, getOne, save, remove };
