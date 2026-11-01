const db = require('../models');
const HttpError = require('../utils/httpError');
const { todayISO } = require('../utils/dates');

async function rowFor(userId, place, kind, transaction) {
  const found = await db.Supply.findOne({ where: { userId, place, kind }, transaction });
  if (found) return found;
  return db.Supply.create({ userId, place, kind, qty: 0 }, { transaction });
}

async function setQty(userId, place, kind, qty) {
  const row = await rowFor(userId, place, kind);
  row.qty = qty;
  await row.save();
  return { place, kind, qty: row.qty };
}

async function useOne(user, place, kind) {
  return db.sequelize.transaction(async (transaction) => {
    const row = await rowFor(user.id, place, kind, transaction);
    if (row.qty <= 0) return { place, kind, qty: 0, empty: true };
    row.qty -= 1;
    await row.save({ transaction });
    await db.PadUse.create({
      userId: user.id,
      usedOn: todayISO(),
      place,
      kind,
      qty: 1,
      reason: 'use',
    }, { transaction });
    return { place, kind, qty: row.qty, empty: row.qty === 0 && place === 'bag' };
  });
}

async function addBag(user, kind, qty) {
  return db.sequelize.transaction(async (transaction) => {
    const row = await rowFor(user.id, 'bag', kind, transaction);
    row.qty += qty;
    await row.save({ transaction });
    await db.PadUse.create({
      userId: user.id,
      usedOn: todayISO(),
      place: 'bag',
      kind,
      qty,
      reason: 'pickup',
    }, { transaction });
    return { place: 'bag', kind, qty: row.qty };
  });
}

function assertPlaceKind(place, kind) {
  if (!['home', 'bag'].includes(place)) throw new HttpError(400, 'Place is invalid');
  if (!['day', 'night'].includes(kind)) throw new HttpError(400, 'Kind is invalid');
}

module.exports = { setQty, useOne, addBag, assertPlaceKind };
