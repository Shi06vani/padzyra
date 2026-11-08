const { Op } = require('sequelize');
const db = require('../models');
const { nowHM } = require('../utils/dates');
const { distanceKm, roundKm, shopOpen } = require('../utils/geo');

function cleanArea(area) {
  return String(area).replace(/[%_\\]/g, '').trim();
}

async function nearby(user, { lat, lng, area }) {
  const savedRows = await db.SavedShop.findAll({ where: { userId: user.id } });
  const saved = new Set(savedRows.map((row) => row.shopId));
  let shops;
  if (area) {
    const needle = cleanArea(area);
    shops = needle
      ? await db.Shop.findAll({
        where: {
          [Op.or]: [
            { address: { [Op.iLike]: `%${needle}%` } },
            { area: { [Op.iLike]: `%${needle}%` } },
          ],
        },
      })
      : [];
  } else {
    shops = await db.Shop.findAll();
  }

  const hm = nowHM();
  const hasPoint = lat != null && lng != null;
  let items = shops.map((shop) => {
    const point = {
      id: shop.id,
      name: shop.name,
      address: shop.address,
      lat: Number(shop.lat),
      lng: Number(shop.lng),
      phone: shop.phone,
      saved: saved.has(shop.id),
      ...shopOpen(shop.opensAt, shop.closesAt, hm),
    };
    if (hasPoint) point.km = roundKm(distanceKm(lat, lng, point.lat, point.lng));
    return point;
  });

  if (hasPoint) {
    const nearbyOnly = items.filter((item) => item.saved || item.km <= 25);
    if (nearbyOnly.length > 0) {
      items = nearbyOnly;
    }
  }

  items.sort((a, b) => Number(b.saved) - Number(a.saved) || (a.km ?? 999) - (b.km ?? 999) || a.name.localeCompare(b.name));
  return items.slice(0, 20);
}

module.exports = { nearby };
