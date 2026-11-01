const { Op } = require('sequelize');
const db = require('../models');
const HttpError = require('../utils/httpError');
const { encryptJson, decryptJson } = require('../utils/cryptoBox');
const { addDays } = require('../utils/dates');
const { viewCycle, loadCycles, buildState, monthUses } = require('./state');
const { useOne } = require('./stock');
const { nearby } = require('./nearby');

function pack(body) {
  return encryptJson({
    start: body.start,
    end: body.end || null,
    flow: body.flow || null,
    note: body.note || null,
  });
}

async function owned(userId, id) {
  const row = await db.Cycle.findOne({ where: { id, userId } });
  if (!row) throw new HttpError(404, 'Cycle not found');
  return row;
}

async function list(user) {
  const cycles = await loadCycles(user.id);
  return cycles.sort((a, b) => b.start.localeCompare(a.start));
}

async function getOne(user, id) {
  const row = await owned(user.id, id);
  return viewCycle(row);
}

async function currentCycle(user) {
  const state = await buildState(user);
  return state.open || null;
}

async function create(user, body) {
  if (body.end && body.end < body.start) throw new HttpError(400, 'End is before start');
  if (!body.end) {
    const state = await buildState(user);
    if (state.open) throw new HttpError(409, 'Period already started');
  }
  const row = await db.Cycle.create({ userId: user.id, secret: pack(body) });
  return viewCycle(row);
}

async function update(user, id, body) {
  const row = await owned(user.id, id);
  const current = viewCycle(row);
  const next = {
    start: body.start || current.start,
    end: Object.prototype.hasOwnProperty.call(body, 'end') ? body.end : current.end,
    flow: Object.prototype.hasOwnProperty.call(body, 'flow') ? body.flow : current.flow,
    note: Object.prototype.hasOwnProperty.call(body, 'note') ? body.note : current.note,
  };
  if (next.end && next.end < next.start) throw new HttpError(400, 'End is before start');
  row.secret = pack(next);
  await row.save();
  return viewCycle(row);
}

async function remove(user, id) {
  const row = await owned(user.id, id);
  await row.destroy();
}

async function shopsIfEmpty(user, lat, lng, empty) {
  if (!empty) return {};
  if (lat == null || lng == null) return { needNow: true };
  return { shops: await nearby(user, { lat, lng }) };
}

async function startToday(user, lat, lng) {
  const state = await buildState(user);
  if (state.open) throw new HttpError(409, 'Period already started');
  const row = await db.Cycle.create({
    userId: user.id,
    secret: pack({ start: state.today }),
  });
  const extra = await shopsIfEmpty(user, lat, lng, state.bag === 0);
  return {
    id: row.id,
    start: state.today,
    day: 1,
    of: user.periodLength,
    until: addDays(state.today, user.periodLength - 1),
    ...extra,
  };
}

async function endToday(user) {
  const state = await buildState(user);
  if (!state.open) throw new HttpError(404, 'No open period');
  if (state.today < state.open.start) throw new HttpError(400, 'End is before start');
  const row = await db.Cycle.findByPk(state.open.id);
  row.secret = pack({ ...state.open, end: state.today });
  await row.save();
  return { id: row.id, end: state.today };
}

async function usePad(user, place, kind, lat, lng) {
  const result = await useOne(user, place, kind);
  const extra = await shopsIfEmpty(user, lat, lng, result.empty);
  return { place: result.place, kind: result.kind, qty: result.qty, ...extra };
}

async function expense(user) {
  const state = await buildState(user);
  const rows = await monthUses(user.id, state.today);
  const used = rows.filter((row) => row.reason === 'use').reduce((sum, row) => sum + row.qty, 0);
  const bought = rows.filter((row) => row.reason === 'pickup').reduce((sum, row) => sum + row.qty, 0);
  return {
    used,
    bought,
    amount: Number(((used + bought) * Number(user.price)).toFixed(2)),
  };
}

