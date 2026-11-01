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

function getReminderMessage(kind, discreet = true) {
  if (discreet) {
    switch (kind) {
      case 'lunch':
        return {
          title: '🌸 Wellness Check-in',
          body: 'Midday hydration & posture reminder. Take a gentle 5-minute break!',
        };
      case 'night':
        return {
          title: '🌙 Evening Rest & Unwind',
          body: 'Time to refresh, sip warm water, and prepare for cozy sleep.',
        };
      case 'leave':
        return {
          title: '🎒 Quick Essentials Check',
          body: 'Heading out? Take a quick glance at your handbag essentials.',
        };
      case 'heat':
        return {
          title: '☕ Cozy Self-Care Time',
          body: 'Gentle warmth alert: Grab a hot drink or cozy warm pack.',
        };
      case 'laundry':
        return {
          title: '✨ Morning Refresh Routine',
          body: 'A quick morning tidy & pouch restock to start your day fresh.',
        };
      case 'heavy':
        return {
          title: '💧 Hydration & Pause',
          body: 'Take it easy today. Drink plenty of warm water and take short breaks.',
        };
      case 'eve':
        return {
          title: '🌸 Tomorrow Prep',
          body: 'Keep your self-care comfort pouch ready for tomorrow.',
        };
      case 'pack':
        return {
          title: '👜 Pouch Readiness',
          body: 'Check that your travel pouch is stocked with daily wellness essentials.',
        };
      case 'pms':
        return {
          title: '🧘 Self-Care Reminder',
          body: 'Be extra kind to yourself today. Rest up and stay cozy.',
        };
      case 'late':
        return {
          title: '📝 Cycle Note',
          body: 'A quiet reminder to update your daily feelings in Padzyra.',
        };
      case 'move':
        return {
          title: '📦 Essentials Refresh',
          body: 'Time to transfer emergency supplies from home to your bag.',
        };
      case 'low':
        return {
          title: '⚠️ Supply Check',
          body: 'Your daily essentials pouch is running low. Time to replenish.',
        };
      case 'trip':
        return {
          title: '✈️ Travel Essentials',
          body: 'Check off your travel comfort items before heading out.',
        };
      case 'test':
        return {
          title: '🌸 Padzyra Wellness Reminder',
          body: 'Firebase Push Notification connected! Your discreet reminders are working.',
        };
      default:
        if (kind && String(kind).startsWith('chg')) {
          return {
            title: '🌸 Refresh & Hydrate',
            body: 'Gentle reminder to take a restroom break and refresh.',
          };
        }
        return {
          title: '🌸 Gentle Wellness Reminder',
          body: 'A quiet reminder, just for you. Listen to your body today.',
        };
    }
  }

  // Non-discreet (Direct) reminder
  switch (kind) {
    case 'lunch':
      return {
        title: '🔔 Lunchtime Pad Check',
        body: 'Midday check: Time to check or replace your sanitary pad.',
      };
    case 'night':
      return {
        title: '🌙 Night Pad Reminder',
        body: 'Switch to a night pad for complete overnight leak protection.',
      };
    case 'leave':
      return {
        title: '🎒 Before Leaving Home',
        body: 'Check your handbag! Make sure you have at least 2 spare pads.',
      };
    case 'heat':
      return {
        title: '🔥 Heat Compress Alert',
        body: 'Time for your hot water bottle or heating patch to soothe cramps.',
      };
    case 'laundry':
      return {
        title: '🧺 Period Ended: Restock & Laundry',
        body: 'Cycle completed. Restock your emergency pouch and refresh laundry.',
      };
    case 'heavy':
      return {
        title: '⚠️ Heavy Flow Day Reminder',
        body: 'Heavy flow day: Remember to change your pad every 3 to 4 hours.',
      };
    case 'eve':
      return {
        title: '🩸 Period Expected Tomorrow',
        body: 'Your period is due tomorrow. Place emergency pads in your handbag.',
      };
    case 'pack':
      return {
        title: '🎒 Period Expected in 2 Days',
        body: 'Pack your pouch with day and night pads so you are prepared.',
      };
    case 'pms':
      return {
        title: '🌸 PMS Symptoms Tracker',
        body: 'PMS window: Track your cramps, mood, and keep pain relief handy.',
      };
    case 'late':
      return {
        title: '📅 Period Due Check-in',
        body: "Your period is past the expected date. Log today's status or symptoms.",
      };
    case 'move':
      return {
        title: '👜 Restock Bag from Home',
        body: 'Take 2 pads from your home box and put them into your handbag.',
      };
    case 'low':
      return {
        title: '🚨 Low Pad Stock Warning',
        body: 'Your pad supply is low! Restock at a nearby partner shop.',
      };
    case 'trip':
      return {
        title: '🧳 Trip Pad Checklist',
        body: 'You have travel scheduled during your period. Pack extra pads!',
      };
    case 'test':
      return {
        title: '🔔 Padzyra Reminder Test',
        body: 'Firebase Cloud Messaging push notification successfully received!',
      };
    default:
      if (kind && String(kind).startsWith('chg')) {
        return {
          title: '🔔 Pad Change Reminder',
          body: 'Time to change your sanitary pad for hygiene and freshness.',
        };
      }
      return {
        title: '🩸 Period Care Reminder',
        body: 'Padzyra cycle reminder: Check your pad, stay hydrated, and rest well.',
      };
  }
}

