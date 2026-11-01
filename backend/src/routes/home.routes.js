const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const { requireRole, requirePin } = require('../middleware/auth');
const { buildState } = require('../services/state');
const { dashboard, checklist } = require('../services/focus');
const { nowHM } = require('../utils/dates');
const period = require('../services/period');

const router = express.Router();
const girl = [requireRole('girl'), requirePin];

router.get('/dashboard', girl, asyncHandler(async (req, res) => {
  const state = await buildState(req.auth.user);
  send(res, dashboard(state, nowHM(), req.auth.user));
}));

router.get('/checklist', girl, asyncHandler(async (req, res) => {
  const state = await buildState(req.auth.user);
  send(res, checklist(state));
}));

router.get('/expense', girl, asyncHandler(async (req, res) => {
  send(res, await period.expense(req.auth.user));
}));

module.exports = router;
