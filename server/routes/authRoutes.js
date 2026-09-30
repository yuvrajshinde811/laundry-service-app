const express = require('express');
const router = express.Router();
const { loginAdmin, getAdminProfile } = require('../controllers/authController');
const { validateAdminLogin } = require('../middleware/validationMiddleware');
const { verifyAdminToken } = require('../middleware/authMiddleware');

// POST /api/auth/login
router.post('/login', validateAdminLogin, loginAdmin);

// GET /api/auth/me
router.get('/me', verifyAdminToken, getAdminProfile);

module.exports = router;
