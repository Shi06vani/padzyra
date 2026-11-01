const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const { requireUser } = require('../middleware/auth');
const subscriptionsService = require('../services/subscriptions');

const router = express.Router();

router.get('/subscriptions/plans', (req, res) => {
  send(res, subscriptionsService.getPlans());
});

router.get('/subscriptions/current', requireUser, asyncHandler(async (req, res) => {
  const current = await subscriptionsService.getCurrentSubscription(req.auth.user);
  send(res, current);
}));

router.post('/subscriptions/subscribe', requireUser, asyncHandler(async (req, res) => {
  const { planId, paymentMethod, transactionId } = req.body;
  const result = await subscriptionsService.subscribe(req.auth.user, {
    planId,
    paymentMethod,
    transactionId,
  });
  send(res, result);
}));

router.post('/subscriptions/create-order', requireUser, asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const order = await subscriptionsService.createOrder({ planId });
  send(res, order);
}));

router.post('/subscriptions/verify-payment', requireUser, asyncHandler(async (req, res) => {
  const { planId, paymentMethod, transactionId, orderId } = req.body;
  const result = await subscriptionsService.verifyPayment(req.auth.user, {
    planId,
    paymentMethod,
    transactionId,
    orderId,
  });
  send(res, result);
}));

router.get('/subscriptions/report', requireUser, asyncHandler(async (req, res) => {
  const report = await subscriptionsService.getDoctorReport(req.auth.user);
  send(res, report);
}));

router.post('/subscriptions/cancel', requireUser, asyncHandler(async (req, res) => {
  const result = await subscriptionsService.cancelSubscription(req.auth.user);
  send(res, result);
}));

module.exports = router;
