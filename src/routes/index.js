const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const meRoutes = require('./me.routes');
const cycleRoutes = require('./cycles.routes');
const dayRoutes = require('./days.routes');
const supplyRoutes = require('./supplies.routes');
const tripRoutes = require('./trips.routes');
const homeRoutes = require('./home.routes');
const notificationRoutes = require('./notifications.routes');
const shopRoutes = require('./shops.routes');
const orderRoutes = require('./orders.routes');
const threadRoutes = require('./threads.routes');
const subscriptionRoutes = require('./subscriptions.routes');
const coachRoutes = require('./coach.routes');
const aiCompanionRoutes = require('./aiCompanion.routes');
const catalogRoutes = require('./catalog.routes');
const emergencyRoutes = require('./emergency.routes');
const { csrf, rateLimit } = require('../middleware/guard');
const { attachUser } = require('../middleware/auth');

const router = express.Router();

router.use(rateLimit(60 * 1000, 120));
router.use(csrf);
router.use(attachUser);

router.get('/', (req, res) => {
  res.json({
    name: 'Padzyra API',
    status: 'ok',
  });
});

router.use(healthRoutes);
router.use(authRoutes);
router.use(meRoutes);
router.use(cycleRoutes);
router.use(dayRoutes);
router.use(supplyRoutes);
router.use(tripRoutes);
router.use(homeRoutes);
router.use(notificationRoutes);
router.use(orderRoutes);
router.use(shopRoutes);
router.use(threadRoutes);
router.use(subscriptionRoutes);
router.use(coachRoutes);
router.use(aiCompanionRoutes);
router.use(catalogRoutes);
router.use(emergencyRoutes);

module.exports = router;
