const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { send, sendEmpty } = require('../utils/respond');
const { dateOf, optionalDate, oneOf, textOf, pointOf } = require('../utils/validate');
const { requireRole, requirePin } = require('../middleware/auth');
const period = require('../services/period');

const router = express.Router();
const girl = [requireRole('girl'), requirePin];

function cycleInput(body, partial) {
  const next = {};
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'start')) {
    next.start = dateOf(body.start, 'Start is invalid');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'end')) next.end = optionalDate(body.end, 'End is invalid');
  if (Object.prototype.hasOwnProperty.call(body, 'flow')) {
    next.flow = body.flow == null || body.flow === ''
      ? null
      : oneOf(body.flow, ['light', 'medium', 'heavy'], 'Flow is invalid');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'note')) next.note = textOf(body.note, 200, 'Note is too long');
  return next;
}

router.get('/cycles', girl, asyncHandler(async (req, res) => {
  send(res, await period.list(req.auth.user));
}));

router.get('/cycles/current', girl, asyncHandler(async (req, res) => {
  send(res, await period.currentCycle(req.auth.user));
}));

router.get('/cycles/calendar.ics', girl, asyncHandler(async (req, res) => {
  const icsData = await period.calendarIcs(req.auth.user);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="padzyra-cycles.ics"');
  res.send(icsData);
}));

router.get('/cycles/:id', girl, asyncHandler(async (req, res) => {
  send(res, await period.getOne(req.auth.user, req.params.id));
}));

router.post('/cycles', girl, asyncHandler(async (req, res) => {
  send(res, await period.create(req.auth.user, cycleInput(req.body)), 201);
}));

router.post('/cycles/start', girl, asyncHandler(async (req, res) => {
  const point = pointOf(req.body);
  send(res, await period.startToday(req.auth.user, point.lat, point.lng), 201);
}));

router.post('/cycles/end', girl, asyncHandler(async (req, res) => {
  send(res, await period.endToday(req.auth.user));
}));

router.patch('/cycles/:id', girl, asyncHandler(async (req, res) => {
  send(res, await period.update(req.auth.user, req.params.id, cycleInput(req.body, true)));
}));

router.delete('/cycles/:id', girl, asyncHandler(async (req, res) => {
  await period.remove(req.auth.user, req.params.id);
  sendEmpty(res);
}));

module.exports = router;
