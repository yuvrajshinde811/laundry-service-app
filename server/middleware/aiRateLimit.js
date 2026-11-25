const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

/**
 * Rate limiter for Customer AI endpoints to control API usage and prevent abuse
 */
const customerAILimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: process.env.NODE_ENV === 'test' ? 200 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    fallback: true,
    message: 'Too many AI requests. Please wait a few minutes or use our standard booking form.'
  }
});

/**
 * Rate limiter for Admin AI endpoints
 */
const adminAILimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: process.env.NODE_ENV === 'test' ? 200 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    fallback: true,
    message: 'Admin AI rate limit reached. Please wait a few minutes before sending more queries.'
  }
});

/**
 * Sanitize incoming chat text to strip unsafe control characters and cap length
 */
function sanitizeChatText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 1000);
}

/**
 * Validate AI chat request payload
 */
const validateChatRequest = [
  body('message')
    .customSanitizer(sanitizeChatText)
    .notEmpty()
    .withMessage('Please enter a message before sending.')
    .isLength({ max: 1000 })
    .withMessage('Message cannot exceed 1000 characters.'),
  body('sessionId')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .matches(/^[a-zA-Z0-9_-]{4,80}$/)
    .withMessage('Invalid session identifier format.'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0]?.message || 'Invalid chat request.'
      });
    }
    next();
  }
];

module.exports = {
  customerAILimiter,
  adminAILimiter,
  sanitizeChatText,
  validateChatRequest
};
