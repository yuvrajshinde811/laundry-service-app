const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { Service, LaundryItem } = require('../models/Service');
const { generateOrderId } = require('../utils/generateOrderId');
const { notifyOrderCreated } = require('../services/whatsappService');
const { memoryStore, isUsingMemoryStore } = require('../config/database');

// Authoritative business configuration & policies
const BUSINESS_INFO = {
  name: 'FreshWave Laundry',
  workingHours: 'Monday – Sunday, 8:00 AM – 9:00 PM',
  phone: process.env.ADMIN_WHATSAPP_NUMBER || '8080082714',
  whatsapp: process.env.ADMIN_WHATSAPP_NUMBER || '8080082714',
  email: process.env.ADMIN_DEFAULT_EMAIL || 'admin@laundry.com',
  serviceAreas: ['Mumbai (Bandra, Andheri, Dadar, Lower Parel, Powai, Juhu, Colaba, and nearby localities)'],
  pickupTimeSlots: [
    '9:00 AM – 11:00 AM',
    '11:00 AM – 1:00 PM',
    '2:00 PM – 4:00 PM',
    '4:00 PM – 6:00 PM',
    '6:00 PM – 8:00 PM'
  ],
  deliveryOptions: {
    Standard: { turnaround: '24 to 48 hours', extraCharge: 0 },
    Express: { turnaround: '24 hours guaranteed', extraCharge: 100 }
  },
  deliveryFeePolicy: {
    standardCharge: 50,
    freeDeliveryThreshold: 500
  },
  coupons: {
    FRESH10: '10% discount on garment subtotal',
    WELCOME50: 'Flat ₹50 discount on garment subtotal'
  },
  paymentMethods: ['Cash on Delivery', 'UPI on Delivery', 'QR Code on Delivery'],
  cancellationPolicy: 'Bookings can be cancelled free of charge before pickup by contacting our team on WhatsApp (+91 8080082714) or via the admin team.'
};

// Lightweight TTL cache for static/catalog data (cost optimization)
const catalogCache = {
  data: null,
  expiresAt: 0
};
const CATALOG_CACHE_TTL_MS = 60 * 1000;

// Default price catalog
const DEFAULT_CATALOG = {
  'Shirt': { basePrice: 35, washing: 25, washing_ironing: 35, dry_cleaning: 75, ironing: 15 },
  'T-Shirt': { basePrice: 30, washing: 20, washing_ironing: 30, dry_cleaning: 60, ironing: 15 },
  'Pants': { basePrice: 40, washing: 30, washing_ironing: 40, dry_cleaning: 85, ironing: 20 },
  'Jeans': { basePrice: 45, washing: 35, washing_ironing: 45, dry_cleaning: 95, ironing: 25 },
  'Saree': { basePrice: 90, washing: 60, washing_ironing: 90, dry_cleaning: 160, ironing: 40 },
  'Bedsheet': { basePrice: 90, washing: 60, washing_ironing: 90, dry_cleaning: 130, ironing: 40 },
  'Blanket': { basePrice: 180, washing: 140, washing_ironing: 180, dry_cleaning: 250, ironing: 50 },
  'Suit (2 Pcs)': { basePrice: 160, washing: 100, washing_ironing: 160, dry_cleaning: 280, ironing: 70 },
  'Kurta': { basePrice: 50, washing: 35, washing_ironing: 50, dry_cleaning: 110, ironing: 25 },
  'Other': { basePrice: 45, washing: 30, washing_ironing: 45, dry_cleaning: 85, ironing: 20 }
};

