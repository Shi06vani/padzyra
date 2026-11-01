const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const threadsService = require('../services/threads');

const router = express.Router();

router.get('/threads', asyncHandler(async (req, res) => {
  const { tag, limit, offset } = req.query;
  const list = await threadsService.listThreads({
    tag,
    limit: limit ? parseInt(limit, 10) : 50,
    offset: offset ? parseInt(offset, 10) : 0,
  });
  send(res, list);
}));

router.post('/threads', asyncHandler(async (req, res) => {
  const user = req.auth?.user;
  const { content, authorName, isAnonymous, tag, feeling } = req.body;
  const created = await threadsService.createThread(user, {
    content,
    authorName,
    isAnonymous,
    tag,
    feeling,
  });
  send(res, created, 201);
}));

router.post('/threads/:id/like', asyncHandler(async (req, res) => {
  const result = await threadsService.toggleLike(req.params.id);
  send(res, result);
}));

router.post('/threads/:id/hug', asyncHandler(async (req, res) => {
  const result = await threadsService.addHug(req.params.id);
  send(res, result);
}));

router.get('/threads/:id/replies', asyncHandler(async (req, res) => {
  const list = await threadsService.listReplies(req.params.id);
  send(res, list);
}));

router.post('/threads/:id/replies', asyncHandler(async (req, res) => {
  const user = req.auth?.user;
  const { content, authorName, isAnonymous } = req.body;
  const reply = await threadsService.addReply(req.params.id, user, {
    content,
    authorName,
    isAnonymous,
  });
  send(res, reply, 201);
}));

module.exports = router;
