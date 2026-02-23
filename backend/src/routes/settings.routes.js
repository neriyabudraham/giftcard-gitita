const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Get public settings (carousel images, FAQ, default greeting)
router.get('/public', async (req, res) => {
    try {
        const result = await db.query(
            "SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN ('carousel_images', 'faq_items', 'default_greeting')"
        );
        
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        
        res.json(settings);
    } catch (error) {
        console.error('Get public settings error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בטעינת הגדרות' });
    }
});

// Get all settings (admin)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM site_settings ORDER BY setting_key');
        
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        
        res.json(settings);
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בטעינת הגדרות' });
    }
});

// Update setting (admin)
router.put('/:key', authMiddleware, async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;
        
        const result = await db.query(
            `INSERT INTO site_settings (setting_key, setting_value, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (setting_key) DO UPDATE SET
                setting_value = $2,
                updated_at = NOW()
             RETURNING *`,
            [key, JSON.stringify(value)]
        );
        
        res.json({ success: true, setting: result.rows[0] });
    } catch (error) {
        console.error('Update setting error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בעדכון הגדרה' });
    }
});

module.exports = router;
