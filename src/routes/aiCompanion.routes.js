const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { send, sendEmpty } = require('../utils/respond');
const { requireUser } = require('../middleware/auth');
const aiCompanion = require('../services/aiCompanion');

const router = express.Router();

// 1. Ask AI Companion
router.post(
  '/ai-companion/chat',
  asyncHandler(async (req, res) => {
    const user = req.auth?.user || null;
    const response = await aiCompanion.chat(user, req.body);
    send(res, response);
  })
);

// 2. Conversation History
router.get(
  '/ai-companion/conversations',
  requireUser,
  asyncHandler(async (req, res) => {
    const list = await aiCompanion.listConversations(req.auth.user);
    send(res, list);
  })
);

router.get(
  '/ai-companion/conversations/:conversationId',
  requireUser,
  asyncHandler(async (req, res) => {
    const conversation = await aiCompanion.getConversation(
      req.auth.user,
      req.params.conversationId
    );
    send(res, conversation);
  })
);

router.delete(
  '/ai-companion/conversations/:conversationId',
  requireUser,
  asyncHandler(async (req, res) => {
    await aiCompanion.deleteConversation(req.auth.user, req.params.conversationId);
    sendEmpty(res);
  })
);

// 3. Reviewed Medical Sources
router.get('/ai-companion/sources', (req, res) => {
  const sources = aiCompanion.getMedicalSources();
  send(res, sources);
});

router.get('/ai-companion/sources/:sourceId', (req, res) => {
  const source = aiCompanion.getMedicalSourceById(req.params.sourceId);
  send(res, source);
});

// 4. User Consent & Personalization Settings
router.get(
  '/ai-companion/consent',
  requireUser,
  asyncHandler(async (req, res) => {
    const consent = await aiCompanion.getUserConsent(req.auth.user);
    send(res, consent);
  })
);

router.patch(
  '/ai-companion/consent',
  requireUser,
  asyncHandler(async (req, res) => {
    const updated = await aiCompanion.updateUserConsent(req.auth.user, req.body);
    send(res, updated);
  })
);

module.exports = router;
