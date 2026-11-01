const express = require('express');
const db = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/httpError');
const { send, sendEmpty } = require('../utils/respond');
const {
  required, textOf, coord, timeOf, pointOf,
} = require('../utils/validate');
const { requireRole, requirePin } = require('../middleware/auth');
const { shopCode } = require('../utils/cryptoBox');
const { nearby } = require('../services/nearby');

const router = express.Router();

function ownerView(shop) {
  return {
    id: shop.id,
    code: shop.code,
    name: shop.name,
    area: shop.area,
    address: shop.address,
    lat: Number(shop.lat),
    lng: Number(shop.lng),
    phone: shop.phone,
    opensAt: shop.opensAt,
    closesAt: shop.closesAt,
  };
}

function shopInput(body, partial) {
  const next = {};
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'name')) {
    next.name = textOf(required(body.name, 'Name is required'), 80, 'Name is too long');
    if (!next.name) throw new HttpError(400, 'Name is required');
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'address')) {
    next.address = textOf(required(body.address, 'Address is required'), 160, 'Address is too long');
    if (!next.address) throw new HttpError(400, 'Address is required');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'area')) next.area = textOf(body.area, 80, 'Area is too long');
  if (!partial || body.lat != null || body.lng != null) {
    const lat = coord(body.lat, 'Location is invalid');
    const lng = coord(body.lng, 'Location is invalid');
    if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new HttpError(400, 'Location is invalid');
    }
    next.lat = lat;
    next.lng = lng;
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'phone')) {
    next.phone = textOf(required(body.phone, 'Phone is required'), 20, 'Phone is too long');
    if (!next.phone) throw new HttpError(400, 'Phone is required');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'opensAt')) next.opensAt = timeOf(body.opensAt, 'Open time is invalid');
  if (Object.prototype.hasOwnProperty.call(body, 'closesAt')) next.closesAt = timeOf(body.closesAt, 'Close time is invalid');
  return next;
}

router.post('/shops', requireRole('shop'), asyncHandler(async (req, res) => {
  const existing = await db.Shop.findOne({ where: { userId: req.auth.user.id } });
  if (existing) throw new HttpError(409, 'Shop already exists');
  const input = shopInput(req.body);
  let shop;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      shop = await db.Shop.create({ userId: req.auth.user.id, code: shopCode(), ...input });
      break;
    } catch (error) {
      if (attempt === 2 || !error.name || error.name !== 'SequelizeUniqueConstraintError') throw error;
    }
  }
  send(res, { id: shop.id, code: shop.code }, 201);
}));

router.get('/shops/me', requireRole('shop'), asyncHandler(async (req, res) => {
  const shop = await db.Shop.findOne({ where: { userId: req.auth.user.id } });
  if (!shop) throw new HttpError(404, 'Shop not found');
  send(res, ownerView(shop));
}));

router.patch('/shops', requireRole('shop'), asyncHandler(async (req, res) => {
  const shop = await db.Shop.findOne({ where: { userId: req.auth.user.id } });
  if (!shop) throw new HttpError(404, 'Shop not found');
  Object.assign(shop, shopInput(req.body, true));
  await shop.save();
  send(res, ownerView(shop));
}));

const handleNearby = asyncHandler(async (req, res) => {
  const source = req.method === 'GET' ? req.query : req.body;
  const point = pointOf(source || {});
  const area = textOf(source && source.area, 80, 'Area is too long');
  if (point.lat == null && !area) throw new HttpError(400, 'Location or area is required');
  send(res, await nearby(req.auth.user, { lat: point.lat, lng: point.lng, area }));
});

router.get('/shops/nearby', requireRole('girl'), requirePin, handleNearby);
router.post('/shops/nearby', requireRole('girl'), requirePin, handleNearby);

router.get('/shops/saved', requireRole('girl'), requirePin, asyncHandler(async (req, res) => {
  const saved = await db.SavedShop.findAll({
    where: { userId: req.auth.user.id },
    include: [{ model: db.Shop }],
    order: [['createdAt', 'DESC']],
  });
  send(res, saved.filter((s) => s.Shop).map((s) => ({
    id: s.Shop.id,
    code: s.Shop.code,
    name: s.Shop.name,
    area: s.Shop.area,
    address: s.Shop.address,
    lat: Number(s.Shop.lat),
    lng: Number(s.Shop.lng),
    phone: s.Shop.phone,
    opensAt: s.Shop.opensAt,
    closesAt: s.Shop.closesAt,
    saved: true,
  })));
}));

router.post('/shops/saved', requireRole('girl'), requirePin, asyncHandler(async (req, res) => {
  const code = String(required(req.body.code, 'Code is required')).trim().toUpperCase();
  const shop = await db.Shop.findOne({ where: { code } });
  if (!shop) throw new HttpError(404, 'Shop not found');
  await db.SavedShop.findOrCreate({ where: { userId: req.auth.user.id, shopId: shop.id } });
  send(res, { id: shop.id, name: shop.name }, 201);
}));

router.delete('/shops/saved/:id', requireRole('girl'), requirePin, asyncHandler(async (req, res) => {
  await db.SavedShop.destroy({ where: { userId: req.auth.user.id, shopId: req.params.id } });
  sendEmpty(res);
}));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get('/shops/:id', asyncHandler(async (req, res, next) => {
  if (!UUID_RE.test(req.params.id)) {
    next();
    return;
  }
  const shop = await db.Shop.findByPk(req.params.id);
  if (!shop) throw new HttpError(404, 'Shop not found');
  let saved = false;
  if (req.auth && req.auth.user && req.auth.user.role === 'girl') {
    const isSaved = await db.SavedShop.findOne({
      where: { userId: req.auth.user.id, shopId: shop.id },
    });
    saved = Boolean(isSaved);
  }
  send(res, {
    id: shop.id,
    code: shop.code,
    name: shop.name,
    area: shop.area,
    address: shop.address,
    lat: Number(shop.lat),
    lng: Number(shop.lng),
    phone: shop.phone,
    opensAt: shop.opensAt,
    closesAt: shop.closesAt,
    saved,
  });
}));

module.exports = router;
