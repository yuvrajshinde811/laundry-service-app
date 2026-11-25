const express = require('express');
const router = express.Router();
const {
  adminChat,
  clearAdminChat,
  confirmAdminAction,
  getBusinessSummary,
  getRevenueInsights
} = require('../controllers/adminAIController');
const { verifyAdminToken } = require('../middleware/authMiddleware');
const { adminAILimiter, validateChatRequest } = require('../middleware/aiRateLimit');

// Strict admin JWT authentication on all Admin AI routes
router.use(verifyAdminToken);
router.use(adminAILimiter);

// POST /api/admin/ai/chat - Admin AI assistant chat
router.post('/chat', validateChatRequest, adminChat);

// POST /api/admin/ai/chat/clear - Clear admin AI chat session
router.post('/chat/clear', clearAdminChat);

// POST /api/admin/ai/confirm-action - Confirm/cancel proposed order modification
router.post('/confirm-action', confirmAdminAction);

// GET /api/admin/ai/business-summary - Real-time business performance summary
router.get('/business-summary', getBusinessSummary);

// GET /api/admin/ai/revenue-insights - Real-time revenue analytics & trends
router.get('/revenue-insights', getRevenueInsights);

module.exports = router;
