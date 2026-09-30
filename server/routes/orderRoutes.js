const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrderById,
  trackOrder,
  getServicesCatalog
} = require('../controllers/orderController');
const {
  validateOrderCreation,
  validateOrderTracking
} = require('../middleware/validationMiddleware');

// POST /api/orders - Create new laundry booking
router.post('/', validateOrderCreation, createOrder);

// POST /api/orders/track - Track order by ID + Phone
router.post('/track', validateOrderTracking, trackOrder);

// GET /api/orders/services - Get services & price catalog
router.get('/services', getServicesCatalog);

// GET /api/orders/:orderId - Get single order details
router.get('/:orderId', getOrderById);

module.exports = router;
