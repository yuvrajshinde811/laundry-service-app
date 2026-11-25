const Order = require('../models/Order');
const Customer = require('../models/Customer');
const { notifyStatusUpdate, formatWhatsAppNumber } = require('../services/whatsappService');
const { memoryStore, isUsingMemoryStore } = require('../config/database');

const VALID_ORDER_STATUSES = [
  'Pending',
  'Booking Confirmed',
  'Pickup Scheduled',
  'Picked Up',
  'Washing',
  'Ironing',
  'Ready for Delivery',
  'Out for Delivery',
  'Delivered',
  'Cancelled'
];

/**
 * Retrieve all orders from MongoDB or in-memory store
 */
async function fetchAllOrders() {
  if (!isUsingMemoryStore()) {
    try {
      return await Order.find({}).sort({ createdAt: -1 });
    } catch (e) {
      return memoryStore.orders;
    }
  }
  return memoryStore.orders;
}

/**
 * Find single order by Mongo _id or LAUNDRY-... orderId
 */
async function findOrderByAnyId(id) {
  const cleanId = String(id || '').trim();
  let order = null;

  if (!isUsingMemoryStore()) {
    try {
      if (cleanId.toUpperCase().startsWith('LAUNDRY-')) {
        order = await Order.findOne({ orderId: cleanId.toUpperCase() });
      } else {
        order = await Order.findById(cleanId);
      }
    } catch (e) {}
  }

  if (!order) {
    order = memoryStore.orders.find(
      (o) => o.orderId === cleanId.toUpperCase() || o._id === cleanId
    );
  }
  return order;
}

/**
 * Authorized internal helper to update an order's status
 */
async function performStatusUpdate({ id, status, note = '', sendCustomerWhatsApp = true, actor = 'admin' }) {
  if (!VALID_ORDER_STATUSES.includes(status)) {
    return { success: false, statusCode: 400, message: `Invalid order status: ${status}` };
  }

  const order = await findOrderByAnyId(id);
  if (!order) {
    return { success: false, statusCode: 404, message: 'Order not found' };
  }

  const previousStatus = order.status;
  order.status = status;
  order.updatedAt = new Date();
  if (!order.statusHistory) order.statusHistory = [];

  order.statusHistory.push({
    status,
    timestamp: new Date(),
    note: note || `Status updated from ${previousStatus} to ${status} by ${actor}`
  });

  if (!isUsingMemoryStore() && typeof order.save === 'function') {
    await order.save().catch(() => {});
  }

  let notificationResult = null;
  if (sendCustomerWhatsApp && previousStatus !== status) {
    try {
      notificationResult = await notifyStatusUpdate(order, status, note);
    } catch (waErr) {
      console.warn('Customer status WhatsApp alert failure:', waErr.message);
    }
  }

  return {
    success: true,
    statusCode: 200,
    message: `Order status updated to "${status}" successfully.`,
    order,
    whatsappNotification: notificationResult
  };
}

/**
 * Authorized internal helper to cancel an order
 */
async function performOrderCancel({ id, reason = 'Cancelled by administrator' }) {
  const order = await findOrderByAnyId(id);
  if (!order) {
    return { success: false, statusCode: 404, message: 'Order not found' };
  }

  order.status = 'Cancelled';
  order.updatedAt = new Date();
  if (!order.statusHistory) order.statusHistory = [];
  order.statusHistory.push({
    status: 'Cancelled',
    timestamp: new Date(),
    note: reason
  });

  if (!isUsingMemoryStore() && typeof order.save === 'function') {
    await order.save().catch(() => {});
  }

  return {
    success: true,
    statusCode: 200,
    message: 'Order has been cancelled successfully.',
    order
  };
}

/**
 * Compute comprehensive, real business analytics from actual database records
 */