function formatTrip(trip) {
  return {
    id: trip.id,
    start: trip.startDate,
    end: trip.endDate,
    name: trip.name || null,
    destination: trip.destination || null,
    activities: Array.isArray(trip.activities) ? trip.activities : (trip.activities ? JSON.parse(trip.activities) : []),
    checklist: Array.isArray(trip.checklist) ? trip.checklist : (trip.checklist ? JSON.parse(trip.checklist) : []),
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}

async function listTrips(user) {
  const rows = await db.Trip.findAll({ where: { userId: user.id }, order: [['startDate', 'DESC']] });
  return rows.map(formatTrip);
}

async function addTrip(user, start, end, name = null, destination = null, activities = [], checklist = []) {
  if (end < start) throw new HttpError(400, 'End is before start');
  const existing = await db.Trip.findOne({
    where: {
      userId: user.id,
      startDate: start,
      endDate: end,
      ...(name ? { name } : {}),
    },
  });
  if (existing) {
    throw new HttpError(409, 'A trip with these dates already exists');
  }
  const trip = await db.Trip.create({
    userId: user.id,
    startDate: start,
    endDate: end,
    name: name || null,
    destination: destination || null,
    activities: Array.isArray(activities) ? activities : [],
    checklist: Array.isArray(checklist) ? checklist : [],
  });
  return formatTrip(trip);
}

async function getTrip(user, id) {
  const trip = await db.Trip.findOne({ where: { id, userId: user.id } });
  if (!trip) throw new HttpError(404, 'Trip not found');
  return formatTrip(trip);
}

async function updateTrip(user, id, updates = {}) {
  const trip = await db.Trip.findOne({ where: { id, userId: user.id } });
  if (!trip) throw new HttpError(404, 'Trip not found');

  const nextStart = updates.start || trip.startDate;
  const nextEnd = updates.end || trip.endDate;
  if (nextEnd < nextStart) throw new HttpError(400, 'End is before start');

  trip.startDate = nextStart;
  trip.endDate = nextEnd;
  if (updates.name !== undefined) trip.name = updates.name || null;
  if (updates.destination !== undefined) trip.destination = updates.destination || null;
  if (updates.activities !== undefined && Array.isArray(updates.activities)) {
    trip.activities = updates.activities;
  }
  if (updates.checklist !== undefined && Array.isArray(updates.checklist)) {
    trip.checklist = updates.checklist;
  }

  await trip.save();
  return formatTrip(trip);
}

async function removeTrip(user, id) {
  const trip = await db.Trip.findOne({ where: { id, userId: user.id } });
  if (!trip) throw new HttpError(404, 'Trip not found');
  await trip.destroy();
}

async function supplies(user) {
  const rows = await db.Supply.findAll({
    where: { userId: user.id },
    order: [['place', 'ASC'], ['kind', 'ASC']],
  });
  return rows.map((row) => ({ place: row.place, kind: row.kind, qty: row.qty }));
}

async function padHistory(user, limit = 50) {
  const rows = await db.PadUse.findAll({
    where: { userId: user.id },
    order: [['usedOn', 'DESC'], ['createdAt', 'DESC']],
    limit: Math.min(Number(limit) || 50, 200),
  });
  return rows.map((r) => ({
    id: r.id,
    usedOn: r.usedOn,
    place: r.place,
    kind: r.kind,
    qty: r.qty,
    reason: r.reason,
    createdAt: r.createdAt,
  }));
}

function toIcsDate(iso) {
  return iso.replace(/-/g, '');
}

async function calendarIcs(user) {
  const state = await buildState(user);
  const cycles = await loadCycles(user.id);
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Padzyra//Menstrual Tracker//EN',
    'CALSCALE:GREGORIAN',
  ];
  cycles.forEach((c) => {
    const startStamp = toIcsDate(c.start);
    const endIso = c.end ? addDays(c.end, 1) : addDays(c.start, 1);
    const endStamp = toIcsDate(endIso);
    lines.push(
      'BEGIN:VEVENT',
      `UID:cycle-${c.id}@padzyra`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${startStamp}`,
      `DTEND;VALUE=DATE:${endStamp}`,
      `SUMMARY:Period${c.flow ? ` (${c.flow})` : ''}`,
      `DESCRIPTION:${(c.note || 'Logged period').replace(/\n/g, ' ')}`,
      'END:VEVENT'
    );
  });
  if (state.estimate && state.estimate.start) {
    const estStart = toIcsDate(state.estimate.start);
    const estEndIso = state.estimate.end ? addDays(state.estimate.end, 1) : addDays(state.estimate.start, user.periodLength || 5);
    const estEnd = toIcsDate(estEndIso);
    lines.push(
      'BEGIN:VEVENT',
      `UID:estimate-${toIcsDate(state.today)}@padzyra`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${estStart}`,
      `DTEND;VALUE=DATE:${estEnd}`,
      'SUMMARY:Predicted Period',
      'DESCRIPTION:Estimated menstrual cycle period',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR', '');
  return lines.join('\r\n');
}

async function exportData(user) {
  if (user.role === 'shop') {
    const shop = await db.Shop.findOne({ where: { userId: user.id } });
    const ordersList = shop ? await db.PadOrder.findAll({ where: { shopId: shop.id } }) : [];
    return {
      exportedAt: new Date().toISOString(),
      profile: { email: user.email, role: user.role },
      shop: shop ? {
        id: shop.id,
        name: shop.name,
        code: shop.code,
        area: shop.area,
        address: shop.address,
        phone: shop.phone,
        lat: Number(shop.lat),
        lng: Number(shop.lng),
        opensAt: shop.opensAt,
        closesAt: shop.closesAt,
      } : null,
      orders: ordersList.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        kind: o.kind,
        size: o.size,
        qty: o.qty,
        status: o.status,
        createdAt: o.createdAt,
      })),
    };
  }

  const [userProfile, cyclesList, daysList, suppliesList, tripsList, ordersList] = await Promise.all([
    db.User.findByPk(user.id),
    loadCycles(user.id),
    db.DayLog.findAll({ where: { userId: user.id } }),
    db.Supply.findAll({ where: { userId: user.id } }),
    db.Trip.findAll({ where: { userId: user.id } }),
    db.PadOrder.findAll({ where: { userId: user.id }, include: [{ model: db.Shop }] }),
  ]);
  const daysData = daysList.map((row) => {
    const body = decryptJson(row.secret);
    return { date: body.date, cramps: body.cramps || null, mood: body.mood || null };
  });
  return {
    exportedAt: new Date().toISOString(),
    profile: {
      email: userProfile.email,
      role: userProfile.role,
      discreet: userProfile.discreet,
      cycleLength: userProfile.cycleLength,
      periodLength: userProfile.periodLength,
      quietStart: userProfile.quietStart,
      quietEnd: userProfile.quietEnd,
      leaveHome: userProfile.leaveHome,
      lunch: userProfile.lunch,
      heat: userProfile.heat,
      padSize: userProfile.padSize,
      price: Number(userProfile.price),
    },
    cycles: cyclesList,
    dayLogs: daysData,
    supplies: suppliesList.map((s) => ({ place: s.place, kind: s.kind, qty: s.qty })),
    trips: tripsList.map((t) => ({ id: t.id, start: t.startDate, end: t.endDate })),
    orders: ordersList.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      shop: o.Shop ? o.Shop.name : null,
      kind: o.kind,
      size: o.size,
      qty: o.qty,
      status: o.status,
      createdAt: o.createdAt,
    })),
  };
}

module.exports = {
  list,
  getOne,
  currentCycle,
  create,
  update,
  remove,
  startToday,
  endToday,
  usePad,
  expense,
  listTrips,
  getTrip,
  addTrip,
  updateTrip,
  removeTrip,
  supplies,
  padHistory,
  calendarIcs,
  exportData,
};
