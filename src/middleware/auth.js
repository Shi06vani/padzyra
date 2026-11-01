const { Op } = require('sequelize');
const db = require('../models');
const HttpError = require('../utils/httpError');
const { readCookie } = require('../utils/cookies');
const { sha256 } = require('../utils/cryptoBox');

async function attachUser(req, res, next) {
  try {
    const token = readCookie(req);
    if (!token) {
      next();
      return;
    }
    const session = await db.Session.findOne({
      where: { tokenHash: sha256(token), expiresAt: { [Op.gt]: new Date() } },
    });
    if (!session) {
      next();
      return;
    }
    const user = await db.User.findByPk(session.userId);
    if (!user) {
      next();
      return;
    }
    req.auth = { user, session };
    next();
  } catch (error) {
    next(error);
  }
}

function requireUser(req, res, next) {
  if (!req.auth) {
    next(new HttpError(401, 'Login required'));
    return;
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth) {
      next(new HttpError(401, 'Login required'));
      return;
    }
    if (req.auth.user.role !== role) {
      next(new HttpError(403, 'Wrong account'));
      return;
    }
    next();
  };
}

async function requirePin(req, res, next) {
  try {
    if (!req.auth) throw new HttpError(401, 'Login required');
    const { user, session } = req.auth;
    if (user.role !== 'girl') {
      next();
      return;
    }
    if (!user.pinHash) throw new HttpError(403, 'Set a PIN first');
    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) throw new HttpError(429, 'PIN locked');
    if (!session.unlockedUntil || session.unlockedUntil <= new Date()) throw new HttpError(403, 'PIN required');
    session.unlockedUntil = new Date(Date.now() + 60 * 1000);
    await session.save();
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { attachUser, requireUser, requireRole, requirePin };
