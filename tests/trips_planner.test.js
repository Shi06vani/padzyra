const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/app');

function runServer() {
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        server,
        url: `http://127.0.0.1:${port}/api/v1`,
      });
    });
  });
}

test('Period Travel Planner API Tests', async () => {
  const { server, url } = await runServer();

  async function req(path, { method = 'GET', body, cookie, headers = {} } = {}) {
    const res = await fetch(`${url}${path}`, {
      method,
      headers: {
        'x-padzyra': '1',
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, cookie: setCookie };
  }

  const fs = require('fs');
const path = require('path');

function readDevOtp(email) {
  const filePath = path.join(process.cwd(), 'tmp', 'last-otp.txt');
  const content = fs.readFileSync(filePath, 'utf8').trim().split('\n');
  const line = content.filter((l) => l.startsWith(email)).pop();
  if (!line) throw new Error(`OTP not found for ${email}`);
  return line.split(' ')[2];
}

// Register User A (Girl)
  const emailA = `travel_girl_${Date.now()}@test.padzyra`;
  const otpResA = await req('/auth/otp', { method: 'POST', body: { email: emailA, role: 'girl' } });
  assert.equal(otpResA.status, 200);

  const codeA = readDevOtp(emailA);
  const verifyResA = await req('/auth/verify', {
    method: 'POST',
    body: { email: emailA, code: codeA, role: 'girl' },
    cookie: otpResA.cookie,
  });
  assert.equal(verifyResA.status, 200);
  const cookieA = verifyResA.cookie;

  // Set and unlock PIN for User A
  await req('/me', { method: 'PATCH', cookie: cookieA, body: { pin: '1234' } });
  const pinResA = await req('/auth/pin', { method: 'POST', cookie: cookieA, body: { pin: '1234' } });
  const authCookieA = pinResA.cookie || cookieA;

  // Register User B (Girl for isolation test)
  const emailB = `travel_girl_b_${Date.now()}@test.padzyra`;
  const otpResB = await req('/auth/otp', { method: 'POST', body: { email: emailB, role: 'girl' } });
  const codeB = readDevOtp(emailB);
  const verifyResB = await req('/auth/verify', {
    method: 'POST',
    body: { email: emailB, code: codeB, role: 'girl' },
    cookie: otpResB.cookie,
  });
  const cookieB = verifyResB.cookie;

  // Set and unlock PIN for User B
  await req('/me', { method: 'PATCH', cookie: cookieB, body: { pin: '4321' } });
  const pinResB = await req('/auth/pin', { method: 'POST', cookie: cookieB, body: { pin: '4321' } });
  const authCookieB = pinResB.cookie || cookieB;

  // 1. Create a trip with valid dates and metadata
  const tripPayload = {
    start: '2026-11-10',
    end: '2026-11-15',
    name: 'Goa Beach Vacation',
    destination: 'Goa, India',
    activities: ['beach', 'long journey'],
    checklist: [
      { id: 'item-1', name: 'Sanitary pads (day)', category: 'essentials', packed: true, quantity: 6 },
      { id: 'item-2', name: 'Heating patch', category: 'comfort', packed: false, quantity: 2 },
    ],
  };

  const createRes = await req('/trips', {
    method: 'POST',
    cookie: authCookieA,
    body: tripPayload,
  });
  assert.equal(createRes.status, 201);
  assert.ok(createRes.data.data.id);
  assert.equal(createRes.data.data.name, 'Goa Beach Vacation');
  assert.equal(createRes.data.data.destination, 'Goa, India');
  assert.deepEqual(createRes.data.data.activities, ['beach', 'long journey']);
  assert.equal(createRes.data.data.checklist.length, 2);
  assert.equal(createRes.data.data.checklist[0].packed, true);
  const tripIdA = createRes.data.data.id;

  // 2. Reject trip where end < start
  const invalidDateRes = await req('/trips', {
    method: 'POST',
    cookie: authCookieA,
    body: { start: '2026-11-15', end: '2026-11-10', name: 'Impossible Trip' },
  });
  assert.equal(invalidDateRes.status, 400);

  // 3. Reject invalid date format
  const badFormatRes = await req('/trips', {
    method: 'POST',
    cookie: authCookieA,
    body: { start: 'not-a-date', end: '2026-11-15' },
  });
  assert.equal(badFormatRes.status, 400);

  // 4. Duplicate trip prevention (same dates and name)
  const dupRes = await req('/trips', {
    method: 'POST',
    cookie: authCookieA,
    body: tripPayload,
  });
  assert.equal(dupRes.status, 409);

  // 5. List trips for User A
  const listResA = await req('/trips', { cookie: authCookieA });
  assert.equal(listResA.status, 200);
  assert.ok(listResA.data.data.some((t) => t.id === tripIdA));

  // 6. User B cannot see User A's trips (Data Isolation)
  const listResB = await req('/trips', { cookie: authCookieB });
  assert.equal(listResB.status, 200);
  assert.ok(!listResB.data.data.some((t) => t.id === tripIdA));

  // User B cannot access or update User A's trip directly
  const getOtherTripRes = await req(`/trips/${tripIdA}`, { cookie: authCookieB });
  assert.equal(getOtherTripRes.status, 404);

  const deleteOtherTripRes = await req(`/trips/${tripIdA}`, { method: 'DELETE', cookie: authCookieB });
  assert.equal(deleteOtherTripRes.status, 404);

  // 7. Update trip details and checklist progress
  const updatedChecklist = [
    { id: 'item-1', name: 'Sanitary pads (day)', category: 'essentials', packed: true, quantity: 8 },
    { id: 'item-2', name: 'Heating patch', category: 'comfort', packed: true, quantity: 2 },
    { id: 'item-3', name: 'Extra underwear', category: 'essentials', packed: false, quantity: 3, custom: true },
  ];

  const patchRes = await req(`/trips/${tripIdA}`, {
    method: 'PATCH',
    cookie: authCookieA,
    body: {
      destination: 'South Goa, India',
      checklist: updatedChecklist,
    },
  });
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.data.data.destination, 'South Goa, India');
  assert.equal(patchRes.data.data.checklist.length, 3);
  assert.equal(patchRes.data.data.checklist[1].packed, true);

  // 8. Log a menstrual cycle for User A to verify cycle data persistence alongside trips
  const cycleRes = await req('/cycles', {
    method: 'POST',
    cookie: authCookieA,
    body: { start: '2026-10-15', end: '2026-10-20', flow: 'medium' },
  });
  assert.equal(cycleRes.status, 201);
  const cycleId = cycleRes.data.data.id;

  // 9. Delete Trip
  const delRes = await req(`/trips/${tripIdA}`, { method: 'DELETE', cookie: authCookieA });
  assert.equal(delRes.status, 204);

  // Verify trip is deleted
  const getDeletedRes = await req(`/trips/${tripIdA}`, { cookie: authCookieA });
  assert.equal(getDeletedRes.status, 404);

  // Verify cycle data remains completely untouched after trip deletion
  const getCycleRes = await req(`/cycles/${cycleId}`, { cookie: authCookieA });
  assert.equal(getCycleRes.status, 200);
  assert.equal(getCycleRes.data.data.start, '2026-10-15');

  if (server.closeAllConnections) server.closeAllConnections();
  await new Promise((r) => server.close(r));
});
