const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { send, sendEmpty } = require('../utils/respond');
const { emailOf, codeOf, pinOf, oneOf } = require('../utils/validate');
const { writeCookie, clearCookie } = require('../utils/cookies');
const { requireUser } = require('../middleware/auth');
const account = require('../services/account');

const router = express.Router();

router.get('/auth/status', (req, res) => {
  if (!req.auth || !req.auth.user) {
    send(res, { authenticated: false });
    return;
  }
  const unlocked = Boolean(
    req.auth.session &&
    req.auth.session.unlockedUntil &&
    new Date(req.auth.session.unlockedUntil) > new Date()
  );
  send(res, {
    authenticated: true,
    role: req.auth.user.role,
    email: req.auth.user.email,
    pinSet: Boolean(req.auth.user.pinHash),
    pinUnlocked: unlocked,
    unlockedUntil: req.auth.session ? req.auth.session.unlockedUntil : null,
  });
});

router.post('/auth/otp', asyncHandler(async (req, res) => {
  const data = await account.requestOtp({
    email: emailOf(req.body.email),
    purpose: req.body.purpose || 'login',
    user: req.auth && req.auth.user,
    ip: req.ip || 'local',
  });
  send(res, data);
}));

router.post('/auth/verify', asyncHandler(async (req, res) => {
  const role = req.body.role == null ? 'girl' : oneOf(req.body.role, ['girl', 'shop'], 'Role is invalid');
  const result = await account.verifyLogin({
    email: emailOf(req.body.email),
    code: codeOf(req.body.code),
    role,
  });
  writeCookie(res, result.token);
  send(res, { ...result.body, token: result.token });
}));

router.post('/auth/phone/otp', asyncHandler(async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  const data = await account.requestPhoneOtp({
    phone,
    purpose: req.body.purpose || 'login',
    ip: req.ip || 'local',
  });
  send(res, data);
}));

router.post('/auth/phone/verify', asyncHandler(async (req, res) => {
  const phone = String(req.body.phone || '').trim();
  const role = req.body.role == null ? 'girl' : oneOf(req.body.role, ['girl', 'shop'], 'Role is invalid');
  const result = await account.verifyPhoneLogin({
    phone,
    code: codeOf(req.body.code),
    role,
  });
  writeCookie(res, result.token);
  send(res, { ...result.body, token: result.token });
}));

router.post('/auth/firebase-phone', asyncHandler(async (req, res) => {
  const idToken = String(req.body.idToken || '').trim();
  const role = req.body.role == null ? 'girl' : oneOf(req.body.role, ['girl', 'shop'], 'Role is invalid');
  const result = await account.loginWithFirebasePhone({
    idToken,
    role,
  });
  writeCookie(res, result.token);
  send(res, { ...result.body, token: result.token });
}));

router.post('/auth/logout', requireUser, asyncHandler(async (req, res) => {
  await account.logout(req.auth.session);
  clearCookie(res);
  sendEmpty(res);
}));

router.post('/auth/logout-all', requireUser, asyncHandler(async (req, res) => {
  await account.logoutAll(req.auth.user, codeOf(req.body.code));
  clearCookie(res);
  sendEmpty(res);
}));

router.post('/auth/pin', requireUser, asyncHandler(async (req, res) => {
  send(res, await account.unlockPin(req.auth.user, req.auth.session, pinOf(req.body.pin)));
}));

router.post('/auth/lock', requireUser, asyncHandler(async (req, res) => {
  req.auth.session.unlockedUntil = null;
  await req.auth.session.save();
  sendEmpty(res);
}));

module.exports = router;
