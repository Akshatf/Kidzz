const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');

router.get('/', supplierController.listSuppliers);
router.post('/', supplierController.createSupplier);

module.exports = router;
