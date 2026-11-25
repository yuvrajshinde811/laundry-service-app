const express = require('express');
const router = express.Router();
const {
  getAIStatus,
  customerChat,
  clearCustomerChat,
  bookingAssistant,
  aiTrackOrder
} = require('../controllers/chatbotController');
const { customerAILimiter, validateChatRequest } = require('../middleware/aiRateLimit');

// GET /api/ai/status - Public AI availability check
router.get('/status', getAIStatus);

// POST /api/ai/chat - Customer conversational AI chatbot
router.post('/chat', customerAILimiter, validateChatRequest, customerChat);

// POST /api/ai/chat/clear - Reset customer chat history
router.post('/chat/clear', clearCustomerChat);

// POST /api/ai/booking-assistant - Conversational booking draft & confirmed creation
router.post('/booking-assistant', customerAILimiter, bookingAssistant);

// POST /api/ai/track-order - Order tracking via AI with Order ID + Phone verification
router.post('/track-order', customerAILimiter, aiTrackOrder);

module.exports = router;