const DEFAULT_SERVICES = [
  { code: 'washing', name: 'Washing', description: 'Regular gentle washing with eco-friendly detergents.', badge: 'Daily Care', icon: 'bi-droplet', basePriceMultiplier: 0.8, estimatedHours: 24 },
  { code: 'washing_ironing', name: 'Washing + Ironing', description: 'Deep wash followed by crisp steam pressing.', badge: 'Most Popular', icon: 'bi-stars', basePriceMultiplier: 1.0, estimatedHours: 24 },
  { code: 'dry_cleaning', name: 'Dry Cleaning', description: 'Specialist solvent cleaning for delicate garments.', badge: 'Premium', icon: 'bi-shield-check', basePriceMultiplier: 2.2, estimatedHours: 48 },
  { code: 'ironing', name: 'Ironing', description: 'Professional steam ironing for crisp finish.', badge: 'Quick Service', icon: 'bi-wind', basePriceMultiplier: 0.5, estimatedHours: 12 },
  { code: 'bedsheet_cleaning', name: 'Bedsheet Cleaning', description: 'Sanitizing wash and pressing for bedsheets.', badge: 'Home Care', icon: 'bi-layers', basePriceMultiplier: 1.0, estimatedHours: 24 },
  { code: 'blanket_cleaning', name: 'Blanket & Quilt Cleaning', description: 'Heavy-duty sanitization and fluffing.', badge: 'Bulky Care', icon: 'bi-box', basePriceMultiplier: 1.8, estimatedHours: 48 }
];

function normalizeItemName(rawName) {
  if (!rawName) return 'Other';
  const cleaned = String(rawName).trim().toLowerCase();
  const keys = Object.keys(DEFAULT_CATALOG);
  const exact = keys.find((k) => k.toLowerCase() === cleaned);
  if (exact) return exact;
  if (cleaned.includes('t-shirt') || cleaned.includes('tshirt')) return 'T-Shirt';
  if (cleaned.includes('shirt')) return 'Shirt';
  if (cleaned.includes('pant') || cleaned.includes('trouser')) return 'Pants';
  if (cleaned.includes('jean')) return 'Jeans';
  if (cleaned.includes('saree') || cleaned.includes('sari')) return 'Saree';
  if (cleaned.includes('bedsheet') || cleaned.includes('bed sheet')) return 'Bedsheet';
  if (cleaned.includes('blanket') || cleaned.includes('quilt')) return 'Blanket';
  if (cleaned.includes('suit')) return 'Suit (2 Pcs)';
  if (cleaned.includes('kurta')) return 'Kurta';
  return 'Other';
}

function normalizeServiceName(rawService) {
  if (!rawService) return 'Washing + Ironing';
  const s = String(rawService).trim().toLowerCase();
  if (s.includes('dry')) return 'Dry Cleaning';
  if (s.includes('iron') && s.includes('wash')) return 'Washing + Ironing';
  if (s.includes('iron') || s.includes('press')) return 'Ironing';
  if (s.includes('wash')) return 'Washing';
  return 'Washing + Ironing';
}

function calculateItemUnitPrice(itemName, serviceType, catalog = DEFAULT_CATALOG) {
  const normalizedItem = normalizeItemName(itemName);
  const serviceKey = (serviceType || 'Washing + Ironing').toLowerCase().replace(/\+/g, '').replace(/\s+/g, '_');
  const catalogEntry = catalog[normalizedItem] || catalog['Other'] || DEFAULT_CATALOG['Other'];

  if (serviceKey.includes('dry') || serviceKey.includes('cleaning')) return catalogEntry.dry_cleaning || 80;
  if (serviceKey.includes('iron') && !serviceKey.includes('wash')) return catalogEntry.ironing || 20;
  if (serviceKey.includes('wash') && !serviceKey.includes('iron')) return catalogEntry.washing || 30;
  return catalogEntry.washing_ironing || catalogEntry.basePrice || 40;
}

/**
 * Retrieve active services and pricing catalog (cached for 60s)
 */
async function getServicesAndCatalogData() {
  const now = Date.now();
  if (catalogCache.data && catalogCache.expiresAt > now) {
    return catalogCache.data;
  }

  let services = DEFAULT_SERVICES;
  let pricingCatalog = { ...DEFAULT_CATALOG };
  let items = Object.keys(DEFAULT_CATALOG).map((name) => ({
    name,
    category: ['Bedsheet', 'Blanket'].includes(name) ? 'Household & Bedding' : (name === 'Saree' || name === 'Kurta' ? 'Traditional & Delicate' : 'Daily Wear'),
    basePrice: DEFAULT_CATALOG[name].basePrice,
    servicePrices: DEFAULT_CATALOG[name],
    unit: 'piece'
  }));

  if (!isUsingMemoryStore()) {
    try {
      const dbServices = await Service.find({ isActive: true }).sort({ displayOrder: 1 }).lean();
      if (dbServices && dbServices.length > 0) services = dbServices;

      const dbItems = await LaundryItem.find({ isActive: true }).lean();
      if (dbItems && dbItems.length > 0) {
        items = dbItems;
        const dynamicCat = { ...DEFAULT_CATALOG };
        dbItems.forEach((it) => {
          if (it.name && it.servicePrices) {
            dynamicCat[it.name] = {
              basePrice: it.basePrice,
              ...it.servicePrices
            };
          }
        });
        pricingCatalog = dynamicCat;
      }
    } catch (e) {}
  }

  const payload = { services, items, pricingCatalog, businessInfo: BUSINESS_INFO };
  catalogCache.data = payload;
  catalogCache.expiresAt = now + CATALOG_CACHE_TTL_MS;
  return payload;
}

