const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { maskDestination } = require('../src/services/account');

let server;
let baseUrl;

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
  let data;
  if (res.status !== 204) {
    data = await res.json().catch(() => ({}));
  }
  return { status: res.status, ok: res.ok, data };
}

test.before(async () => {
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api/v1`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Professional PIN & Forgot PIN Suite', async (t) => {
  await t.test('1. Mask Destination Utility', () => {
    assert.equal(maskDestination('shivanisuryavanshi612@gmail.com'), 's***2@gmail.com');
    assert.equal(maskDestination('phone_9876543210@padzyra.local'), 'mobile ending in ••3210');
    assert.equal(maskDestination('9876543210'), 'mobile ending in ••3210');
    assert.equal(maskDestination('+919876543210'), 'mobile ending in ••3210');
    assert.equal(maskDestination(''), '');
  });

  await t.test('2. Auth Status endpoint returns proper structure', async () => {
    const res = await req('/auth/status');
    assert.equal(res.status, 200);
    assert.equal(res.data.data.authenticated, false);
  });

  await t.test('3. Forgot PIN Request OTP validation without email or phone', async () => {
    const res = await req('/auth/pin/request-reset', {
      method: 'POST',
      body: {},
    });
    assert.equal(res.status, 400);
    assert.ok(res.data.error.message.includes('required'));
  });

  await t.test('4. Reset PIN validation checks 4-digit requirement', async () => {
    const res = await req('/auth/pin/reset', {
      method: 'POST',
      body: { email: 'test@example.com', code: '123456', newPin: '12' },
    });
    assert.equal(res.status, 400);
    assert.ok(res.data.error.message.includes('4 digits'));
  });

  await t.test('5. Reset PIN validation checks 6-digit code requirement', async () => {
    const res = await req('/auth/pin/reset', {
      method: 'POST',
      body: { email: 'test@example.com', code: '12', newPin: '1234' },
    });
    assert.equal(res.status, 400);
    assert.ok(res.data.error.message.includes('Code is invalid'));
  });
});

