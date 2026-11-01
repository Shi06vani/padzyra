function distanceKm(lat1, lng1, lat2, lng2) {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function roundKm(km) {
  return Math.round(km * 10) / 10;
}

function shopOpen(openTime, closeTime, hm) {
  if (!openTime || !closeTime) return { open: null };
  let open;
  if (openTime < closeTime) open = hm >= openTime && hm < closeTime;
  else if (openTime > closeTime) open = hm >= openTime || hm < closeTime;
  else open = false;
  if (open) return { open: true, closes: closeTime };
  return { open: false, opens: openTime };
}

module.exports = { distanceKm, roundKm, shopOpen };
