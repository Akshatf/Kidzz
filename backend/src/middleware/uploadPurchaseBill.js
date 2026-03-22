const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDir = path.join(__dirname, '../../uploads/purchase-bills');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '') || '';
        const base = path.basename(file.originalname || 'file', ext).replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${base}${ext}`);
    }
});

const uploadPurchaseBill = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = (path.extname(file.originalname || '') || '').toLowerCase();
        const okExt = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext);
        const mt = (file.mimetype || '').toLowerCase();
        const okMt = mt.startsWith('image/') || mt === 'application/pdf';
        if (okExt || okMt) {
            cb(null, true);
        } else {
            cb(new Error('Only images or PDF are allowed'));
        }
    }
});

module.exports = { uploadPurchaseBill };
