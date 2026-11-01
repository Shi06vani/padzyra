const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const aiCompanion = require('../services/aiCompanion');

const router = express.Router();

router.post('/coach/chat', asyncHandler(async (req, res) => {
  const user = req.auth?.user;
  const { message } = req.body;
  if (!message || !message.trim()) {
    const err = new Error('Message is required');
    err.status = 400;
    throw err;
  }

  const response = await aiCompanion.chat(user, {
    message,
    useCycleHistory: true,
    ...req.body,
  });
  send(res, response);
}));

module.exports = router;