/**
 * Compute authoritative quote on the backend
 */
async function calculateOrderQuote({ items = [], deliveryPreference = 'Standard', couponCode = '' }) {
  const { pricingCatalog } = await getServicesAndCatalogData();
  let subtotal = 0;
  const processedItems = items.map((it) => {
    const itemName = normalizeItemName(it.item);
    const quantity = Math.max(1, parseInt(it.quantity, 10) || 1);
    const service = normalizeServiceName(it.service);
    const unitPrice = calculateItemUnitPrice(itemName, service, pricingCatalog);
    const itemTotal = unitPrice * quantity;
    subtotal += itemTotal;

    return { item: itemName, quantity, service, unitPrice, itemTotal };
  });

  const deliveryCharge = subtotal >= 500 || subtotal === 0 ? 0 : 50;
  const normalizedPref = String(deliveryPreference).toLowerCase() === 'express' ? 'Express' : 'Standard';
  const expressCharge = normalizedPref === 'Express' ? 100 : 0;

  let discount = 0;
  let appliedCoupon = '';
  if (couponCode) {
    const code = String(couponCode).trim().toUpperCase();
    if (code === 'FRESH10') {
      discount = Math.round(subtotal * 0.1);
      appliedCoupon = 'FRESH10';
    } else if (code === 'WELCOME50') {
      discount = Math.min(50, subtotal);
      appliedCoupon = 'WELCOME50';
    }
  }

  const totalAmount = Math.max(0, subtotal + deliveryCharge + expressCharge - discount);

  return {
    items: processedItems,
    deliveryPreference: normalizedPref,
    subtotal,
    deliveryCharge,
    expressCharge,
    discount,
    appliedCoupon,
    totalAmount
  };
}

function calculateDeliveryDate(pickupDateStr, preference) {
  try {
    const pDate = new Date(pickupDateStr);
    if (isNaN(pDate.getTime())) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + (preference === 'Express' ? 1 : 2));
      return fallback.toISOString().split('T')[0];
    }
    const daysToAdd = preference === 'Express' ? 1 : 2;
    pDate.setDate(pDate.getDate() + daysToAdd);
    return pDate.toISOString().split('T')[0];
  } catch (e) {
    return 'Within 24-48 hours';
  }
}

/**
 * Core internal order creation helper (single source of truth for Web Form & AI Booking)
 */
