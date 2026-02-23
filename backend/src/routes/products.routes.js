const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('../middleware/auth');

// Helper to delete uploaded image
function deleteUploadedImage(imageUrl) {
    if (!imageUrl || !imageUrl.startsWith('/uploads/products/')) return;
    
    const filename = imageUrl.replace('/uploads/products/', '');
    if (filename.includes('..') || filename.includes('/')) return;
    
    const filePath = path.join(__dirname, '../../uploads/products', filename);
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            console.log('Deleted image:', filename);
        } catch (err) {
            console.error('Error deleting image:', err);
        }
    }
}

// Get all active products (public)
router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM products WHERE is_active = true ORDER BY display_order ASC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בטעינת מוצרים' });
    }
});

// Get all products including inactive (admin)
router.get('/all', authMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM products ORDER BY display_order ASC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get all products error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בטעינת מוצרים' });
    }
});

// Get single product
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM products WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'מוצר לא נמצא' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בטעינת מוצר' });
    }
});

// Create product (admin)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, price, description, image_url, payment_url, display_order, is_active, is_premium, icon } = req.body;
        
        const result = await db.query(
            `INSERT INTO products (name, price, description, image_url, payment_url, display_order, is_active, is_premium, icon)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [name, price, description || '', image_url || '', payment_url || '', display_order || 0, is_active !== false, is_premium || false, icon || '🎁']
        );
        
        res.json({ success: true, product: result.rows[0] });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: true, message: 'שגיאה ביצירת מוצר' });
    }
});

// Update product (admin)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, description, image_url, payment_url, display_order, is_active, is_premium, icon } = req.body;
        
        // Get current product to check if image changed
        const current = await db.query('SELECT image_url FROM products WHERE id = $1', [id]);
        if (current.rows.length > 0 && image_url !== undefined) {
            const oldImageUrl = current.rows[0].image_url;
            // Delete old image if it's a local upload and different from new one
            if (oldImageUrl && oldImageUrl !== image_url && oldImageUrl.startsWith('/uploads/')) {
                deleteUploadedImage(oldImageUrl);
            }
        }
        
        const result = await db.query(
            `UPDATE products SET 
                name = COALESCE($1, name),
                price = COALESCE($2, price),
                description = COALESCE($3, description),
                image_url = COALESCE($4, image_url),
                payment_url = COALESCE($5, payment_url),
                display_order = COALESCE($6, display_order),
                is_active = COALESCE($7, is_active),
                is_premium = COALESCE($8, is_premium),
                icon = COALESCE($9, icon),
                updated_at = NOW()
             WHERE id = $10
             RETURNING *`,
            [name, price, description, image_url, payment_url, display_order, is_active, is_premium, icon, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'מוצר לא נמצא' });
        }
        
        res.json({ success: true, product: result.rows[0] });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בעדכון מוצר' });
    }
});

// Delete product (admin)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get product to delete its image
        const product = await db.query('SELECT image_url FROM products WHERE id = $1', [id]);
        
        const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'מוצר לא נמצא' });
        }
        
        // Delete the image file if it's a local upload
        if (product.rows.length > 0 && product.rows[0].image_url) {
            deleteUploadedImage(product.rows[0].image_url);
        }
        
        res.json({ success: true, message: 'מוצר נמחק בהצלחה' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: true, message: 'שגיאה במחיקת מוצר' });
    }
});

module.exports = router;
