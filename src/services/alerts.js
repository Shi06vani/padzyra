const { Op } = require('sequelize');
const db = require('../models');
const HttpError = require('../utils/httpError');
const { encryptJson, decryptJson, randomToken, sha256 } = require('../utils/cryptoBox');
const { nowHM, addDays } = require('../utils/dates');
const { buildState } = require('./state');
const { pushKind } = require('./focus');
const { startToday, usePad } = require('./period');
const { assertPlaceKind } = require('./stock');
const { sendReminder } = require('./mail');
const fcm = require('./fcm');

function actionsFor(state) {
  const actions = ['used', 'done'];
  if (!state.inPeriod) actions.unshift('started');
  return actions;
}

async function issue(user, kind, day, actions) {
  const existing = await db.NotificationSend.findOne({ where: { userId: user.id, kind, day } });
  if (existing) {
    if (existing.usedAt || existing.expiresAt <= new Date()) return null;
    return { title: 'Reminder', actions, token: decryptJson(existing.tokenEnc).token };
  }
  const count = await db.NotificationSend.count({ where: { userId: user.id, day } });
  if (count >= 3) return null;
  const token = randomToken();
  await db.NotificationSend.create({
    userId: user.id,
    kind,
    day,
    tokenHash: sha256(token),
    tokenEnc: encryptJson({ token }),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  return { title: 'Reminder', actions, token, fresh: true };
}

async function nextAlert(user) {
  const state = await buildState(user);
  const hm = nowHM();
  const kind = pushKind(state, hm, user);
  if (kind) {
    const alert = await issue(user, kind, state.today, actionsFor(state));
    if (alert) {
      if (alert.fresh) deliver(user, alert).catch(() => {});
      return { title: alert.title, actions: alert.actions, token: alert.token };
    }
  }
  if (Number(hm.slice(0, 2)) < 17 || !state.low) return null;
  const prior = await db.NotificationSend.findOne({
    where: { userId: user.id, day: addDays(state.today, -1), kind: { [Op.in]: ['low', 'move'] } },
  });
  if (!prior) return null;
  const follow = await issue(user, 'follow', state.today, ['used', 'done']);
  if (!follow) return null;
  if (follow.fresh) deliver(user, follow).catch(() => {});
  return { title: follow.title, actions: follow.actions, token: follow.token };
}

async function deliver(user, alert) {
  // 1. Dispatch Firebase Cloud Messaging (FCM) Push Notification
  try {
    await fcm.sendToUser(user.id, {
      title: 'Reminder',
      body: 'Discreet check-in for your day.',
      data: {
        token: alert.token,
        actions: (alert.actions || []).join(','),
      },
    });
  } catch (err) {
    // Graceful fallback to other channels
  }

  const subs = await db.PushSubscription.findAll({ where: { userId: user.id } });
  if (!subs.length || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    await sendReminder(user.email, alert.token);
    return;
  }
  let webpush;
  try {
    webpush = require('web-push');
  } catch (error) {
    await sendReminder(user.email, alert.token);
    return;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:reminders@padzyra.local',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  const payload = JSON.stringify({ title: 'Reminder', token: alert.token, actions: alert.actions });
  await Promise.all(subs.map((sub) => webpush.sendNotification({
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  }, payload).catch(() => sendReminder(user.email, alert.token))));
}

async function actWithToken({ token, action, place, kind, lat, lng }) {
  const row = await db.NotificationSend.findOne({
    where: { tokenHash: sha256(token), usedAt: null, expiresAt: { [Op.gt]: new Date() } },
  });
  if (!row) throw new HttpError(401, 'Link is wrong or expired');
  const user = await db.User.findByPk(row.userId);
  if (!user) throw new HttpError(401, 'Link is wrong or expired');
  let data = null;
  if (action === 'started') data = await startToday(user, lat, lng);
  else if (action === 'used') {
    const usedPlace = place || 'bag';
    const usedKind = kind || 'day';
    assertPlaceKind(usedPlace, usedKind);
    data = await usePad(user, usedPlace, usedKind, lat, lng);
  }
  else if (action !== 'done') throw new HttpError(400, 'Action is invalid');
  row.usedAt = new Date();
  await row.save();
  return data;
}

async function dispatchAllAlerts() {
  const girls = await db.User.findAll({ where: { role: 'girl' } });
  const dispatched = [];
  for (const girl of girls) {
    try {
      const alert = await nextAlert(girl);
      if (alert) dispatched.push({ userId: girl.id, title: alert.title });
    } catch (err) {
      // ignore individual user dispatch errors
    }
  }
  return dispatched;
}

module.exports = { nextAlert, actWithToken, dispatchAllAlerts };
