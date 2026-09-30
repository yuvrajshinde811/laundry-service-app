const express = require('express');
const router = express.Router();
const {
  getAllOrders,
  getOrderDetails,
  updateOrderStatus,
  getDashboardStats,
  cancelOrder
} = require('../controllers/adminController');
const { verifyAdminToken } = require('../middleware/authMiddleware');
const { validateStatusUpdate } = require('../middleware/validationMiddleware');

// All admin routes require valid JWT
router.use(verifyAdminToken);

// GET /api/admin/stats - Overview analytics & KPI cards
router.get('/stats', getDashboardStats);

// GET /api/admin/orders - Get paginated & filtered orders
router.get('/orders', getAllOrders);

// GET /api/admin/orders/:id - Get full order details
router.get('/orders/:id', getOrderDetails);

// PATCH /api/admin/orders/:id/status - Update order status & send WhatsApp
router.patch('/orders/:id/status', validateStatusUpdate, updateOrderStatus);

// POST /api/admin/orders/:id/cancel - Cancel order
router.post('/orders/:id/cancel', cancelOrder);

module.exports = router;
