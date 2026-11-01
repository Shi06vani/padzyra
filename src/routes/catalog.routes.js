const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const catalogService = require('../services/catalog');

const router = express.Router();

router.get('/catalog/essentials', (req, res) => {
  const { category } = req.query;
  const items = catalogService.getCatalog(category);
  const categories = catalogService.getCategories();
  send(res, {
    items,
    categories,
    total: items.length,
  });
});

router.get('/catalog/essentials/:id', (req, res) => {
  const item = catalogService.getItemById(req.params.id);
  if (!item) {
    return res.status(404).json({ error: { message: 'Item not found' } });
  }
  send(res, item);
});

module.exports = router;