async function createOrderRecord(orderInput) {
  const {
    name,
    phone,
    whatsappNumber,
    email,
    address,
    area,
    city,
    pincode,
    items,
    pickupDate,
    pickupTimeSlot,
    deliveryPreference = 'Standard',
    additionalInstructions,
    couponCode,
    source = 'online'
  } = orderInput;

  const customerSnapshot = {
    _id: new mongoose.Types.ObjectId().toString(),
    name: name.trim(),
    phone: phone.trim(),
    whatsappNumber: (whatsappNumber || phone).trim(),
    email: email ? email.trim() : '',
    address: address.trim(),
    area: area ? area.trim() : '',
    city: city ? city.trim() : 'Mumbai',
    pincode: pincode.trim(),
    createdAt: new Date()
  };

  // Authoritative backend pricing calculation
  const quote = await calculateOrderQuote({ items, deliveryPreference, couponCode });
  const orderId = generateOrderId();
  const deliveryDate = calculateDeliveryDate(pickupDate, quote.deliveryPreference);

  const newOrderData = {
    _id: new mongoose.Types.ObjectId().toString(),
    orderId,
    customer: customerSnapshot._id,
    customerSnapshot,
    items: quote.items,
    pickupDate,
    pickupTimeSlot,
    deliveryDate,
    deliveryTimeSlot: pickupTimeSlot,
    deliveryPreference: quote.deliveryPreference,
    subtotal: quote.subtotal,
    deliveryCharge: quote.deliveryCharge,
    expressCharge: quote.expressCharge,
    discount: quote.discount,
    totalAmount: quote.totalAmount,
    additionalInstructions: additionalInstructions ? additionalInstructions.trim() : '',
    status: 'Booking Confirmed',
    statusHistory: [
      {
        status: 'Booking Confirmed',
        timestamp: new Date(),
        note: source === 'ai_chatbot'
          ? 'Booking placed via Customer AI Assistant'
          : 'Booking placed online by customer'
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  let savedOrder;
  if (!isUsingMemoryStore()) {
    try {
      await Customer.findOneAndUpdate(
        { phone: customerSnapshot.phone },
        customerSnapshot,
        { upsert: true, new: true }
      );
      savedOrder = await Order.create(newOrderData);
    } catch (dbErr) {
      console.warn('DB write fallback to memory:', dbErr.message);
      savedOrder = newOrderData;
      memoryStore.orders.unshift(savedOrder);
    }
  } else {
    savedOrder = newOrderData;
    memoryStore.customers.push(customerSnapshot);
    memoryStore.orders.unshift(savedOrder);
  }

  // Trigger WhatsApp notifications asynchronously without failing the booking
  let whatsappResults = { customerNotification: null, adminNotification: null };
  try {
    whatsappResults = await notifyOrderCreated(savedOrder);
    savedOrder.whatsappNotification = {
      customerSent: !!whatsappResults.customerNotification?.success,
      customerSentAt: new Date(),
      adminSent: !!whatsappResults.adminNotification?.success,
      adminSentAt: new Date(),
      mode: whatsappResults.customerNotification?.mode || 'mock-simulation',
      customerDirectChatUrl: whatsappResults.customerNotification?.directChatUrl || '',
      adminDirectChatUrl: whatsappResults.adminNotification?.directChatUrl || ''
    };

    if (!isUsingMemoryStore() && typeof savedOrder.save === 'function') {
      await savedOrder.save().catch(() => {});
    }
  } catch (waErr) {
    console.error('WhatsApp notification dispatch failure:', waErr.message);
  }

  return savedOrder;
}

/**
 * Place a new laundry booking
 * POST /api/orders
 */
const createOrder = async (req, res, next) => {
  try {
    const savedOrder = await createOrderRecord({ ...req.body, source: 'online' });

    res.status(201).json({
      success: true,
      message: 'Booking confirmed successfully!',
      orderId: savedOrder.orderId,
      order: savedOrder,
      whatsappStatus: {
        customerSent: !!savedOrder.whatsappNotification?.customerSent,
        adminSent: !!savedOrder.whatsappNotification?.adminSent,
        mode: savedOrder.whatsappNotification?.mode || 'mock-simulation',
        customerDirectChatUrl: savedOrder.whatsappNotification?.customerDirectChatUrl || '',
        adminDirectChatUrl: savedOrder.whatsappNotification?.adminDirectChatUrl || ''
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get order by Order ID
 * GET /api/orders/:orderId
 */
const getOrderById = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const cleanId = orderId.trim().toUpperCase();

    let order;
    if (!isUsingMemoryStore()) {
      try {
        order = await Order.findOne({ orderId: cleanId });
      } catch (e) {}
    }

    if (!order) {
      order = memoryStore.orders.find((o) => o.orderId === cleanId || o._id === orderId);
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order with ID ${orderId} was not found.`
      });
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

/**
 * Secure order tracking lookup verifying Order ID + registered Mobile Number
 */
async function lookupTrackedOrder(orderId, phone) {
  const cleanOrderId = String(orderId || '').trim().toUpperCase();
  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);

  if (!cleanOrderId || !cleanPhone || cleanPhone.length < 10) {
    return {
      found: false,
      statusCode: 400,
      message: 'Please provide both a valid Order ID and your 10-digit registered mobile number.'
    };
  }

  let order;
  if (!isUsingMemoryStore()) {
    try {
      order = await Order.findOne({ orderId: cleanOrderId });
    } catch (e) {}
  }

  if (!order) {
    order = memoryStore.orders.find((o) => o.orderId === cleanOrderId);
  }

  if (!order) {
    return {
      found: false,
      statusCode: 404,
      message: 'No booking found matching this Order ID. Please check and try again.'
    };
  }

  const storedPhone = (order.customerSnapshot?.phone || '').replace(/\D/g, '').slice(-10);
  const storedWhatsApp = (order.customerSnapshot?.whatsappNumber || '').replace(/\D/g, '').slice(-10);

  if (storedPhone !== cleanPhone && storedWhatsApp !== cleanPhone) {
    return {
      found: false,
      statusCode: 401,
      message: 'The mobile number provided does not match the registered booking number.'
    };
  }

  const stages = [
    { key: 'Booking Confirmed', label: 'Booking Confirmed', icon: 'bi-check-circle-fill' },
    { key: 'Pickup Scheduled', label: 'Pickup Scheduled', icon: 'bi-calendar2-check-fill' },
    { key: 'Picked Up', label: 'Clothes Picked Up', icon: 'bi-bag-check-fill' },
    { key: 'Washing', label: 'Washing & Cleaning', icon: 'bi-droplet-fill' },
    { key: 'Ironing', label: 'Ironing & Quality Check', icon: 'bi-wind' },
    { key: 'Ready for Delivery', label: 'Ready for Delivery', icon: 'bi-box-seam-fill' },
    { key: 'Out for Delivery', label: 'Out for Delivery', icon: 'bi-truck' },
    { key: 'Delivered', label: 'Delivered', icon: 'bi-house-check-fill' }
  ];

  const currentStatusIndex = stages.findIndex((s) => s.key === order.status);

  return {
    found: true,
    statusCode: 200,
    order: {
      orderId: order.orderId,
      customerName: order.customerSnapshot.name,
      phone: order.customerSnapshot.phone,
      address: order.customerSnapshot.address,
      area: order.customerSnapshot.area,
      city: order.customerSnapshot.city,
      pincode: order.customerSnapshot.pincode,
      items: order.items,
      pickupDate: order.pickupDate,
      pickupTimeSlot: order.pickupTimeSlot,
      deliveryDate: order.deliveryDate,
      deliveryTimeSlot: order.deliveryTimeSlot,
      deliveryPreference: order.deliveryPreference,
      subtotal: order.subtotal,
      deliveryCharge: order.deliveryCharge,
      expressCharge: order.expressCharge,
      discount: order.discount,
      totalAmount: order.totalAmount,
      status: order.status,
      statusHistory: order.statusHistory,
      createdAt: order.createdAt
    },
    trackingProgress: {
      stages,
      currentIndex: currentStatusIndex >= 0 ? currentStatusIndex : 0,
      isCancelled: order.status === 'Cancelled'
    }
  };
}

/**
 * Track Order by Order ID + Mobile Number
 * POST /api/orders/track
 */
const trackOrder = async (req, res, next) => {
  try {
    const { orderId, phone } = req.body;
    const result = await lookupTrackedOrder(orderId, phone);

    if (!result.found) {
      return res.status(result.statusCode).json({
        success: false,
        message: result.message
      });
    }

    res.status(200).json({
      success: true,
      order: result.order,
      trackingProgress: result.trackingProgress
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get services catalog & item pricing
 * GET /api/services
 */
const getServicesCatalog = async (req, res, next) => {
  try {
    const { services, items, pricingCatalog } = await getServicesAndCatalogData();

    res.status(200).json({
      success: true,
      services,
      items,
      pricingCatalog
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getOrderById,
  trackOrder,
  getServicesCatalog,
  calculateItemUnitPrice,
  BUSINESS_INFO,
  DEFAULT_CATALOG,
  DEFAULT_SERVICES,
  normalizeItemName,
  normalizeServiceName,
  getServicesAndCatalogData,
  calculateOrderQuote,
  createOrderRecord,
  lookupTrackedOrder
};
