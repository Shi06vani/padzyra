const db = require('../models');
const HttpError = require('../utils/httpError');
const { addBag } = require('./stock');
const fcm = require('./fcm');

function girlOrder(order, shop) {
  const body = {
    id: order.id,
    orderNumber: order.orderNumber || ('PZ-' + order.id.slice(0, 4).toUpperCase()),
    kind: order.kind,
    size: order.size,
    qty: order.qty,
    status: order.status,
    createdAt: order.createdAt,
    address: order.address,
  };
  if (shop) {
    body.shop = {
      id: shop.id,
      name: shop.name,
      address: shop.address,
      phone: shop.phone,
      lat: shop.lat,
      lng: shop.lng,
    };
  }
  return body;
}

function shopOrder(order) {
  const body = {
    id: order.id,
    orderNumber: order.orderNumber || ('PZ-' + order.id.slice(0, 4).toUpperCase()),
    kind: order.kind,
    size: order.size,
    qty: order.qty,
    status: order.status,
  };
  if (order.address) body.address = order.address;
  if (order.phone) {
    const raw = String(order.phone).trim();
    body.phone = raw.length > 4 ? raw.slice(0, 2) + '******' + raw.slice(-2) : '******';
  }
  return body;
}

async function createOrder(user, { shopId, kind, size, qty, address, phone }) {
  const shop = await db.Shop.findByPk(shopId);
  if (!shop) throw new HttpError(404, 'Shop not found');
  const orderNumber = 'PZ-' + Math.floor(1000 + Math.random() * 9000);
  const order = await db.PadOrder.create({
    userId: user.id,
    shopId: shop.id,
    kind,
    size,
    qty,
    address: address || null,
    phone: phone || null,
    orderNumber,
    status: 'pending',
  });

  // Notify Shop via FCM
  fcm.sendToUser(shop.userId, {
    title: 'New Emergency Order!',
    body: `New request #${orderNumber} for ${qty}x ${kind} pads.`,
    data: { orderId: order.id, type: 'new_order' },
  }).catch(() => {});

  return { id: order.id, orderNumber, status: order.status };
}

async function myOrders(user) {
  const orders = await db.PadOrder.findAll({
    where: { userId: user.id },
    include: [{ model: db.Shop }],
    order: [['createdAt', 'DESC']],
  });
  return orders.map((order) => girlOrder(order, order.Shop));
}

async function shopOrders(user) {
  const shop = await db.Shop.findOne({ where: { userId: user.id } });
  if (!shop) throw new HttpError(404, 'Shop not found');
  const orders = await db.PadOrder.findAll({
    where: { shopId: shop.id },
    order: [['createdAt', 'DESC']],
  });
  return orders.map(shopOrder);
}

const NEXT = {
  pending: ['accepted', 'cancelled'],
  accepted: ['ready', 'cancelled'],
  ready: ['cancelled'],
};

async function setStatus(user, id, status) {
  const shop = await db.Shop.findOne({ where: { userId: user.id } });
  if (!shop) throw new HttpError(404, 'Shop not found');
  const order = await db.PadOrder.findOne({ where: { id, shopId: shop.id } });
  if (!order) throw new HttpError(404, 'Order not found');
  if (!NEXT[order.status] || !NEXT[order.status].includes(status)) {
    throw new HttpError(409, 'Status cannot change');
  }
  order.status = status;
  if (status === 'cancelled') {
    order.phone = null;
    order.address = null;
  }
  await order.save();

  // Notify User via FCM on status transition
  if (status === 'accepted') {
    fcm.sendToUser(order.userId, {
      title: 'Order Accepted',
      body: `${shop.name} accepted your request and is preparing your pads.`,
      data: { orderId: order.id, status },
    }).catch(() => {});
  } else if (status === 'ready') {
    fcm.sendToUser(order.userId, {
      title: 'Pads Ready for Pickup!',
      body: `Your order #${order.orderNumber} is packed and ready at ${shop.name}.`,
      data: { orderId: order.id, status },
    }).catch(() => {});
  }

  return { id: order.id, orderNumber: order.orderNumber || ('PZ-' + order.id.slice(0, 4).toUpperCase()), status: order.status };
}

async function pickUp(user, id) {
  const order = await db.PadOrder.findOne({ where: { id, userId: user.id } });
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.status !== 'ready' && order.status !== 'accepted') {
    throw new HttpError(409, 'Order is not ready for pickup');
  }
  const stock = await addBag(user, order.kind, order.qty);
  order.status = 'picked_up';
  order.phone = null;
  order.address = null;
  await order.save();
  return { id: order.id, status: order.status, place: stock.place, kind: stock.kind, qty: stock.qty };
}

async function getOrder(user, id) {
  const order = await db.PadOrder.findByPk(id, { include: [{ model: db.Shop }] });
  if (!order) throw new HttpError(404, 'Order not found');
  if (user.role === 'girl') {
    if (order.userId !== user.id) throw new HttpError(403, 'Wrong account');
    return girlOrder(order, order.Shop);
  }
  if (user.role === 'shop') {
    const shop = await db.Shop.findOne({ where: { userId: user.id } });
    if (!shop || order.shopId !== shop.id) throw new HttpError(403, 'Wrong account');
    return shopOrder(order);
  }
  throw new HttpError(403, 'Wrong account');
}

async function cancelOrder(user, id) {
  const order = await db.PadOrder.findOne({ where: { id, userId: user.id } });
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.status !== 'pending' && order.status !== 'accepted') {
    throw new HttpError(409, 'Cannot cancel this order');
  }
  order.status = 'cancelled';
  order.phone = null;
  order.address = null;
  await order.save();
  return { id: order.id, orderNumber: order.orderNumber || ('PZ-' + order.id.slice(0, 4).toUpperCase()), status: order.status };
}

module.exports = { createOrder, myOrders, shopOrders, setStatus, pickUp, getOrder, cancelOrder };
