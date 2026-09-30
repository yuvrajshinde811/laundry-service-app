const express = require('express');
const router = express.Router();
const { getServicesCatalog } = require('../controllers/orderController');

// GET /api/services - Public services & pricing catalog
router.get('/', getServicesCatalog);

module.exports = router;
