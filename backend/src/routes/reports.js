const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/stock', reportController.getStockReport);
router.get('/sales', reportController.getSalesReport);

module.exports = router;