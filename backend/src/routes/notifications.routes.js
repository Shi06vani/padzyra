const express = require('express');
const db = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { send, sendEmpty } = require('../utils/respond');
const { required, oneOf, pointOf } = require('../utils/validate');
const { requireRole, requirePin } = require('../middleware/auth');
const { nextAlert, actWithToken, dispatchAllAlerts, sendDirectReminder } = require('../services/alerts');
const { startToday, endToday, usePad } = require('../services/period');
const env = require('../config/env');

const router = express.Router();

router.get('/notifications/today', requireRole('girl'), asyncHandler(async (req, res) => {
  send(res, await nextAlert(req.auth.user));
}));

router.get('/push/key', (req, res) => {
  if (!env.vapidPublic) {
    sendEmpty(res);
    return;
  }
  send(res, { publicKey: env.vapidPublic });
});

router.post('/notifications/started', requireRole('girl'), requirePin, asyncHandler(async (req, res) => {
  const point = pointOf(req.body || {});
  send(res, await startToday(req.auth.user, point.lat, point.lng), 201);
}));

router.post('/notifications/ended', requireRole('girl'), requirePin, asyncHandler(async (req, res) => {
  send(res, await endToday(req.auth.user));
}));

router.post('/notifications/used', requireRole('girl'), requirePin, asyncHandler(async (req, res) => {
  const point = pointOf(req.body || {});
  const place = req.body.place || 'bag';
  const kind = req.body.kind || 'day';
  send(res, await usePad(req.auth.user, place, kind, point.lat, point.lng));
}));

router.post('/notifications/done', requireRole('girl'), requirePin, (req, res) => {
  sendEmpty(res);
});

router.post('/notifications/dispatch', asyncHandler(async (req, res) => {
  const dispatched = await dispatchAllAlerts();
  send(res, { dispatched: dispatched.length });
}));

router.post('/notifications/act', asyncHandler(async (req, res) => {
  const point = pointOf(req.body);
  const data = await actWithToken({
    token: String(required(req.body.token, 'Token is required')),
    action: oneOf(req.body.action, ['started', 'used', 'done'], 'Action is invalid'),
    place: req.body.place,
    kind: req.body.kind,
    lat: point.lat,
    lng: point.lng,
  });
  if (data == null) {
    sendEmpty(res);
    return;
  }
  send(res, data);
}));

const handlePush = asyncHandler(async (req, res) => {
  const endpoint = String(required(req.body.endpoint, 'Endpoint is required'));
  const p256dh = String(required(req.body.p256dh, 'Push key is required'));
  const auth = String(required(req.body.auth, 'Push key is required'));
  const [row] = await db.PushSubscription.findOrCreate({
    where: { endpoint },
    defaults: { userId: req.auth.user.id, endpoint, p256dh, auth },
  });
  if (row.userId !== req.auth.user.id) {
    row.userId = req.auth.user.id;
    row.p256dh = p256dh;
    row.auth = auth;
    await row.save();
  }
  send(res, { id: row.id });
});

router.post('/push', requireRole('girl'), handlePush);
router.post('/push/subscribe', requireRole('girl'), handlePush);

const handleUnsubscribe = asyncHandler(async (req, res) => {
  const endpoint = req.body && req.body.endpoint;
  if (endpoint) {
    await db.PushSubscription.destroy({ where: { userId: req.auth.user.id, endpoint } });
  } else {
    await db.PushSubscription.destroy({ where: { userId: req.auth.user.id } });
  }
  sendEmpty(res);
});

router.delete('/push', requireRole('girl'), handleUnsubscribe);
router.delete('/push/subscribe', requireRole('girl'), handleUnsubscribe);

const fcm = require('../services/fcm');

router.post('/push/fcm', requireRole('girl'), asyncHandler(async (req, res) => {
  const token = String(required(req.body.token, 'FCM token is required'));
  const platform = req.body.platform === 'ios' ? 'ios' : 'android';
  const row = await fcm.registerToken(req.auth.user.id, token, platform);
  send(res, { id: row.id, token: row.token });
}));

router.delete('/push/fcm', requireRole('girl'), asyncHandler(async (req, res) => {
  await fcm.removeToken(req.auth.user.id, req.body && req.body.token);
  sendEmpty(res);
}));

router.get('/notifications/history', requireRole('girl'), requirePin, asyncHandler(async (req, res) => {
  const sends = await db.NotificationSend.findAll({
    where: { userId: req.auth.user.id },
    order: [['day', 'DESC'], ['createdAt', 'DESC']],
    limit: 30,
  });
  send(res, sends.map((s) => ({
    id: s.id,
    kind: s.kind,
    day: s.day,
    usedAt: s.usedAt,
    expiresAt: s.expiresAt,
    createdAt: s.createdAt,
  })));
}));

router.post('/notifications/reminder', requireRole('girl'), asyncHandler(async (req, res) => {
  const kind = req.body.kind || 'test';
  const customTitle = req.body.title;
  const customBody = req.body.body;
  const result = await sendDirectReminder(req.auth.user, { kind, customTitle, customBody });
  send(res, result, 201);
}));

router.post('/notifications/test', requireRole('girl'), asyncHandler(async (req, res) => {
  const result = await sendDirectReminder(req.auth.user, { kind: 'test' });
  send(res, result, 201);
}));

router.get('/notifications/fcm/status', requireRole('girl'), asyncHandler(async (req, res) => {
  const admin = fcm.getAdmin();
  const tokens = await db.FcmToken.findAll({ where: { userId: req.auth.user.id } });
  send(res, {
    firebaseInitialized: !!admin,
    tokensCount: tokens.length,
    tokens: tokens.map((t) => ({ id: t.id, platform: t.platform, registeredAt: t.createdAt })),
  });
}));

module.exports = router;

