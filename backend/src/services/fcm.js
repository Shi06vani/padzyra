const fs = require('fs');
const path = require('path');
const db = require('../models');

let firebaseApp = null;
let messagingClient = null;
let authClient = null;
let initAttempted = false;

function initFirebase() {
  if (initAttempted) {
    return { app: firebaseApp, messaging: messagingClient, auth: authClient };
  }
  initAttempted = true;

  let initializeApp, cert, getApps;
  let getMessaging;
  let getAuth;

  try {
    const adminApp = require('firebase-admin/app');
    initializeApp = adminApp.initializeApp;
    cert = adminApp.cert;
    getApps = adminApp.getApps;

    const adminMessaging = require('firebase-admin/messaging');
    getMessaging = adminMessaging.getMessaging;

    const adminAuth = require('firebase-admin/auth');
    getAuth = adminAuth.getAuth;
  } catch (err) {
    console.warn('[Padzyra Firebase] firebase-admin package is not available or failed to load:', err.message);
    return { app: null, messaging: null, auth: null };
  }

  // Already initialized?
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    try {
      messagingClient = getMessaging(firebaseApp);
      authClient = getAuth(firebaseApp);
      console.log('[Padzyra Firebase] Connected to existing Firebase app instance.');
      return { app: firebaseApp, messaging: messagingClient, auth: authClient };
    } catch (e) {
      console.warn('[Padzyra Firebase] Failed to hook into existing app:', e.message);
    }
  }

  // Option 1: File path to serviceAccountKey.json
  const candidatePaths = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.resolve(__dirname, '../../serviceAccountKey.json'),
    path.resolve(process.cwd(), 'serviceAccountKey.json'),
    path.resolve(process.cwd(), 'backend/serviceAccountKey.json'),
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    try {
      const fullPath = path.isAbsolute(candidate)
        ? candidate
        : path.resolve(process.cwd(), candidate);

      if (fs.existsSync(fullPath)) {
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        const serviceAccount = JSON.parse(fileContent);

        if (serviceAccount && serviceAccount.project_id && serviceAccount.private_key) {
          firebaseApp = initializeApp({
            credential: cert(serviceAccount),
          });
          messagingClient = getMessaging(firebaseApp);
          authClient = getAuth(firebaseApp);
          console.log(`[Padzyra Firebase] Successfully initialized using service account (${serviceAccount.project_id}) from ${fullPath}`);
          return { app: firebaseApp, messaging: messagingClient, auth: authClient };
        }
      }
    } catch (err) {
      console.warn(`[Padzyra Firebase] Error trying path "${candidate}":`, err.message);
    }
  }

  // Option 2: Environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    try {
      privateKey = privateKey.replace(/\\n/g, '\n');
      firebaseApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      messagingClient = getMessaging(firebaseApp);
      authClient = getAuth(firebaseApp);
      console.log('[Padzyra Firebase] Initialized using environment credentials.');
      return { app: firebaseApp, messaging: messagingClient, auth: authClient };
    } catch (err) {
      console.warn('[Padzyra Firebase] Error initializing with env credentials:', err.message);
    }
  }

  console.log('[Padzyra Firebase] (Dev mode fallback) No credentials configured. Push notifications simulated.');
  return { app: null, messaging: null, auth: null };
}

/**
 * Returns Firebase Admin app instance if available
 */
function getAdmin() {
  const { app } = initFirebase();
  return app;
}

/**
 * Send push notification to one or more FCM tokens
 */
async function sendFcmPush({ tokens = [], title, body, data = {} }) {
  if (!tokens || tokens.length === 0) return { successCount: 0, failureCount: 0 };

  const { messaging } = initFirebase();
  if (!messaging) {
    console.log(`[Padzyra FCM Simulation] Title: "${title}" | Body: "${body}" | Tokens: ${tokens.length}`);
    return { successCount: tokens.length, failureCount: 0, simulated: true };
  }

  const message = {
    notification: {
      title,
      body,
    },
    data: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v ?? '')])
    ),
    android: {
      priority: 'high',
      notification: {
        channelId: 'padzyra_reminders',
        sound: 'default',
        icon: 'ic_notification',
        color: '#c98cb0',
        priority: 'high',
        defaultSound: true,
        defaultVibrateTimings: true,
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
          contentAvailable: true,
        },
      },
    },
    tokens,
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    console.log(`[Padzyra FCM] Sent to ${tokens.length} device(s): ${response.successCount} success, ${response.failureCount} failed.`);

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
        console.log(`[Padzyra FCM] Cleaned up ${tokensToRemove.length} invalid/unregistered token(s).`);
      }
    }

    return response;
  } catch (err) {
    console.error('[Padzyra FCM Error]', err?.message || err);
    return { successCount: 0, failureCount: tokens.length, error: err.message };
  }
}

/**
 * Send FCM push notification to all active devices of a user
 */
async function sendToUser(userId, { title, body, data = {} }) {
  const tokenRows = await db.FcmToken.findAll({ where: { userId } });
  if (!tokenRows || tokenRows.length === 0) {
    console.log(`[Padzyra FCM] No registered FCM tokens for user ${userId}.`);
    return { successCount: 0, failureCount: 0, noTokens: true };
  }
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
  console.log(`[Padzyra FCM] Token registered for user ${userId} (${platform}).`);
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
  const { auth } = initFirebase();
  if (!auth) {
    throw new Error('Firebase Admin SDK is not configured for token verification');
  }
  return auth.verifyIdToken(idToken);
}

module.exports = {
  getAdmin,
  initFirebase,
  sendFcmPush,
  sendToUser,
  registerToken,
  removeToken,
  verifyIdToken,
};
