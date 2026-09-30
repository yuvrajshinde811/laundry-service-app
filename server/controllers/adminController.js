const Order = require('../models/Order');
const Customer = require('../models/Customer');
const { notifyStatusUpdate, formatWhatsAppNumber } = require('../services/whatsappService');
const { memoryStore, isUsingMemoryStore } = require('../config/database');

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

    let order;
    if (!isUsingMemoryStore()) {
      try {
        order = id.startsWith('LAUNDRY-')
          ? await Order.findOne({ orderId: id })
          : await Order.findById(id);
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

    const previousStatus = order.status;
    order.status = status;
    if (!order.statusHistory) order.statusHistory = [];

    order.statusHistory.push({
      status,
      timestamp: new Date(),
      note: note || `Status updated from ${previousStatus} to ${status} by admin`
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

    res.status(200).json({
      success: true,
      message: `Order status updated to "${status}" successfully.`,
      order,
      whatsappNotification: notificationResult
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
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let allOrders = [];
    if (!isUsingMemoryStore()) {
      try {
        allOrders = await Order.find({});
      } catch (e) {
        allOrders = memoryStore.orders;
      }
    } else {
      allOrders = memoryStore.orders;
    }

    const totalOrders = allOrders.length;
    let todayOrders = 0;
    let pendingOrders = 0;
    let processingOrders = 0;
    let readyOrders = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let totalRevenue = 0;
    let todayRevenue = 0;

    allOrders.forEach((o) => {
      const isToday = new Date(o.createdAt) >= startOfToday;
      if (isToday) todayOrders++;

      if (['Pending', 'Booking Confirmed'].includes(o.status)) pendingOrders++;
      else if (['Pickup Scheduled', 'Picked Up', 'Washing', 'Ironing'].includes(o.status)) processingOrders++;
      else if (['Ready for Delivery', 'Out for Delivery'].includes(o.status)) readyOrders++;
      else if (o.status === 'Delivered') completedOrders++;
      else if (o.status === 'Cancelled') cancelledOrders++;

      if (o.status !== 'Cancelled') {
        const amt = o.totalAmount || 0;
        totalRevenue += amt;
        if (isToday) todayRevenue += amt;
      }
    });

    const recentOrders = allOrders.slice(0, 8);

    res.status(200).json({
      success: true,
      stats: {
        totalOrders,
        todayOrders,
        pendingOrders,
        processingOrders,
        readyOrders,
        completedOrders,
        cancelledOrders,
        totalCustomers: Math.max(1, totalOrders),
        totalRevenue,
        todayRevenue
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

    let order;
    if (!isUsingMemoryStore()) {
      try {
        order = id.startsWith('LAUNDRY-')
          ? await Order.findOne({ orderId: id })
          : await Order.findById(id);
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

    order.status = 'Cancelled';
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status: 'Cancelled',
      timestamp: new Date(),
      note: reason
    });

    if (!isUsingMemoryStore() && typeof order.save === 'function') {
      await order.save().catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: 'Order has been cancelled successfully.',
      order
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
  cancelOrder
};
