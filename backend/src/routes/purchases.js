const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { uploadPurchaseBill } = require('../middleware/uploadPurchaseBill');

router.get('/summary', purchaseController.getPurchaseSummary);
router.get('/due', purchaseController.getDuePayments);
router.get('/batch/:batch_id', purchaseController.getPurchaseBatch);

router.post('/attachment', (req, res, next) => {
    uploadPurchaseBill.single('file')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || 'Upload failed' });
        }
        next();
    });
}, purchaseController.uploadPurchaseAttachment);

router.get('/', purchaseController.getPurchases);
router.post('/batch', purchaseController.createPurchaseBatch);
router.put('/batch/:batch_id', purchaseController.updatePurchaseBatch);
router.put('/pay/:purchase_id', purchaseController.payDue);
router.put('/pay-batch/:batch_id', purchaseController.payBatch);

module.exports = router;
