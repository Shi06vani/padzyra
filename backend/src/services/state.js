const { Op } = require('sequelize');
const db = require('../models');
const { decryptJson } = require('../utils/cryptoBox');
const { todayISO } = require('../utils/dates');
const { summarize } = require('./predict');

function viewCycle(row) {
  const body = decryptJson(row.secret);
  return { id: row.id, start: body.start, end: body.end || null, flow: body.flow || null, note: body.note || null };
}

async function loadCycles(userId) {
  const rows = await db.Cycle.findAll({ where: { userId } });
  return rows.map(viewCycle);
}

function qty(rows, place, kind) {
  const row = rows.find((item) => item.place === place && item.kind === kind);
  return row ? row.qty : 0;
}

async function buildState(user) {
  const today = todayISO();
  const cycles = await loadCycles(user.id);
  const supplies = await db.Supply.findAll({ where: { userId: user.id } });
  const summary = summarize(cycles, user, today);
  const bag = qty(supplies, 'bag', 'day') + qty(supplies, 'bag', 'night');
  const home = qty(supplies, 'home', 'day') + qty(supplies, 'home', 'night');
  return {
    ...summary,
    today,
    supplies,
    bag,
    home,
    low: qty(supplies, 'bag', 'day') < 2 || qty(supplies, 'bag', 'night') < 2,
    move: bag === 0 && home > 0 ? Math.min(2, home) : 0,
  };
}

async function monthUses(userId, today) {
  return db.PadUse.findAll({
    where: {
      userId,
      usedOn: { [Op.gte]: `${today.slice(0, 7)}-01`, [Op.lte]: today },
    },
  });
}

module.exports = { viewCycle, loadCycles, buildState, monthUses, qty };
