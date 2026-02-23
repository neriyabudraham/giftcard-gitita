const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

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
        
        const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'מוצר לא נמצא' });
        }
        
        res.json({ success: true, message: 'מוצר נמחק בהצלחה' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: true, message: 'שגיאה במחיקת מוצר' });
    }
});

module.exports = router;
