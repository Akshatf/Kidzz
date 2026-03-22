const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/', productController.getProducts);
router.get('/brand/:brand', productController.getProductsByBrand);
router.post('/', productController.createProduct);

module.exports = router;