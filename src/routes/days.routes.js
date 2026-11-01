const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { send, sendEmpty } = require('../utils/respond');
const { dateOf, oneOf } = require('../utils/validate');
const { requireRole, requirePin } = require('../middleware/auth');
const days = require('../services/days');

const router = express.Router();
const girl = [requireRole('girl'), requirePin];

function range(query) {
  const from = query.from ? dateOf(query.from, 'Date is invalid') : null;
  const to = query.to ? dateOf(query.to, 'Date is invalid') : null;
  if (from && to && to < from) throw new HttpError(400, 'End is before start');
  return { from, to };
}

function patchOf(body) {
  const next = {};
  if (Object.prototype.hasOwnProperty.call(body, 'cramps')) {
    next.cramps = body.cramps == null || body.cramps === ''
      ? null
      : oneOf(body.cramps, days.CRAMPS, 'Cramps is invalid');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'mood')) {
    next.mood = body.mood == null || body.mood === ''
      ? null
      : oneOf(body.mood, days.MOODS, 'Mood is invalid');
  }
  return next;
}

router.get('/days', girl, asyncHandler(async (req, res) => {
  const { from, to } = range(req.query);
  send(res, await days.list(req.auth.user, from, to));
}));

router.get('/days/:date', girl, asyncHandler(async (req, res) => {
  const date = dateOf(req.params.date, 'Date is invalid');
  send(res, await days.getOne(req.auth.user, date));
}));

router.put('/days/:date', girl, asyncHandler(async (req, res) => {
  const date = dateOf(req.params.date, 'Date is invalid');
  send(res, await days.save(req.auth.user, date, patchOf(req.body)));
}));

router.delete('/days/:date', girl, asyncHandler(async (req, res) => {
  await days.remove(req.auth.user, dateOf(req.params.date, 'Date is invalid'));
  sendEmpty(res);
}));

module.exports = router;
