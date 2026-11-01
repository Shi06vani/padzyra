const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/respond');
const { requireRole, requireUser } = require('../middleware/auth');
const emergencyService = require('../services/emergency');

const router = express.Router();

// --- 1. TOILETS ---

/**
 * GET /emergency/toilets/nearby
 * Find nearby public toilets using GPS coordinates
 */
router.get(
  '/emergency/toilets/nearby',
  asyncHandler(async (req, res) => {
    const { lat, lng, radius, limit } = req.query;
    const result = await emergencyService.findNearbyToilets({
      lat,
      lng,
      radiusKm: radius,
      limit,
    });
    send(res, result);
  })
);

/**
 * GET /emergency/toilets/search
 * Search public toilets by city, area, or landmark
 */
router.get(
  '/emergency/toilets/search',
  asyncHandler(async (req, res) => {
    const { query, limit } = req.query;
    const result = await emergencyService.searchToilets({ query, limit });
    send(res, result);
  })
);

// --- 2. PERIOD PRODUCTS & SHOPS ---

/**
 * GET /emergency/products/categories
 * Get list of menstrual product categories
 */
router.get(
  '/emergency/products/categories',
  asyncHandler(async (req, res) => {
    const categories = emergencyService.getProductCategories();
    send(res, categories);
  })
);

/**
 * GET /emergency/products/nearby
 * Find nearby pharmacies and retailers with period products
 */
router.get(
  '/emergency/products/nearby',
  asyncHandler(async (req, res) => {
    const { lat, lng, area, category, radius } = req.query;
    const result = await emergencyService.findNearbyProducts({
      lat,
      lng,
      area,
      category,
      radiusKm: radius,
    });
    send(res, result);
  })
);

/**
 * GET /emergency/shops/:shopId
 * Get details and product catalog for a specific shop
 */
router.get(
  '/emergency/shops/:shopId',
  asyncHandler(async (req, res) => {
    const result = await emergencyService.getShopDetails(req.params.shopId);
    send(res, result);
  })
);

// --- 3. EMERGENCY DELIVERY ---

/**
 * GET /emergency/delivery/availability
 * Check if emergency delivery serves the user's location
 */
router.get(
  '/emergency/delivery/availability',
  asyncHandler(async (req, res) => {
    const { lat, lng, address } = req.query;
    const result = await emergencyService.getDeliveryAvailability({ lat, lng, address });
    send(res, result);
  })
);

/**
 * GET /emergency/delivery/products
 * Get list of products eligible for emergency fast delivery
 */
router.get(
  '/emergency/delivery/products',
  asyncHandler(async (req, res) => {
    const products = emergencyService.getEmergencyDeliveryProducts();
    send(res, products);
  })
);

/**
 * POST /emergency/delivery/orders
 * Create an emergency menstrual delivery order
 */
router.post(
  '/emergency/delivery/orders',
  requireRole('girl'),
  asyncHandler(async (req, res) => {
    const { shopId, items, address, phone, notes, idempotencyKey } = req.body;
    const order = await emergencyService.createEmergencyOrder(req.auth.user, {
      shopId,
      items,
      address,
      phone,
      notes,
      idempotencyKey,
    });
    send(res, order, order.isExisting ? 200 : 201);
  })
);

/**
 * GET /emergency/delivery/orders/:orderId
 * Get emergency order tracking status and details
 */
router.get(
  '/emergency/delivery/orders/:orderId',
  requireUser,
  asyncHandler(async (req, res) => {
    const order = await emergencyService.getEmergencyOrder(req.auth.user, req.params.orderId);
    send(res, order);
  })
);

/**
 * POST /emergency/delivery/orders/:orderId/cancel
 * Cancel an emergency delivery order (if pending)
 */
router.post(
  '/emergency/delivery/orders/:orderId/cancel',
  requireRole('girl'),
  asyncHandler(async (req, res) => {
    const { reason } = req.body || {};
    const result = await emergencyService.cancelEmergencyOrder(
      req.auth.user,
      req.params.orderId,
      reason
    );
    send(res, result);
  })
);

module.exports = router;
