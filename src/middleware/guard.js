const HttpError = require('../utils/httpError');

const hits = new Map();

function rateLimit(windowMs, max) {
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || 'local';
    const recent = (hits.get(key) || []).filter((at) => now - at < windowMs);
    if (recent.length >= max) {
      next(new HttpError(429, 'Too many requests'));
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 10000) hits.clear();
    next();
  };
}

function csrf(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  if (req.get('x-padzyra') !== '1') {
    next(new HttpError(403, 'Missing request header'));
    return;
  }
  next();
}

module.exports = { rateLimit, csrf };
