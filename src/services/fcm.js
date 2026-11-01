const fs = require('fs');
const path = require('path');
const db = require('../models');

let adminInstance = null;
let initAttempted = false;

function getAdmin() {
  if (initAttempted) return adminInstance;
  initAttempted = true;

  let admin;
  try {
    admin = require('firebase-admin');
  } catch (err) {
    console.warn('[Padzyra Firebase] firebase-admin package is not available.');
    return null;
  }

  // Option 1: File path to serviceAccountKey.json
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    try {
      const fullPath = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.join(process.cwd(), serviceAccountPath);
      if (fs.existsSync(fullPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        adminInstance = admin;
        console.log('[Padzyra Firebase] Initialized using service account file.');
        return adminInstance;
      }
    } catch (err) {
      console.warn('[Padzyra Firebase] Error loading service account file:', err.message);
    }
  }

  // Option 2: Environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    try {
      privateKey = privateKey.replace(/\\n/g, '\n');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      adminInstance = admin;
      console.log('[Padzyra Firebase] Initialized using environment credentials.');
      return adminInstance;
    } catch (err) {
      console.warn('[Padzyra Firebase] Error initializing with env credentials:', err.message);
    }
  }

  console.log('[Padzyra Firebase] (Dev mode fallback) No credentials configured. Push notifications simulated.');
  return null;
}

/**
 * Send push notification to one or more FCM tokens
 */
async function sendFcmPush({ tokens = [], title, body, data = {} }) {
  if (!tokens || tokens.length === 0) return { successCount: 0, failureCount: 0 };
  const admin = getAdmin();
  if (!admin) {
    console.log(`[Padzyra FCM Simulation] Title: "${title}" | Body: "${body}" | Tokens: ${tokens.length}`);
    return { successCount: tokens.length, failureCount: 0 };
  }

  const message = {
    notification: {
      title,
      body,
    },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    ),
    android: {
      priority: 'high',
      notification: {
        channelId: 'padzyra_reminders',
        sound: 'default',
        icon: 'ic_notification',
        color: '#c98cb0',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
    tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    
    // Clean up expired/invalid tokens
    if (response.failureCount > 0) {
      const tokensToRemove = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            tokensToRemove.push(tokens[idx]);
          }
        }
      });

      if (tokensToRemove.length > 0) {
        await db.FcmToken.destroy({ where: { token: tokensToRemove } }).catch(() => {});
      }
    }

    return response;
  } catch (err) {
    console.error('[Padzyra FCM Error]', err?.message || err);
    return { successCount: 0, failureCount: tokens.length };
  }
}

/**
 * Send FCM push notification to all active devices of a user
 */
async function sendToUser(userId, { title, body, data = {} }) {
  const tokenRows = await db.FcmToken.findAll({ where: { userId } });
  if (!tokenRows || tokenRows.length === 0) return null;
  const tokens = tokenRows.map((r) => r.token);
  return sendFcmPush({ tokens, title, body, data });
}

/**
 * Register or update FCM token for user
 */
async function registerToken(userId, token, platform = 'android') {
  const [row] = await db.FcmToken.findOrCreate({
    where: { token },
    defaults: { userId, token, platform },
  });
  if (row.userId !== userId || row.platform !== platform) {
    row.userId = userId;
    row.platform = platform;
    await row.save();
  }
  return row;
}

/**
 * Remove an FCM token (e.g. on logout)
 */
async function removeToken(userId, token) {
  if (token) {
    return db.FcmToken.destroy({ where: { userId, token } });
  }
  return db.FcmToken.destroy({ where: { userId } });
}

/**
 * Verify Firebase ID Token for Phone Auth
 */
async function verifyIdToken(idToken) {
  const admin = getAdmin();
  if (!admin) {
    throw new Error('Firebase Admin SDK is not configured for token verification');
  }
  return admin.auth().verifyIdToken(idToken);
}

module.exports = {
  getAdmin,
  sendFcmPush,
  sendToUser,
  registerToken,
  removeToken,
  verifyIdToken,
};
