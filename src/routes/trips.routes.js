const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { send, sendEmpty } = require('../utils/respond');
const { dateOf } = require('../utils/validate');
const { requireRole, requirePin } = require('../middleware/auth');
const period = require('../services/period');

const router = express.Router();
const girl = [requireRole('girl'), requirePin];

router.get('/trips', girl, asyncHandler(async (req, res) => {
  send(res, await period.listTrips(req.auth.user));
}));

router.post('/trips', girl, asyncHandler(async (req, res) => {
  const start = dateOf(req.body.start, 'Start is invalid');
  const end = dateOf(req.body.end, 'End is invalid');
  const name = req.body.name ? String(req.body.name).trim().slice(0, 100) : null;
  const destination = req.body.destination ? String(req.body.destination).trim().slice(0, 120) : null;
  const activities = Array.isArray(req.body.activities) ? req.body.activities : [];
  const checklist = Array.isArray(req.body.checklist) ? req.body.checklist : [];

  send(res, await period.addTrip(
    req.auth.user,
    start,
    end,
    name,
    destination,
    activities,
    checklist
  ), 201);
}));

router.get('/trips/:id', girl, asyncHandler(async (req, res) => {
  send(res, await period.getTrip(req.auth.user, req.params.id));
}));

router.patch('/trips/:id', girl, asyncHandler(async (req, res) => {
  const updates = {};
  if (req.body.start) updates.start = dateOf(req.body.start, 'Start is invalid');
  if (req.body.end) updates.end = dateOf(req.body.end, 'End is invalid');
  if (req.body.name !== undefined) {
    updates.name = req.body.name ? String(req.body.name).trim().slice(0, 100) : null;
  }
  if (req.body.destination !== undefined) {
    updates.destination = req.body.destination ? String(req.body.destination).trim().slice(0, 120) : null;
  }
  if (req.body.activities !== undefined && Array.isArray(req.body.activities)) {
    updates.activities = req.body.activities;
  }
  if (req.body.checklist !== undefined && Array.isArray(req.body.checklist)) {
    updates.checklist = req.body.checklist;
  }

  send(res, await period.updateTrip(req.auth.user, req.params.id, updates));
}));

router.delete('/trips/:id', girl, asyncHandler(async (req, res) => {
  await period.removeTrip(req.auth.user, req.params.id);
  sendEmpty(res);
}));

module.exports = router;
