process.env.NODE_ENV = 'test';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const db = require('../src/models');

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

function readDevOtp(email) {
  const filePath = path.join(process.cwd(), 'tmp', 'last-otp.txt');
  const content = fs.readFileSync(filePath, 'utf8').trim().split('\n');
  const line = content.filter((l) => l.startsWith(email)).pop();
  if (!line) throw new Error(`OTP not found for ${email}`);
  return line.split(' ')[2];
}

test('Padzyra Emergency Period Mode Full-Stack API Suite', async () => {
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
    if (res.status === 500) {
      console.error('API 500 Error in path:', path, text);
    }
    return { status: res.status, data, cookie: setCookie };
  }

  // 1. Setup test users: Girl User and Shop Owner
  const girlEmail = `emergency_girl_${Date.now()}@test.padzyra`;
  const shopEmail = `emergency_shop_${Date.now()}@test.padzyra`;
  const otherGirlEmail = `other_girl_${Date.now()}@test.padzyra`;

  try {

  // Register Girl
  const otpResGirl = await req('/auth/otp', { method: 'POST', body: { email: girlEmail, role: 'girl' } });
  assert.equal(otpResGirl.status, 200);
  const codeGirl = readDevOtp(girlEmail);
  const verifyResGirl = await req('/auth/verify', { method: 'POST', body: { email: girlEmail, code: codeGirl } });
  assert.equal(verifyResGirl.status, 200);
  const girlCookie = verifyResGirl.cookie;

  // Register Other Girl
  const otpResOther = await req('/auth/otp', { method: 'POST', body: { email: otherGirlEmail, role: 'girl' } });
  assert.equal(otpResOther.status, 200);
  const codeOther = readDevOtp(otherGirlEmail);
  const verifyResOther = await req('/auth/verify', { method: 'POST', body: { email: otherGirlEmail, code: codeOther } });
  assert.equal(verifyResOther.status, 200);
  const otherGirlCookie = verifyResOther.cookie;

  // Register Shop
  const otpResShop = await req('/auth/otp', { method: 'POST', body: { email: shopEmail, role: 'shop' } });
  assert.equal(otpResShop.status, 200);
  const codeShop = readDevOtp(shopEmail);
  const verifyResShop = await req('/auth/verify', { method: 'POST', body: { email: shopEmail, code: codeShop, role: 'shop' } });
  assert.equal(verifyResShop.status, 200);
  const shopCookie = verifyResShop.cookie;

  // Setup Shop Profile in DB
  const shopUser = await db.User.findOne({ where: { email: shopEmail } });
  const uniqueCode = 'EMG' + Math.floor(100 + Math.random() * 899);
  const testShop = await db.Shop.create({
    userId: shopUser.id,
    name: 'Apollo 24/7 Emergency Pharmacy',
    area: 'Indiranagar',
    address: '100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru',
    lat: 12.9716,
    lng: 77.6412,
    phone: '9876543210',
    code: uniqueCode,
    opensAt: '00:00',
    closesAt: '23:59',
  });

  // ==========================================
  // SECTION 3: NEARBY TOILET FINDER TESTS
  // ==========================================

  // A. Coordinates validation
  const invalidLatRes = await req('/emergency/toilets/nearby?lat=120&lng=77.6');
  assert.equal(invalidLatRes.status, 400);

  const missingCoordsRes = await req('/emergency/toilets/nearby');
  assert.equal(missingCoordsRes.status, 400);

  // B. Valid coordinates toilet lookup
  const validToiletsRes = await req('/emergency/toilets/nearby?lat=12.975&lng=77.61&radius=5&limit=10');
  assert.equal(validToiletsRes.status, 200);
  assert.ok(Array.isArray(validToiletsRes.data.data.data));
  assert.ok(validToiletsRes.data.data.count >= 1);

  const firstToilet = validToiletsRes.data.data.data[0];
  assert.ok(firstToilet.id);
  assert.ok(firstToilet.name);
  assert.ok(firstToilet.address);
  assert.ok(firstToilet.distanceKm != null);
  assert.ok(typeof firstToilet.facilities === 'object');
  assert.ok(firstToilet.source);
  assert.ok(typeof firstToilet.verified === 'boolean');

  // C. Manual search for toilets
  const emptySearchRes = await req('/emergency/toilets/search');
  assert.equal(emptySearchRes.status, 400);

  const areaSearchRes = await req('/emergency/toilets/search?query=Metro+Station');
  assert.equal(areaSearchRes.status, 200);
  assert.ok(areaSearchRes.data.data.count >= 1);
  assert.ok(areaSearchRes.data.data.data.length >= 1);

  // ==========================================
  // SECTION 4: NEARBY PERIOD PRODUCTS TESTS
  // ==========================================

  // A. Categories
  const catRes = await req('/emergency/products/categories');
  assert.equal(catRes.status, 200);
  assert.ok(Array.isArray(catRes.data.data));
  const catIds = catRes.data.data.map((c) => c.id);
  assert.ok(catIds.includes('pads'));
  assert.ok(catIds.includes('tampons'));
  assert.ok(catIds.includes('heat'));

  // B. Nearby Products & Shops
  const nearbyShopsRes = await req('/emergency/products/nearby?lat=12.9716&lng=77.6412&radius=10');
  assert.equal(nearbyShopsRes.status, 200);
  assert.ok(nearbyShopsRes.data.data.count >= 1);

  const matchedShop = nearbyShopsRes.data.data.data.find((s) => s.id === testShop.id);
  assert.ok(matchedShop);
  assert.equal(matchedShop.name, 'Apollo 24/7 Emergency Pharmacy');
  assert.equal(matchedShop.isPartner, true);
  assert.equal(matchedShop.hasDelivery, true);
  assert.ok(Array.isArray(matchedShop.availableProducts));
  assert.ok(matchedShop.availableProducts.length > 0);

  // C. Filter by category
  const heatShopsRes = await req('/emergency/products/nearby?lat=12.9716&lng=77.6412&category=heat');
  assert.equal(heatShopsRes.status, 200);
  const shopWithHeat = heatShopsRes.data.data.data.find((s) => s.id === testShop.id);
  assert.ok(shopWithHeat);
  assert.ok(shopWithHeat.availableProducts.every((p) => p.category === 'heat'));

  // D. Shop Details
  const shopDetailRes = await req(`/emergency/shops/${testShop.id}`);
  assert.equal(shopDetailRes.status, 200);
  assert.equal(shopDetailRes.data.data.name, 'Apollo 24/7 Emergency Pharmacy');
  assert.ok(shopDetailRes.data.data.products.length > 5);

  const invalidShopDetailRes = await req('/emergency/shops/00000000-0000-0000-0000-000000000000');
  assert.equal(invalidShopDetailRes.status, 404);

  // ==========================================
  // SECTION 5: EMERGENCY PAD DELIVERY TESTS
  // ==========================================

  // A. Delivery Availability
  const availRes = await req('/emergency/delivery/availability?lat=12.9716&lng=77.6412');
  assert.equal(availRes.status, 200);
  assert.equal(availRes.data.data.available, true);
  assert.ok(availRes.data.data.estimatedMinutes >= 15);
  assert.ok(availRes.data.data.deliveryFee >= 0);
  assert.ok(availRes.data.data.servingShop.id);

  // B. Delivery Products Catalog
  const delivProdRes = await req('/emergency/delivery/products');
  assert.equal(delivProdRes.status, 200);
  assert.ok(Array.isArray(delivProdRes.data.data));
  assert.ok(delivProdRes.data.data.length >= 5);
  const dayPads = delivProdRes.data.data.find((p) => p.id === 'prod-day-pads-ultra');
  assert.ok(dayPads);
  assert.equal(dayPads.price, 35);

  // C. Delivery Order Validation Failures
  // Unauthorized without login
  const unauthOrderRes = await req('/emergency/delivery/orders', {
    method: 'POST',
    body: {
      shopId: testShop.id,
      items: [{ id: 'prod-day-pads-ultra', qty: 2 }],
      address: 'Suite 401, Tech Park, Indiranagar',
    },
  });
  assert.equal(unauthOrderRes.status, 401);

  // Invalid shop
  const invalidShopOrderRes = await req('/emergency/delivery/orders', {
    method: 'POST',
    cookie: girlCookie,
    body: {
      shopId: '00000000-0000-0000-0000-000000000000',
      items: [{ id: 'prod-day-pads-ultra', qty: 2 }],
      address: 'Suite 401, Tech Park, Indiranagar',
    },
  });
  assert.equal(invalidShopOrderRes.status, 404);

  // Empty items
  const emptyItemsOrderRes = await req('/emergency/delivery/orders', {
    method: 'POST',
    cookie: girlCookie,
    body: {
      shopId: testShop.id,
      items: [],
      address: 'Suite 401, Tech Park, Indiranagar',
    },
  });
  assert.equal(emptyItemsOrderRes.status, 400);

  // Short/missing address
  const badAddrOrderRes = await req('/emergency/delivery/orders', {
    method: 'POST',
    cookie: girlCookie,
    body: {
      shopId: testShop.id,
      items: [{ id: 'prod-day-pads-ultra', qty: 2 }],
      address: 'Hi',
    },
  });
  assert.equal(badAddrOrderRes.status, 400);

  // Invalid product quantity
  const badQtyOrderRes = await req('/emergency/delivery/orders', {
    method: 'POST',
    cookie: girlCookie,
    body: {
      shopId: testShop.id,
      items: [{ id: 'prod-day-pads-ultra', qty: -5 }],
      address: 'Suite 401, Tech Park, Indiranagar',
    },
  });
  assert.equal(badQtyOrderRes.status, 400);

  // D. Valid Order Creation with Server Price Calculation
  // 2x Day Pads (35 * 2 = 70) + 1x Heat Patch (149) = subtotal 219 (>= 150 -> free delivery)
  const createOrderRes = await req('/emergency/delivery/orders', {
    method: 'POST',
    cookie: girlCookie,
    body: {
      shopId: testShop.id,
      items: [
        { id: 'prod-day-pads-ultra', qty: 2, price: 1 }, // Malicious client tried to send price: 1!
        { id: 'prod-heating-patches', qty: 1, price: 5 },
      ],
      address: 'Suite 401, Sapphire Tower, 100 Feet Rd, Indiranagar',
      phone: '9988776655',
      notes: 'Please leave with reception urgently.',
    },
  });
  assert.equal(createOrderRes.status, 201);
  const createdOrder = createOrderRes.data.data;
  assert.ok(createdOrder.id);
  assert.ok(createdOrder.orderNumber.startsWith('PZ-EMG-'));
  assert.equal(createdOrder.status, 'pending');
  assert.equal(createdOrder.subtotal, 219); // 35*2 + 149 = 219
  assert.equal(createdOrder.deliveryFee, 0); // >= 150 free delivery
  assert.equal(createdOrder.total, 219); // server verified total, client fake price ignored
  assert.equal(createdOrder.items.length, 2);
  assert.equal(createdOrder.shop.id, testShop.id);
  assert.ok(Array.isArray(createdOrder.timeline));

  // E. Idempotency on rapid resubmission
  const dupOrderRes = await req('/emergency/delivery/orders', {
    method: 'POST',
    cookie: girlCookie,
    body: {
      shopId: testShop.id,
      items: [
        { id: 'prod-day-pads-ultra', qty: 2 },
        { id: 'prod-heating-patches', qty: 1 },
      ],
      address: 'Suite 401, Sapphire Tower, 100 Feet Rd, Indiranagar',
      phone: '9988776655',
    },
  });
  assert.equal(dupOrderRes.status, 200); // Idempotent return of existing pending order!
  assert.equal(dupOrderRes.data.data.id, createdOrder.id);
  assert.equal(dupOrderRes.data.data.orderNumber, createdOrder.orderNumber);

  // F. View Order Details
  const viewOrderRes = await req(`/emergency/delivery/orders/${createdOrder.id}`, {
    cookie: girlCookie,
  });
  assert.equal(viewOrderRes.status, 200);
  assert.equal(viewOrderRes.data.data.id, createdOrder.id);
  assert.equal(viewOrderRes.data.data.status, 'pending');
  assert.equal(viewOrderRes.data.data.total, 219);

  // G. Other user cannot access Girl A's emergency order
  const unauthorizedViewRes = await req(`/emergency/delivery/orders/${createdOrder.id}`, {
    cookie: otherGirlCookie,
  });
  assert.equal(unauthorizedViewRes.status, 403);

  // H. Shop owner views emergency order with privacy-masked phone
  const shopViewRes = await req(`/emergency/delivery/orders/${createdOrder.id}`, {
    cookie: shopCookie,
  });
  assert.equal(shopViewRes.status, 200);
  assert.equal(shopViewRes.data.data.phone, '99******55'); // Phone is privacy masked for shop!

  // I. Cancel Emergency Order
  const cancelRes = await req(`/emergency/delivery/orders/${createdOrder.id}/cancel`, {
    method: 'POST',
    cookie: girlCookie,
    body: { reason: 'Colleague provided a spare pad' },
  });
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.data.data.status, 'cancelled');

  // Verify order is now cancelled
  const afterCancelRes = await req(`/emergency/delivery/orders/${createdOrder.id}`, {
    cookie: girlCookie,
  });
  assert.equal(afterCancelRes.data.data.status, 'cancelled');

  // Cannot re-cancel already cancelled order
  const reCancelRes = await req(`/emergency/delivery/orders/${createdOrder.id}/cancel`, {
    method: 'POST',
    cookie: girlCookie,
  });
  assert.equal(reCancelRes.status, 409);
  } finally {
    // Clean up server
    if (server.closeAllConnections) server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await db.sequelize.close();
  }
});
