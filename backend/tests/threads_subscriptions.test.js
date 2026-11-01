const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

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

test('Period Threads & Subscriptions API', async (t) => {
  await t.test('1. Get Period Threads', async () => {
    const res = await req('/threads');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.data));
    assert.ok(res.data.data.length > 0);
    const first = res.data.data[0];
    assert.ok(first.content);
    assert.ok(first.authorName);
  });

  await t.test('2. Post New Period Thought', async () => {
    const res = await req('/threads', {
      method: 'POST',
      body: {
        content: 'Testing cramp tips and chocolate cravings! 🍫🌸',
        authorName: 'Test Sister',
        tag: 'cravings',
        feeling: '🍫 Craving Chocolate',
      },
    });
    assert.equal(res.status, 201);
    assert.ok(res.data.data.id);
    assert.equal(res.data.data.authorName, 'Test Sister');
    assert.equal(res.data.data.tag, 'cravings');

    // Like the new thread
    const likeRes = await req(`/threads/${res.data.data.id}/like`, { method: 'POST' });
    assert.equal(likeRes.status, 200);
    assert.ok(likeRes.data.data.likesCount >= 1);

    // Send hug to the thread
    const hugRes = await req(`/threads/${res.data.data.id}/hug`, { method: 'POST' });
    assert.equal(hugRes.status, 200);
    assert.ok(hugRes.data.data.hugsCount >= 1);

    // Reply to the thread
    const replyRes = await req(`/threads/${res.data.data.id}/replies`, {
      method: 'POST',
      body: {
        content: 'Stay cozy sister! We are with you ❤️',
        authorName: 'Helpful Sis',
      },
    });
    assert.equal(replyRes.status, 201);
    assert.equal(replyRes.data.data.content, 'Stay cozy sister! We are with you ❤️');
  });

  await t.test('3. Subscription Plans (₹50, ₹100, ₹250)', async () => {
    const res = await req('/subscriptions/plans');
    assert.equal(res.status, 200);
    const plans = res.data.data;
    assert.ok(Array.isArray(plans));
    assert.equal(plans.length, 3);

    const starter = plans.find((p) => p.id === 'starter_50');
    assert.ok(starter);
    assert.equal(starter.price, 50);

    const pro = plans.find((p) => p.id === 'pro_100');
    assert.ok(pro);
    assert.equal(pro.price, 100);
    assert.equal(pro.popular, true);

    const vip = plans.find((p) => p.id === 'vip_250');
    assert.ok(vip);
    assert.equal(vip.price, 250);
  });

  await t.test('4. AI Gynec & Period Coach Chat API', async () => {
    const res = await req('/coach/chat', {
      method: 'POST',
      body: { message: 'How to relieve severe period cramps?' },
    });
    assert.equal(res.status, 200);
    assert.ok(res.data.data.reply);
    assert.equal(res.data.data.category, 'cramp_relief');
    assert.ok(Array.isArray(res.data.data.quickTips));
    assert.ok(res.data.data.disclaimer);
  });

  await t.test('5. Period Essentials Catalog (Dark Chocolate, Hot Water Bag, Menstrual Cup, etc.)', async () => {
    const res = await req('/catalog/essentials');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.data.items));
    assert.ok(res.data.data.items.length >= 10);

    const items = res.data.data.items;
    const chocolate = items.find((i) => i.category === 'chocolate');
    assert.ok(chocolate, 'Should have dark chocolate for cramps');
    assert.equal(chocolate.price, 90);

    const hotBag = items.find((i) => i.category === 'heat');
    assert.ok(hotBag, 'Should have hot water bag');
    assert.equal(hotBag.price, 199);

    const cup = items.find((i) => i.category === 'cup');
    assert.ok(cup, 'Should have menstrual cup');
    assert.equal(cup.price, 299);
    assert.ok(cup.sizes && cup.sizes.includes('Medium'));

    // Category filter test
    const chocoRes = await req('/catalog/essentials?category=chocolate');
    assert.equal(chocoRes.status, 200);
    assert.ok(chocoRes.data.data.items.every((i) => i.category === 'chocolate'));
  });
});

