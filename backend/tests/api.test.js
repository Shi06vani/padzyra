const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const app = require('../src/app');
const db = require('../src/models');
const { verifyValue } = require('../src/utils/cryptoBox');

let server;
let baseUrl;

function readDevOtp(email) {
  const filePath = path.join(process.cwd(), 'tmp', 'last-otp.txt');
  const content = fs.readFileSync(filePath, 'utf8').trim().split('\n');
  const line = content.filter((l) => l.startsWith(email)).pop();
  if (!line) throw new Error(`OTP not found for ${email}`);
  return line.split(' ')[2];
}

async function req(urlPath, options = {}) {
  const headers = {
    'x-padzyra': '1',
    ...(options.headers || {}),
  };
  if (options.cookie) {
    headers.cookie = options.cookie;
  }
  if (options.body) {
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const cookie = res.headers.get('set-cookie');
  let data;
  if (res.status !== 204) {
    data = await res.json().catch(() => ({}));
  }
  return { status: res.status, ok: res.ok, data, cookie, headers: res.headers };
}

test.before(async () => {
  await db.sequelize.authenticate();
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api/v1`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Padzyra Comprehensive API Suite', async (t) => {
  const girlEmail = `girl_${Date.now()}@test.padzyra`;
  const shopEmail = `shop_${Date.now()}@test.padzyra`;
  let girlCookie = '';
  let shopCookie = '';
  let shopId = '';
  let shopCode = '';
  let cycleId = '';
  let orderId = '';
  let tripId = '';

  await t.test('1. Health and Root routes', async () => {
    const health = await req('/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.status, 'ok');

    const root = await req('/');
    assert.equal(root.status, 200);
    assert.equal(root.data.status, 'ok');

    const authStatus = await req('/auth/status');
    assert.equal(authStatus.status, 200);
    assert.equal(authStatus.data.data.authenticated, false);
  });

  await t.test('2. Auth OTP flow - Girl registration and login', async () => {
    const otpRes = await req('/auth/otp', {
      method: 'POST',
      body: { email: girlEmail },
    });
    assert.equal(otpRes.status, 200);
    assert.equal(otpRes.data.data.retryAfter, 60);

    // Resend within 60s should fail with 429
    const resendRes = await req('/auth/otp', {
      method: 'POST',
      body: { email: girlEmail },
    });
    assert.equal(resendRes.status, 429);

    const code = readDevOtp(girlEmail);
    assert.match(code, /^\d{6}$/);

    // Verify OTP
    const verifyRes = await req('/auth/verify', {
      method: 'POST',
      body: { email: girlEmail, code, role: 'girl' },
    });
    assert.equal(verifyRes.status, 200);
    assert.ok(verifyRes.cookie);
    assert.match(verifyRes.cookie, /pz=/);
    assert.match(verifyRes.cookie, /HttpOnly/i);
    assert.match(verifyRes.cookie, /SameSite=Strict/i);

    girlCookie = verifyRes.cookie.split(';')[0];

    // Check /me
    const meRes = await req('/me', { cookie: girlCookie });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.data.email, girlEmail);
    assert.equal(meRes.data.data.role, 'girl');
    assert.equal(meRes.data.data.pin, false);
  });

  await t.test('3. PIN Setup and Unlock', async () => {
    // Try accessing protected girl route before setting PIN
    const failPinReq = await req('/cycles', { cookie: girlCookie });
    assert.equal(failPinReq.status, 403);
    assert.equal(failPinReq.data.error.message, 'Set a PIN first');

    // Set PIN: 1234
    const setPinRes = await req('/me', {
      method: 'PATCH',
      cookie: girlCookie,
      body: { pin: '1234', price: 15.5 },
    });
    assert.equal(setPinRes.status, 200);
    assert.equal(setPinRes.data.data.pin, true);

    // Now accessing requires PIN unlock
    const needUnlockRes = await req('/cycles', { cookie: girlCookie });
    assert.equal(needUnlockRes.status, 403);
    assert.equal(needUnlockRes.data.error.message, 'PIN required');

    // Unlock PIN with correct code
    const unlockRes = await req('/auth/pin', {
      method: 'POST',
      cookie: girlCookie,
      body: { pin: '1234' },
    });
    assert.equal(unlockRes.status, 200);
    assert.ok(unlockRes.data.data.until);

    // Now protected girl routes succeed
    const cyclesRes = await req('/cycles', { cookie: girlCookie });
    assert.equal(cyclesRes.status, 200);
    assert.ok(Array.isArray(cyclesRes.data.data));

    const loggedAuthStatus = await req('/auth/status', { cookie: girlCookie });
    assert.equal(loggedAuthStatus.status, 200);
    assert.equal(loggedAuthStatus.data.data.authenticated, true);
    assert.equal(loggedAuthStatus.data.data.pinUnlocked, true);
    assert.equal(loggedAuthStatus.data.data.role, 'girl');
  });

  await t.test('4. Cycles Management (Start, End, Create, Update, Delete)', async () => {
    // One-tap start today
    const startRes = await req('/cycles/start', {
      method: 'POST',
      cookie: girlCookie,
      body: {},
    });
    assert.equal(startRes.status, 201);
    assert.equal(startRes.data.data.day, 1);
    cycleId = startRes.data.data.id;

    // Check active current cycle
    const currentCycleRes = await req('/cycles/current', { cookie: girlCookie });
    assert.equal(currentCycleRes.status, 200);
    assert.equal(currentCycleRes.data.data.id, cycleId);

    // Get single cycle by ID
    const singleCycleRes = await req(`/cycles/${cycleId}`, { cookie: girlCookie });
    assert.equal(singleCycleRes.status, 200);
    assert.equal(singleCycleRes.data.data.id, cycleId);

    // Calendar export (.ics)
    const icsRes = await req('/cycles/calendar.ics', { cookie: girlCookie });
    assert.equal(icsRes.status, 200);

    // One-tap end today
    const endRes = await req('/cycles/end', {
      method: 'POST',
      cookie: girlCookie,
    });
    assert.equal(endRes.status, 200);
    assert.ok(endRes.data.data.end);

    // Create a past cycle
    const createRes = await req('/cycles', {
      method: 'POST',
      cookie: girlCookie,
      body: {
        start: '2026-09-01',
        end: '2026-09-05',
        flow: 'medium',
        note: 'Exams and travel',
      },
    });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.data.data.note, 'Exams and travel');

    // Verify DB encryption: the secret column in DB must not contain plaintext note
    const dbCycle = await db.Cycle.findByPk(createRes.data.data.id);
    assert.ok(!dbCycle.secret.includes('Exams and travel'));

    // Edit cycle
    const patchRes = await req(`/cycles/${createRes.data.data.id}`, {
      method: 'PATCH',
      cookie: girlCookie,
      body: { note: 'Exams done, feeling calm' },
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.data.data.note, 'Exams done, feeling calm');

    // Delete cycle
    const deleteRes = await req(`/cycles/${createRes.data.data.id}`, {
      method: 'DELETE',
      cookie: girlCookie,
    });
    assert.equal(deleteRes.status, 204);
  });

  await t.test('5. Stock, Pad Usage, and Expense Tracking', async () => {
    // Set stock: Home (day: 10, night: 5), Bag (day: 4, night: 3)
    await req('/supplies', { method: 'PATCH', cookie: girlCookie, body: { place: 'home', kind: 'day', qty: 10 } });
    await req('/supplies', { method: 'PATCH', cookie: girlCookie, body: { place: 'home', kind: 'night', qty: 5 } });
    await req('/supplies', { method: 'PATCH', cookie: girlCookie, body: { place: 'bag', kind: 'day', qty: 4 } });
    await req('/supplies', { method: 'PATCH', cookie: girlCookie, body: { place: 'bag', kind: 'night', qty: 3 } });

    const suppliesRes = await req('/supplies', { cookie: girlCookie });
    assert.equal(suppliesRes.status, 200);
    const bagDay = suppliesRes.data.data.find((s) => s.place === 'bag' && s.kind === 'day');
    assert.equal(bagDay.qty, 4);

    // Use 1 pad from bag
    const useRes = await req('/supplies/use', {
      method: 'POST',
      cookie: girlCookie,
      body: { place: 'bag', kind: 'day' },
    });
    assert.equal(useRes.status, 200);
    assert.equal(useRes.data.data.qty, 3);

    // Expense check
    const expRes = await req('/expense', { cookie: girlCookie });
    assert.equal(expRes.status, 200);
    assert.ok(expRes.data.data.used >= 1);
    assert.ok(expRes.data.data.amount > 0);

    // Supplies usage history check
    const histRes = await req('/supplies/history', { cookie: girlCookie });
    assert.equal(histRes.status, 200);
    assert.ok(Array.isArray(histRes.data.data));
    assert.ok(histRes.data.data.some((item) => item.place === 'bag' && item.reason === 'use'));
  });

  await t.test('6. Dashboard, Checklist, Trips, and Days Feeling', async () => {
    const dashRes = await req('/dashboard', { cookie: girlCookie });
    assert.equal(dashRes.status, 200);
    assert.ok(dashRes.data.data.bag !== undefined);

    // Add trip
    const tripRes = await req('/trips', {
      method: 'POST',
      cookie: girlCookie,
      body: { start: '2026-10-25', end: '2026-10-28' },
    });
    assert.equal(tripRes.status, 201);
    tripId = tripRes.data.data.id;

    // Get single trip
    const getTripRes = await req(`/trips/${tripId}`, { cookie: girlCookie });
    assert.equal(getTripRes.status, 200);
    assert.equal(getTripRes.data.data.start, '2026-10-25');

    // Patch trip
    const patchTripRes = await req(`/trips/${tripId}`, {
      method: 'PATCH',
      cookie: girlCookie,
      body: { end: '2026-10-29' },
    });
    assert.equal(patchTripRes.status, 200);
    assert.equal(patchTripRes.data.data.end, '2026-10-29');

    // Checklist should include 'Extra pads' due to upcoming trip
    const checkRes = await req('/checklist', { cookie: girlCookie });
    assert.equal(checkRes.status, 200);
    assert.ok(checkRes.data.data.includes('Extra pads'));
    assert.ok(checkRes.data.data.includes('Day pad'));
    assert.ok(checkRes.data.data.includes('Hot water bag'));

    // Remove trip
    const delTrip = await req(`/trips/${tripId}`, { method: 'DELETE', cookie: girlCookie });
    assert.equal(delTrip.status, 204);

    // Day log GET single date test
    const getDayRes = await req('/days/2026-10-25', { cookie: girlCookie });
    assert.equal(getDayRes.status, 200);
    assert.equal(getDayRes.data.data.date, '2026-10-25');
  });

  await t.test('7. Push and 15-Minute Opaque Notification Action Link', async () => {
    // Push key (200 if configured, 204 if VAPID keys not set)
    const keyRes = await req('/push/key');
    assert.ok(keyRes.status === 200 || keyRes.status === 204);

    // Subscribe to push
    const pushRes = await req('/push/subscribe', {
      method: 'POST',
      cookie: girlCookie,
      body: { endpoint: 'https://push.example.com/sub/123', p256dh: 'test-p256', auth: 'test-auth' },
    });
    assert.equal(pushRes.status, 200);
    assert.ok(pushRes.data.data.id);

    // Trigger dispatch
    const dispatchRes = await req('/notifications/dispatch', { method: 'POST' });
    assert.equal(dispatchRes.status, 200);

    // Query notification
    const alertRes = await req('/notifications/today', { cookie: girlCookie });
    assert.equal(alertRes.status, 200);
    if (alertRes.data.data && alertRes.data.data.token) {
      const token = alertRes.data.data.token;
      // Act with opaque token without session cookie
      const actRes = await req('/notifications/act', {
        method: 'POST',
        body: { token, action: 'done' },
      });
      assert.equal(actRes.status, 204);

      // Re-using same token should fail (single use)
      const reuseRes = await req('/notifications/act', {
        method: 'POST',
        body: { token, action: 'done' },
      });
      assert.equal(reuseRes.status, 401);
    }

    // Notifications history
    const historyRes = await req('/notifications/history', { cookie: girlCookie });
    assert.equal(historyRes.status, 200);
    assert.ok(Array.isArray(historyRes.data.data));

    // Unsubscribe push
    const unsubRes = await req('/push', {
      method: 'DELETE',
      cookie: girlCookie,
    });
    assert.equal(unsubRes.status, 204);
  });

  await t.test('8. Medical Shop Registration and Need One Now', async () => {
    // 1. Shop login OTP
    await req('/auth/otp', { method: 'POST', body: { email: shopEmail } });
    const shopOtp = readDevOtp(shopEmail);
    const shopVerify = await req('/auth/verify', {
      method: 'POST',
      body: { email: shopEmail, code: shopOtp, role: 'shop' },
    });
    assert.equal(shopVerify.status, 200);
    shopCookie = shopVerify.cookie.split(';')[0];

    // Shop user cannot read cycles
    const shopCycleFail = await req('/cycles', { cookie: shopCookie });
    assert.equal(shopCycleFail.status, 403);
    assert.equal(shopCycleFail.data.error.message, 'Wrong account');

    // Register Shop
    const createShopRes = await req('/shops', {
      method: 'POST',
      cookie: shopCookie,
      body: {
        name: 'City Care Pharmacy',
        area: 'Indiranagar',
        address: '100 Feet Rd, Indiranagar, Bangalore',
        lat: 12.9716,
        lng: 77.5946,
        phone: '9876543210',
        opensAt: '08:00',
        closesAt: '22:00',
      },
    });
    assert.equal(createShopRes.status, 201);
    shopId = createShopRes.data.data.id;
    shopCode = createShopRes.data.data.code;
    assert.ok(shopCode);

    // Girl finds shop by GET and POST nearby
    const nearbyGet = await req('/shops/nearby?lat=12.9716&lng=77.5946', { cookie: girlCookie });
    assert.equal(nearbyGet.status, 200);
    assert.ok(nearbyGet.data.data.length > 0);
    const foundShop = nearbyGet.data.data.find((s) => s.id === shopId);
    assert.ok(foundShop);
    assert.equal(foundShop.km, 0);

    const nearbyPost = await req('/shops/nearby', {
      method: 'POST',
      cookie: girlCookie,
      body: { area: 'Indiranagar' },
    });
    assert.equal(nearbyPost.status, 200);
    assert.ok(nearbyPost.data.data.some((s) => s.id === shopId));

    // Girl saves shop with code
    const saveShopRes = await req('/shops/saved', {
      method: 'POST',
      cookie: girlCookie,
      body: { code: shopCode },
    });
    assert.equal(saveShopRes.status, 201);

    // List girl saved shops
    const listSavedRes = await req('/shops/saved', { cookie: girlCookie });
    assert.equal(listSavedRes.status, 200);
    assert.ok(listSavedRes.data.data.some((s) => s.id === shopId));

    // Get single shop details
    const getShopRes = await req(`/shops/${shopId}`, { cookie: girlCookie });
    assert.equal(getShopRes.status, 200);
    assert.equal(getShopRes.data.data.name, 'City Care Pharmacy');
    assert.equal(getShopRes.data.data.saved, true);

    // Girl places order
    const orderRes = await req('/orders', {
      method: 'POST',
      cookie: girlCookie,
      body: {
        shopId,
        kind: 'day',
        size: 'regular',
        qty: 2,
        phone: '9988776655',
      },
    });
    assert.equal(orderRes.status, 201);
    orderId = orderRes.data.data.id;
    assert.ok(orderRes.data.data.orderNumber);

    // Girl views single order details
    const girlViewOrder = await req(`/orders/${orderId}`, { cookie: girlCookie });
    assert.equal(girlViewOrder.status, 200);
    assert.equal(girlViewOrder.data.data.id, orderId);
    assert.equal(girlViewOrder.data.data.qty, 2);

    // Shop views single order details
    const shopViewOrder = await req(`/orders/${orderId}`, { cookie: shopCookie });
    assert.equal(shopViewOrder.status, 200);
    assert.equal(shopViewOrder.data.data.id, orderId);
    assert.equal(shopViewOrder.data.data.phone, '99******55');

    // Girl cancels another pending order
    const cancelOrderRes = await req('/orders', {
      method: 'POST',
      cookie: girlCookie,
      body: { shopId, kind: 'day', size: 'regular', qty: 1 },
    });
    assert.equal(cancelOrderRes.status, 201);
    const cancelOrderId = cancelOrderRes.data.data.id;
    const doCancelRes = await req(`/orders/${cancelOrderId}/cancel`, {
      method: 'POST',
      cookie: girlCookie,
    });
    assert.equal(doCancelRes.status, 200);
    assert.equal(doCancelRes.data.data.status, 'cancelled');

    // Shop views order list
    const shopOrdersRes = await req('/shops/orders', { cookie: shopCookie });
    assert.equal(shopOrdersRes.status, 200);
    const orderForShop = shopOrdersRes.data.data.find((o) => o.id === orderId);
    assert.ok(orderForShop);
    assert.equal(orderForShop.qty, 2);
    assert.equal(orderForShop.phone, '99******55');

    // Shop updates status to accepted, then ready
    const acceptRes = await req(`/shops/orders/${orderId}`, {
      method: 'PATCH',
      cookie: shopCookie,
      body: { status: 'accepted' },
    });
    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.data.data.status, 'accepted');

    const readyRes = await req(`/shops/orders/${orderId}`, {
      method: 'PATCH',
      cookie: shopCookie,
      body: { status: 'ready' },
    });
    assert.equal(readyRes.status, 200);
    assert.equal(readyRes.data.data.status, 'ready');

    // Girl marks picked up
    const pickRes = await req(`/orders/${orderId}/picked-up`, {
      method: 'POST',
      cookie: girlCookie,
    });
    assert.equal(pickRes.status, 200);
    assert.equal(pickRes.data.data.status, 'picked_up');

    // Verify phone is removed from database after pickup
    const checkDbOrder = await db.PadOrder.findByPk(orderId);
    assert.equal(checkDbOrder.status, 'picked_up');
    assert.equal(checkDbOrder.phone, null);

    // Unsave shop
    const unsaveRes = await req(`/shops/saved/${shopId}`, {
      method: 'DELETE',
      cookie: girlCookie,
    });
    assert.equal(unsaveRes.status, 204);
  });

  await t.test('9. Hard Delete Account with OTP', async () => {
    // Data export check
    const exportRes = await req('/me/export', { cookie: girlCookie });
    assert.equal(exportRes.status, 200);
    assert.ok(exportRes.data.data.exportedAt);
    assert.equal(exportRes.data.data.profile.email, girlEmail);
    assert.ok(Array.isArray(exportRes.data.data.cycles));
    assert.ok(Array.isArray(exportRes.data.data.orders));

    // Request OTP for account deletion
    await req('/auth/otp', {
      method: 'POST',
      cookie: girlCookie,
      body: { email: girlEmail, purpose: 'delete' },
    });
    const delOtp = readDevOtp(girlEmail);

    // Delete account
    const delRes = await req('/me', {
      method: 'DELETE',
      cookie: girlCookie,
      body: { code: delOtp },
    });
    assert.equal(delRes.status, 204);

    // Verify girl user and health records are completely deleted
    const checkUser = await db.User.findOne({ where: { email: girlEmail } });
    assert.equal(checkUser, null);

    const checkCycles = await db.Cycle.findAll({ where: { userId: checkUser ? checkUser.id : '00000000-0000-0000-0000-000000000000' } });
    assert.equal(checkCycles.length, 0);

    const checkOtp = await db.OtpCode.findAll({ where: { email: girlEmail } });
    assert.equal(checkOtp.length, 0);

    // Session is dead
    const afterMe = await req('/me', { cookie: girlCookie });
    assert.equal(afterMe.status, 401);
  });
});
