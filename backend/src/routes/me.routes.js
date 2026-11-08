const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { send, sendEmpty } = require('../utils/respond');
const { codeOf } = require('../utils/validate');
const { clearCookie } = require('../utils/cookies');
const { requireUser, requirePin } = require('../middleware/auth');
const { profile } = require('../services/profile');
const account = require('../services/account');
const period = require('../services/period');

const router = express.Router();

router.get('/me', requireUser, (req, res) => {
  send(res, profile(req.auth.user));
});

router.get('/me/export', requireUser, requirePin, asyncHandler(async (req, res) => {
  send(res, await period.exportData(req.auth.user));
}));

router.patch('/me', requireUser, asyncHandler(async (req, res) => {
  send(res, await account.updateMe(req.auth.user, req.body, req.auth.session));
}));

router.delete('/me', requireUser, asyncHandler(async (req, res) => {
  await account.deleteMe(req.auth.user, codeOf(req.body.code));
  clearCookie(res);
  sendEmpty(res);
}));

module.exports = router;
