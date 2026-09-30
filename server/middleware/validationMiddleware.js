const { body, query, validationResult } = require('express-validator');

// Generic validation result checker
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg
    }));

    return res.status(400).json({
      success: false,
      message: errorMessages[0]?.message || 'Validation failed. Please check your inputs.',
      errors: errorMessages
    });
  }
  next();
};

// Validation rules for customer order creation
const validateOrderCreation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Customer full name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Mobile number is required')
    .matches(/^[0-9+ -]{10,15}$/)
    .withMessage('Please enter a valid 10-digit mobile number'),

  body('whatsappNumber')
    .trim()
    .notEmpty()
    .withMessage('WhatsApp number is required')
    .matches(/^[0-9+ -]{10,15}$/)
    .withMessage('Please enter a valid WhatsApp number'),

  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('address')
    .trim()
    .notEmpty()
    .withMessage('Complete pickup address is required'),

  body('area')
    .optional()
    .trim(),

  body('city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),

  body('pincode')
    .trim()
    .notEmpty()
    .withMessage('Pincode is required')
    .matches(/^[0-9]{6}$/)
    .withMessage('Please provide a valid 6-digit postal pincode'),

  body('items')
    .isArray({ min: 1 })
    .withMessage('Please select at least one laundry item to book'),

  body('items.*.item')
    .trim()
    .notEmpty()
    .withMessage('Item name is required'),

  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Item quantity must be at least 1'),

  body('pickupDate')
    .trim()
    .notEmpty()
    .withMessage('Please select a pickup date'),

  body('pickupTimeSlot')
    .trim()
    .notEmpty()
    .withMessage('Please select a pickup time slot'),

  body('deliveryPreference')
    .optional()
    .isIn(['Standard', 'Express'])
    .withMessage('Delivery preference must be Standard or Express'),

  handleValidationErrors
];

// Validation rules for customer order tracking
const validateOrderTracking = [
  body('orderId')
    .trim()
    .notEmpty()
    .withMessage('Order ID is required to track your order'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Registered mobile number is required'),

  handleValidationErrors
];

// Validation rules for admin login
const validateAdminLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors
];

// Validation rules for status update
const validateStatusUpdate = [
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Order status is required')
    .isIn([
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
    ])
    .withMessage('Invalid order status value'),

  handleValidationErrors
];

module.exports = {
  validateOrderCreation,
  validateOrderTracking,
  validateAdminLogin,
  validateStatusUpdate
};