async function computeBusinessAnalytics() {
  const allOrders = await fetchAllOrders();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - 6);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const todayStr = now.toISOString().split('T')[0];

  let todayOrders = 0;
  let todayRevenue = 0;
  let weekOrders = 0;
  let weekRevenue = 0;
  let thisMonthOrders = 0;
  let thisMonthRevenue = 0;
  let lastMonthOrders = 0;
  let lastMonthRevenue = 0;
  let totalRevenue = 0;

  let pendingOrders = 0;
  let awaitingPickupCount = 0;
  let processingOrders = 0;
  let readyOrders = 0;
  let completedOrders = 0;
  let cancelledOrders = 0;
  let expressOrders = 0;

  const statusCounts = {};
  VALID_ORDER_STATUSES.forEach((s) => (statusCounts[s] = 0));

  const serviceStats = {};
  const itemStats = {};
  const customerMap = {};
  const delayedOrders = [];
  const attentionOrders = [];

  // 7-day trend buckets
  const dailyTrendMap = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfToday);
    d.setDate(startOfToday.getDate() - i);
    const key = d.toISOString().split('T')[0];
    dailyTrendMap[key] = { date: key, orders: 0, revenue: 0 };
  }

  allOrders.forEach((o) => {
    const createdAt = new Date(o.createdAt || now);
    const amount = Number(o.totalAmount) || 0;
    const isCancelled = o.status === 'Cancelled';

    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;

    if (['Pending', 'Booking Confirmed'].includes(o.status)) {
      pendingOrders++;
      awaitingPickupCount++;
    } else if (o.status === 'Pickup Scheduled') {
      awaitingPickupCount++;
      processingOrders++;
    } else if (['Picked Up', 'Washing', 'Ironing'].includes(o.status)) {
      processingOrders++;
    } else if (['Ready for Delivery', 'Out for Delivery'].includes(o.status)) {
      readyOrders++;
    } else if (o.status === 'Delivered') {
      completedOrders++;
    } else if (isCancelled) {
      cancelledOrders++;
    }

    if (o.deliveryPreference === 'Express') {
      expressOrders++;
    }

    if (!isCancelled) {
      totalRevenue += amount;

      if (createdAt >= startOfToday) {
        todayOrders++;
        todayRevenue += amount;
      }
      if (createdAt >= startOfWeek) {
        weekOrders++;
        weekRevenue += amount;
      }
      if (createdAt >= startOfThisMonth) {
        thisMonthOrders++;
        thisMonthRevenue += amount;
      } else if (createdAt >= startOfLastMonth && createdAt <= endOfLastMonth) {
        lastMonthOrders++;
        lastMonthRevenue += amount;
      }

      const dayKey = createdAt.toISOString().split('T')[0];
      if (dailyTrendMap[dayKey]) {
        dailyTrendMap[dayKey].orders += 1;
        dailyTrendMap[dayKey].revenue += amount;
      }
    } else if (createdAt >= startOfToday) {
      todayOrders++;
    }

    // Service & item breakdown
    if (!isCancelled && Array.isArray(o.items)) {
      o.items.forEach((it) => {
        const svc = it.service || 'Washing + Ironing';
        const qty = Number(it.quantity) || 1;
        const itemRev = Number(it.itemTotal) || 0;

        if (!serviceStats[svc]) {
          serviceStats[svc] = { service: svc, orderCount: 0, itemCount: 0, revenue: 0 };
        }
        serviceStats[svc].itemCount += qty;
        serviceStats[svc].revenue += itemRev;

        const itemName = it.item || 'Other';
        if (!itemStats[itemName]) {
          itemStats[itemName] = { item: itemName, quantity: 0, revenue: 0 };
        }
        itemStats[itemName].quantity += qty;
        itemStats[itemName].revenue += itemRev;
      });
    }

    // Track distinct services per order
    if (!isCancelled && Array.isArray(o.items)) {
      const seenSvcs = new Set(o.items.map((it) => it.service || 'Washing + Ironing'));
      seenSvcs.forEach((svc) => {
        if (serviceStats[svc]) serviceStats[svc].orderCount += 1;
      });
    }

    // Top customers
    const custPhone = o.customerSnapshot?.phone || 'unknown';
    if (!customerMap[custPhone]) {
      customerMap[custPhone] = {
        name: o.customerSnapshot?.name || 'Customer',
        phone: custPhone,
        city: o.customerSnapshot?.city || '',
        orderCount: 0,
        totalSpent: 0
      };
    }
    customerMap[custPhone].orderCount += 1;
    if (!isCancelled) customerMap[custPhone].totalSpent += amount;

    // Identify delayed or attention-required orders
    const isActive = !['Delivered', 'Cancelled'].includes(o.status);
    if (isActive) {
      const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      const isPastPickupDate = o.pickupDate && o.pickupDate < todayStr && ['Pending', 'Booking Confirmed', 'Pickup Scheduled'].includes(o.status);
      const isPastDeliveryDate = o.deliveryDate && o.deliveryDate < todayStr;
      const isExpressUrgent = o.deliveryPreference === 'Express' && ageHours >= 18;

      if (isPastPickupDate || isPastDeliveryDate || isExpressUrgent) {
        delayedOrders.push({
          orderId: o.orderId,
          customerName: o.customerSnapshot?.name,
          phone: o.customerSnapshot?.phone,
          status: o.status,
          pickupDate: o.pickupDate,
          deliveryDate: o.deliveryDate,
          deliveryPreference: o.deliveryPreference,
          totalAmount: amount,
          reason: isPastPickupDate
            ? 'Pickup date has passed without pickup completion'
            : isPastDeliveryDate
              ? 'Estimated delivery date has passed'
              : 'Express 24h order approaching deadline'
        });
      }

      if (['Pending', 'Booking Confirmed', 'Ready for Delivery'].includes(o.status) || isPastPickupDate || isExpressUrgent) {
        attentionOrders.push({
          orderId: o.orderId,
          customerName: o.customerSnapshot?.name,
          status: o.status,
          pickupDate: o.pickupDate,
          pickupTimeSlot: o.pickupTimeSlot,
          deliveryPreference: o.deliveryPreference,
          totalAmount: amount
        });
      }
    }
  });

  const totalOrders = allOrders.length;
  const nonCancelledCount = totalOrders - cancelledOrders;
  const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
  const cancellationRate = totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0;
  const averageOrderValue = nonCancelledCount > 0 ? Math.round(totalRevenue / nonCancelledCount) : 0;

  let monthOverMonthGrowthPercent = null;
  if (lastMonthRevenue > 0) {
    monthOverMonthGrowthPercent = Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100);
  }

  const popularServices = Object.values(serviceStats).sort((a, b) => b.itemCount - a.itemCount);
  const popularItems = Object.values(itemStats).sort((a, b) => b.quantity - a.quantity);
  const topCustomers = Object.values(customerMap)
    .sort((a, b) => b.orderCount - a.orderCount || b.totalSpent - a.totalSpent)
    .slice(0, 5);

  // Operational bottlenecks
  const bottlenecks = [];
  if (delayedOrders.length > 0) {
    bottlenecks.push(`${delayedOrders.length} active order(s) are delayed or past scheduled pickup/delivery window.`);
  }
  if (awaitingPickupCount >= 3) {
    bottlenecks.push(`${awaitingPickupCount} orders are awaiting pickup — review driver dispatch.`);
  }
  if (readyOrders >= 3) {
    bottlenecks.push(`${readyOrders} orders are ready/out for delivery — prioritize final drop-offs.`);
  }
  if (statusCounts['Washing'] + statusCounts['Ironing'] >= 5) {
    bottlenecks.push(`${statusCounts['Washing'] + statusCounts['Ironing']} orders are currently in washing/ironing processing.`);
  }

  return {
    generatedAt: now.toISOString(),
    overview: {
      totalOrders,
      todayOrders,
      todayRevenue,
      weekOrders,
      weekRevenue,
      thisMonthOrders,
      thisMonthRevenue,
      lastMonthOrders,
      lastMonthRevenue,
      monthOverMonthGrowthPercent,
      totalRevenue,
      averageOrderValue,
      pendingOrders,
      awaitingPickupCount,
      processingOrders,
      readyOrders,
      completedOrders,
      cancelledOrders,
      expressOrders,
      completionRate,
      cancellationRate,
      totalCustomers: Object.keys(customerMap).length
    },
    statusCounts,
    popularServices,
    popularItems,
    topCustomers,
    delayedOrders,
    attentionOrders: attentionOrders.slice(0, 10),
    bottlenecks,
    dailyTrend: Object.values(dailyTrendMap)
  };
}

