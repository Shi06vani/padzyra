const env = require('../config/env');

const NAME = 'pz';
const MAX_AGE = 14 * 24 * 60 * 60;

function readCookie(req, name = NAME) {
  const authHeader = req.headers && req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const xToken = req.headers && req.headers['x-auth-token'];
  if (xToken) return xToken;
  const header = req.headers && req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function writeCookie(res, token) {
  const secure = env.isProduction ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}${secure}`
  );
}

function clearCookie(res) {
  const secure = env.isProduction ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
  );
}

module.exports = { NAME, readCookie, writeCookie, clearCookie };
