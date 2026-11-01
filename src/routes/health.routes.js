const express = require('express');
const { sequelize } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get(
  '/health',
  asyncHandler(async (req, res) => {
    await sequelize.authenticate();
    res.json({
      status: 'ok',
      database: 'connected',
    });
  })
);

module.exports = router;