async function issue(user, kind, day, actions) {
  const existing = await db.NotificationSend.findOne({ where: { userId: user.id, kind, day } });
  const msg = getReminderMessage(kind, user.discreet !== false);
  if (existing) {
    if (existing.usedAt || existing.expiresAt <= new Date()) return null;
    return {
      title: msg.title,
      body: msg.body,
      kind,
      actions,
      token: decryptJson(existing.tokenEnc).token,
    };
  }
  const count = await db.NotificationSend.count({ where: { userId: user.id, day } });
  if (count >= 5) return null;
  const token = randomToken();
  await db.NotificationSend.create({
    userId: user.id,
    kind,
    day,
    tokenHash: sha256(token),
    tokenEnc: encryptJson({ token }),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
  return {
    title: msg.title,
    body: msg.body,
    kind,
    actions,
    token,
    fresh: true,
  };
}

async function nextAlert(user) {
  const state = await buildState(user);
  const hm = nowHM();
  const kind = pushKind(state, hm, user);
  if (kind) {
    const alert = await issue(user, kind, state.today, actionsFor(state));
    if (alert) {
      if (alert.fresh) deliver(user, alert).catch(() => {});
      return {
        title: alert.title,
        text: alert.body,
        kind: alert.kind,
        actions: alert.actions,
        token: alert.token,
      };
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
  return {
    title: follow.title,
    text: follow.body,
    kind: follow.kind,
    actions: follow.actions,
    token: follow.token,
  };
}

async function deliver(user, alert) {
  const msg = alert.body
    ? { title: alert.title, body: alert.body }
    : getReminderMessage(alert.kind, user.discreet !== false);

  // 1. Dispatch Firebase Cloud Messaging (FCM) Push Notification
  let fcmResult = null;
  try {
    fcmResult = await fcm.sendToUser(user.id, {
      title: msg.title,
      body: msg.body,
      data: {
        token: alert.token || '',
        kind: alert.kind || 'reminder',
        type: 'reminder',
        actions: (alert.actions || []).join(','),
      },
    });
    console.log(`[Padzyra Alert] FCM reminder dispatched for user ${user.id}:`, fcmResult);
  } catch (err) {
    console.error(`[Padzyra Alert] FCM error for user ${user.id}:`, err?.message || err);
  }

  // 2. Web Push / Email fallback
  const subs = await db.PushSubscription.findAll({ where: { userId: user.id } });
  if (!subs.length || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    await sendReminder(user.email, alert.token);
    return fcmResult;
  }
  let webpush;
  try {
    webpush = require('web-push');
  } catch (error) {
    await sendReminder(user.email, alert.token);
    return fcmResult;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:reminders@padzyra.local',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  const payload = JSON.stringify({
    title: msg.title,
    body: msg.body,
    token: alert.token,
    actions: alert.actions,
  });
  await Promise.all(subs.map((sub) => webpush.sendNotification({
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  }, payload).catch(() => sendReminder(user.email, alert.token))));

  return fcmResult;
}

/**
 * Send an immediate reminder notification through Firebase (and other channels)
 */
async function sendDirectReminder(user, { kind = 'test', customTitle, customBody, force = true }) {
  const state = await buildState(user);
  const msg = (customTitle && customBody)
    ? { title: customTitle, body: customBody }
    : getReminderMessage(kind, user.discreet !== false);

  const token = randomToken();
  const alertRecord = await db.NotificationSend.create({
    userId: user.id,
    kind,
    day: state.today,
    tokenHash: sha256(token),
    tokenEnc: encryptJson({ token }),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  const alert = {
    title: msg.title,
    body: msg.body,
    kind,
    token,
    actions: actionsFor(state),
  };

  const fcmResult = await deliver(user, alert);
  return {
    alertId: alertRecord.id,
    title: alert.title,
    body: alert.body,
    kind: alert.kind,
    fcmResult,
  };
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

module.exports = {
  nextAlert,
  actWithToken,
  dispatchAllAlerts,
  deliver,
  sendDirectReminder,
  getReminderMessage,
};