/**
 * Get all orders with search, filter, and pagination
 * GET /api/admin/orders
 */
const getAllOrders = async (req, res, next) => {
  try {
    const {
      status,
      search,
      date,
      page = 1,
      limit = 25
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 25;

    let allOrdersList = [];

    if (!isUsingMemoryStore()) {
      try {
        const query = {};
        if (status && status !== 'All') query.status = status;
        if (date) query.pickupDate = date;
        if (search && search.trim() !== '') {
          const searchRegex = new RegExp(search.trim(), 'i');
          query.$or = [
            { orderId: searchRegex },
            { 'customerSnapshot.name': searchRegex },
            { 'customerSnapshot.phone': searchRegex }
          ];
        }
        allOrdersList = await Order.find(query).sort({ createdAt: -1 });
      } catch (e) {
        allOrdersList = memoryStore.orders;
      }
    } else {
      allOrdersList = memoryStore.orders;
    }

    // Apply in-memory filtering if memory fallback
    let filtered = [...allOrdersList];
    if (status && status !== 'All') {
      filtered = filtered.filter((o) => o.status === status);
    }
    if (date) {
      filtered = filtered.filter((o) => o.pickupDate === date);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.orderId.toLowerCase().includes(q) ||
          (o.customerSnapshot?.name || '').toLowerCase().includes(q) ||
          (o.customerSnapshot?.phone || '').includes(q)
      );
    }

    const totalOrders = filtered.length;
    const totalPages = Math.ceil(totalOrders / limitNum) || 1;
    const skip = (pageNum - 1) * limitNum;
    const paginatedOrders = filtered.slice(skip, skip + limitNum);

    res.status(200).json({
      success: true,
      orders: paginatedOrders,
      pagination: {
        totalOrders,
        totalPages,
        currentPage: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single order details with customer contact URL
 * GET /api/admin/orders/:id
 */
const getOrderDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    let order;

    if (!isUsingMemoryStore()) {
      try {
        if (id.startsWith('LAUNDRY-')) {
          order = await Order.findOne({ orderId: id });
        } else {
          order = await Order.findById(id);
        }
      } catch (e) {}
    }

    if (!order) {
      order = memoryStore.orders.find((o) => o.orderId === id || o._id === id);
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const phone = formatWhatsAppNumber(order.customerSnapshot?.whatsappNumber || order.customerSnapshot?.phone);
    const prefilledMessage = encodeURIComponent(
      `Hello ${order.customerSnapshot?.name}, this is from Laundry Services regarding your Order #${order.orderId}.`
    );
    const directCustomerWhatsAppUrl = `https://wa.me/${phone}?text=${prefilledMessage}`;

    res.status(200).json({
      success: true,
      order,
      directCustomerWhatsAppUrl
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order status
 * PATCH /api/admin/orders/:id/status
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note, sendCustomerWhatsApp = true } = req.body;
    const result = await performStatusUpdate({ id, status, note, sendCustomerWhatsApp, actor: 'admin' });

    if (!result.success) {
      return res.status(result.statusCode).json({
        success: false,
        message: result.message
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      order: result.order,
      whatsappNotification: result.whatsappNotification
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get comprehensive Admin Dashboard Statistics
 * GET /api/admin/stats
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const analytics = await computeBusinessAnalytics();
    const allOrders = await fetchAllOrders();
    const recentOrders = allOrders.slice(0, 8);

    res.status(200).json({
      success: true,
      stats: {
        totalOrders: analytics.overview.totalOrders,
        todayOrders: analytics.overview.todayOrders,
        pendingOrders: analytics.overview.pendingOrders,
        processingOrders: analytics.overview.processingOrders,
        readyOrders: analytics.overview.readyOrders,
        completedOrders: analytics.overview.completedOrders,
        cancelledOrders: analytics.overview.cancelledOrders,
        totalCustomers: Math.max(1, analytics.overview.totalCustomers),
        totalRevenue: analytics.overview.totalRevenue,
        todayRevenue: analytics.overview.todayRevenue
      },
      recentOrders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel an order
 * POST /api/admin/orders/:id/cancel
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'Cancelled by administrator' } = req.body;
    const result = await performOrderCancel({ id, reason });

    if (!result.success) {
      return res.status(result.statusCode).json({
        success: false,
        message: result.message
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      order: result.order
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllOrders,
  getOrderDetails,
  updateOrderStatus,
  getDashboardStats,
  cancelOrder,
  VALID_ORDER_STATUSES,
  fetchAllOrders,
  findOrderByAnyId,
  performStatusUpdate,
  performOrderCancel,
  computeBusinessAnalytics
};
