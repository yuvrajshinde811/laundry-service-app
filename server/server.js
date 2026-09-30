require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { connectDB } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows CDN scripts/styles (Bootstrap, FontAwesome, Google Fonts)
    crossOriginEmbedderPolicy: false
  })
);

app.use(cors());

// 2. Request Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// 3. Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Rate Limiting for Public APIs
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});
app.use('/api/', apiLimiter);

// 5. Serve Static Frontend Files
app.use(express.static(path.join(__dirname, '../client')));

// 6. API Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'Laundry Booking & Delivery API',
    time: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// 7. Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/admin', adminRoutes);

// 8. HTML Page Routes (Friendly Clean URLs)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get('/booking', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/booking.html'));
});

app.get('/tracking', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/tracking.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin/dashboard.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/admin/login.html'));
});

// 9. 404 & Global Error Handling
app.use('/api/*', notFoundHandler);

// SPA / Client-side fallback for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.use(errorHandler);

// 10. Start Server
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`
======================================================
🧺 LAUNDRY SERVICE & DELIVERY APPLICATION RUNNING!
🌐 Website: http://localhost:${PORT}
📋 Book Laundry: http://localhost:${PORT}/booking.html
📦 Track Order: http://localhost:${PORT}/tracking.html
🔒 Admin Portal: http://localhost:${PORT}/admin/login.html
💬 Admin WhatsApp Alert Number: ${process.env.ADMIN_WHATSAPP_NUMBER || '8080082714'}
======================================================
      `);
    });
  } catch (error) {
    console.error('Fatal Server Boot Error:', error);
    process.exit(1);
  }
};

// Start when executed directly
if (require.main === module) {
  startServer();
}

module.exports = app;
