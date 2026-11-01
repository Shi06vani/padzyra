const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const { oneOf, intOf, pointOf } = require('../utils/validate');
const { requireRole, requirePin } = require('../middleware/auth');
const period = require('../services/period');
const { setQty, addBag, assertPlaceKind } = require('../services/stock');

const router = express.Router();
const girl = [requireRole('girl'), requirePin];

router.get('/supplies', girl, asyncHandler(async (req, res) => {
  send(res, await period.supplies(req.auth.user));
}));

router.get('/supplies/history', girl, asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  send(res, await period.padHistory(req.auth.user, limit));
}));

router.patch('/supplies', girl, asyncHandler(async (req, res) => {
  const place = oneOf(req.body.place, ['home', 'bag'], 'Place is invalid');
  const kind = oneOf(req.body.kind, ['day', 'night'], 'Kind is invalid');
  send(res, await setQty(req.auth.user.id, place, kind, intOf(req.body.qty, 'Quantity is invalid', { max: 200 })));
}));

router.post('/supplies/use', girl, asyncHandler(async (req, res) => {
  const place = oneOf(req.body.place || 'bag', ['home', 'bag'], 'Place is invalid');
  const kind = oneOf(req.body.kind || 'day', ['day', 'night'], 'Kind is invalid');
  assertPlaceKind(place, kind);
  const point = pointOf(req.body);
  send(res, await period.usePad(req.auth.user, place, kind, point.lat, point.lng));
}));

router.post('/supplies/pickup', girl, asyncHandler(async (req, res) => {
  const kind = oneOf(req.body.kind, ['day', 'night'], 'Kind is invalid');
  const qty = intOf(req.body.qty, 'Quantity is invalid', { min: 1, max: 50 });
  send(res, await addBag(req.auth.user, kind, qty));
}));

module.exports = router;
