const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const { oneOf, intOf, textOf, required } = require('../utils/validate');
const { requireRole, requirePin, requireUser } = require('../middleware/auth');
const orders = require('../services/orders');

const router = express.Router();

router.get('/orders', requireRole('girl'), requirePin, asyncHandler(async (req, res) => {
  send(res, await orders.myOrders(req.auth.user));
}));

router.get('/orders/:id', requireUser, requirePin, asyncHandler(async (req, res) => {
  send(res, await orders.getOrder(req.auth.user, req.params.id));
}));

router.post('/orders', requireRole('girl'), requirePin, asyncHandler(async (req, res) => {
  const rawKind = req.body.kind ? String(req.body.kind).trim().slice(0, 40) : 'day';
  const rawSize = req.body.size ? String(req.body.size).trim().slice(0, 40) : (req.auth.user.padSize || 'regular');

  send(res, await orders.createOrder(req.auth.user, {
    shopId: String(required(req.body.shopId, 'Shop is required')),
    kind: rawKind,
    size: rawSize,
    qty: intOf(req.body.qty == null ? 1 : req.body.qty, 'Quantity is invalid', { min: 1, max: 50 }),
    address: textOf(req.body.address, 160, 'Address is too long'),
    phone: req.body.phone ? textOf(req.body.phone, 20, 'Phone is too long') : null,
  }), 201);
}));

router.post('/orders/:id/picked-up', requireRole('girl'), requirePin, asyncHandler(async (req, res) => {
  send(res, await orders.pickUp(req.auth.user, req.params.id));
}));

router.post('/orders/:id/cancel', requireRole('girl'), requirePin, asyncHandler(async (req, res) => {
  send(res, await orders.cancelOrder(req.auth.user, req.params.id));
}));

router.get('/shops/orders', requireRole('shop'), asyncHandler(async (req, res) => {
  send(res, await orders.shopOrders(req.auth.user));
}));

router.patch('/shops/orders/:id', requireRole('shop'), asyncHandler(async (req, res) => {
  send(res, await orders.setStatus(
    req.auth.user,
    req.params.id,
    oneOf(req.body.status, ['accepted', 'ready', 'cancelled'], 'Status is invalid')
  ));
}));

module.exports = router;
