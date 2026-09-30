const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const { memoryStore, isUsingMemoryStore } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'laundry_secret_jwt_key_development_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Admin Login
 * POST /api/auth/login
 */
const loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();

    const defaultEmail = (process.env.ADMIN_DEFAULT_EMAIL || 'admin@laundry.com').toLowerCase();
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123456';

    // 1. Try DB look up if connected
    if (!isUsingMemoryStore()) {
      try {
        const admin = await Admin.findOne({ email: cleanEmail });
        if (admin) {
          const isMatch = await admin.comparePassword(password);
          if (isMatch) {
            admin.lastLogin = new Date();
            await admin.save().catch(() => {});

            const token = jwt.sign(
              { id: admin._id, email: admin.email, name: admin.name, role: admin.role },
              JWT_SECRET,
              { expiresIn: JWT_EXPIRES_IN }
            );

            return res.status(200).json({
              success: true,
              message: 'Login successful',
              token,
              admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role }
            });
          } else {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
          }
        }
      } catch (err) {
        console.warn('DB lookup error, checking memory/default credentials:', err.message);
      }
    }

    // 2. Check memory store or fallback default credentials
    const memAdmin = memoryStore.admins.find((a) => a.email === cleanEmail);
    if (memAdmin) {
      const isMatch = await bcrypt.compare(password, memAdmin.passwordHash);
      if (isMatch) {
        const token = jwt.sign(
          { id: memAdmin._id, email: memAdmin.email, name: memAdmin.name, role: memAdmin.role },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );
        return res.status(200).json({
          success: true,
          message: 'Login successful',
          token,
          admin: { id: memAdmin._id, name: memAdmin.name, email: memAdmin.email, role: memAdmin.role }
        });
      }
    }

    // 3. Fallback to default admin account
    if (cleanEmail === defaultEmail && password === defaultPassword) {
      const token = jwt.sign(
        { id: 'admin-root-default', email: defaultEmail, name: 'Laundry Administrator', role: 'superadmin' },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      return res.status(200).json({
        success: true,
        message: 'Login successful (Default Admin)',
        token,
        admin: {
          id: 'admin-root-default',
          name: 'Laundry Administrator',
          email: defaultEmail,
          role: 'superadmin',
          phone: process.env.ADMIN_WHATSAPP_NUMBER || '8080082714'
        }
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid email or password.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated admin
 * GET /api/auth/me
 */
const getAdminProfile = async (req, res, next) => {
  try {
    if (!isUsingMemoryStore()) {
      try {
        const admin = await Admin.findById(req.admin.id).select('-passwordHash');
        if (admin) {
          return res.status(200).json({ success: true, admin });
        }
      } catch (err) {}
    }

    res.status(200).json({
      success: true,
      admin: req.admin
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  loginAdmin,
  getAdminProfile
};
