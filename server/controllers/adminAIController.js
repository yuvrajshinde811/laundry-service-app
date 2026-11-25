const {
  isAIEnabled,
  isAIConfigured,
  getAIConfigStatus,
  runAdminAIChat
} = require('../services/aiService');
const {
  getOrCreateSession,
  setPendingAdminAction,
  clearSession
} = require('../services/conversationService');
const {
  computeBusinessAnalytics,
  performStatusUpdate,
  performOrderCancel
} = require('./adminController');

/**
 * POST /api/admin/ai/chat
 * Admin AI Assistant chat endpoint (requires verifyAdminToken)
 */
const adminChat = async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;
    const result = await runAdminAIChat({
      admin: req.admin,
      sessionId,
      message
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/ai/chat/clear
 * Clear admin AI conversation history
 */
const clearAdminChat = (req, res) => {
  const { sessionId } = req.body || {};
  const scope = `admin:${req.admin?.id || req.admin?.email || 'default'}`;
  const cleared = clearSession(scope, sessionId);
  res.status(200).json({
    success: true,
    cleared,
    message: 'Admin AI chat history cleared.'
  });
};

/**
 * POST /api/admin/ai/confirm-action
 * Execute an explicitly confirmed proposed action from the Admin AI Assistant
 */
const confirmAdminAction = async (req, res, next) => {
  try {
    const { sessionId, confirm } = req.body || {};
    const scope = `admin:${req.admin?.id || req.admin?.email || 'default'}`;
    const session = getOrCreateSession(scope, sessionId);

    if (!confirm) {
      setPendingAdminAction(scope, session.sessionId, null);
      return res.status(200).json({
        success: true,
        executed: false,
        message: 'Proposed action was cancelled by admin.'
      });
    }

    const pending = session.pendingAdminAction;
    if (!pending) {
      return res.status(400).json({
        success: false,
        message: 'No pending action found in this session.'
      });
    }

    let result;
    if (pending.type === 'cancel_order') {
      result = await performOrderCancel({
        id: pending.orderId,
        reason: pending.note || 'Cancelled via Admin AI Assistant'
      });
    } else {
      result = await performStatusUpdate({
        id: pending.orderId,
        status: pending.newStatus,
        note: pending.note || 'Updated via Admin AI Assistant',
        sendCustomerWhatsApp: true,
        actor: req.admin?.email || 'admin-ai'
      });
    }

    setPendingAdminAction(scope, session.sessionId, null);

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        message: result.message
      });
    }

    res.status(200).json({
      success: true,
      executed: true,
      message: result.message,
      order: result.order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/ai/business-summary
 * Real database-backed operational & performance summary
 */
const getBusinessSummary = async (req, res, next) => {
  try {
    const analytics = await computeBusinessAnalytics();
    const aiStatus = await getAIConfigStatus();
    res.status(200).json({
      success: true,
      aiEnabled: aiStatus.enabled,
      aiAvailable: aiStatus.available,
      aiProvider: aiStatus.provider,
      aiModel: aiStatus.model,
      aiStatusCode: aiStatus.statusCode,
      aiStatusLabel: aiStatus.statusLabel,
      summary: analytics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/ai/revenue-insights
 * Real database-backed revenue trends & service-wise revenue breakdown
 */
const getRevenueInsights = async (req, res, next) => {
  try {
    const analytics = await computeBusinessAnalytics();
    res.status(200).json({
      success: true,
      insights: {
        todayRevenue: analytics.overview.todayRevenue,
        weekRevenue: analytics.overview.weekRevenue,
        thisMonthRevenue: analytics.overview.thisMonthRevenue,
        lastMonthRevenue: analytics.overview.lastMonthRevenue,
        monthOverMonthGrowthPercent: analytics.overview.monthOverMonthGrowthPercent,
        totalRevenue: analytics.overview.totalRevenue,
        averageOrderValue: analytics.overview.averageOrderValue,
        dailyTrend: analytics.dailyTrend,
        revenueByService: analytics.popularServices
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  adminChat,
  clearAdminChat,
  confirmAdminAction,
  getBusinessSummary,
  getRevenueInsights
};
