const {
  isAIEnabled,
  isAIConfigured,
  getAIConfigStatus,
  runCustomerAIChat,
  validateBookingDraft,
  mergeBookingDraft
} = require('../services/aiService');
const {
  getOrCreateSession,
  updateBookingDraft,
  resetBookingDraft,
  clearSession
} = require('../services/conversationService');
const {
  BUSINESS_INFO,
  calculateOrderQuote,
  createOrderRecord,
  lookupTrackedOrder
} = require('./orderController');

/**
 * GET /api/ai/status
 * Safe AI availability check (exposes no secrets)
 */
const getAIStatus = async (req, res, next) => {
  try {
    const status = await getAIConfigStatus();
    res.status(200).json({
      success: true,
      enabled: status.enabled,
      available: status.available,
      provider: status.provider,
      model: status.model,
      statusCode: status.statusCode,
      statusLabel: status.statusLabel,
      diagnosticMessage: status.diagnosticMessage
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/chat
 * Main customer conversational AI chatbot endpoint
 */
const customerChat = async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;
    const result = await runCustomerAIChat({ sessionId, message });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/chat/clear
 * Clear customer session conversation memory
 */
const clearCustomerChat = (req, res) => {
  const { sessionId } = req.body || {};
  const cleared = clearSession('customer', sessionId);
  res.status(200).json({
    success: true,
    cleared,
    message: 'Chat history cleared.'
  });
};

/**
 * POST /api/ai/booking-assistant
 * Structured conversational booking helper: validates draft, computes backend quote,
 * and submits order ONLY when `confirm: true` is passed explicitly.
 */
const bookingAssistant = async (req, res, next) => {
  try {
    const { sessionId, updates = {}, confirm = false } = req.body || {};
    const session = getOrCreateSession('customer', sessionId);

    const merged = mergeBookingDraft(session.bookingDraft, updates);
    updateBookingDraft('customer', session.sessionId, merged);

    const validation = validateBookingDraft(merged);
    const quote = merged.items && merged.items.length > 0
      ? await calculateOrderQuote({
          items: merged.items,
          deliveryPreference: merged.deliveryPreference,
          couponCode: merged.couponCode
        })
      : null;

    if (!confirm) {
      return res.status(200).json({
        success: true,
        confirmed: false,
        sessionId: session.sessionId,
        draft: merged,
        validation,
        quote,
        availableSlots: BUSINESS_INFO.pickupTimeSlots,
        message: validation.isValid
          ? 'All required details look complete! Would you like me to confirm this booking?'
          : `Please provide the remaining details: ${validation.missingFields.join(', ')}.`
      });
    }

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        confirmed: false,
        sessionId: session.sessionId,
        validation,
        message: validation.validationErrors[0] || `Missing required fields: ${validation.missingFields.join(', ')}`
      });
    }

    const savedOrder = await createOrderRecord({
      ...merged,
      source: 'ai_chatbot'
    });

    resetBookingDraft('customer', session.sessionId);

    res.status(201).json({
      success: true,
      confirmed: true,
      sessionId: session.sessionId,
      message: 'Booking confirmed successfully!',
      orderId: savedOrder.orderId,
      order: savedOrder,
      whatsappStatus: savedOrder.whatsappNotification
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/track-order
 * Securely retrieve and explain order status after verifying Order ID + Phone
 */
const aiTrackOrder = async (req, res, next) => {
  try {
    const { orderId, phone } = req.body || {};
    const result = await lookupTrackedOrder(orderId, phone);

    if (!result.found) {
      return res.status(result.statusCode).json({
        success: false,
        message: result.message
      });
    }

    const o = result.order;
    const summaryText = `Order ${o.orderId} is currently "${o.status}". Scheduled pickup: ${o.pickupDate} (${o.pickupTimeSlot}). Delivery preference: ${o.deliveryPreference} (Est. ${o.deliveryDate}). Total amount: ₹${o.totalAmount}.`;

    res.status(200).json({
      success: true,
      summary: summaryText,
      order: o,
      trackingProgress: result.trackingProgress
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAIStatus,
  customerChat,
  clearCustomerChat,
  bookingAssistant,
  aiTrackOrder
};
