const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/auth');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads/products');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'product-' + uniqueSuffix + ext);
    }
});

// File filter - only images
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('סוג קובץ לא נתמך. יש להעלות תמונה בלבד.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// Upload product image
router.post('/product-image', authMiddleware, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: true, message: 'לא נבחר קובץ' });
        }
        
        const imageUrl = `/uploads/products/${req.file.filename}`;
        res.json({ success: true, imageUrl, filename: req.file.filename });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בהעלאת הקובץ' });
    }
});

// Delete product image
router.delete('/product-image/:filename', authMiddleware, (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(uploadsDir, filename);
        
        // Security check - ensure filename doesn't contain path traversal
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ error: true, message: 'שם קובץ לא תקין' });
        }
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            res.json({ success: true, message: 'התמונה נמחקה' });
        } else {
            res.json({ success: true, message: 'הקובץ לא נמצא' });
        }
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: true, message: 'שגיאה במחיקת הקובץ' });
    }
});

module.exports = router;
