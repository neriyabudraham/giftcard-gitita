const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, email, name, role, is_active, password_created, created_at, last_login 
             FROM users ORDER BY created_at DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בטעינת משתמשים' });
    }
});

// Add new user (admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { email, name, role = 'user' } = req.body;

        if (!email) {
            return res.status(400).json({ error: true, message: 'אימייל נדרש' });
        }

        // Check if user exists
        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: true, message: 'משתמש עם אימייל זה כבר קיים' });
        }

        const result = await db.query(
            `INSERT INTO users (email, name, role, is_active, password_created, created_by) 
             VALUES ($1, $2, $3, true, false, $4) 
             RETURNING id, email, name, role, is_active, created_at`,
            [email.toLowerCase(), name, role, req.user.id]
        );

        res.json({ success: true, user: result.rows[0] });

    } catch (error) {
        console.error('Add user error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בהוספת משתמש' });
    }
});

// Update user (admin only)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, role, is_active } = req.body;

        // Prevent admin from deactivating themselves
        if (parseInt(id) === req.user.id && is_active === false) {
            return res.status(400).json({ error: true, message: 'לא ניתן לבטל את עצמך' });
        }

        const result = await db.query(
            `UPDATE users SET name = COALESCE($1, name), role = COALESCE($2, role), 
             is_active = COALESCE($3, is_active), updated_at = NOW() 
             WHERE id = $4 
             RETURNING id, email, name, role, is_active`,
            [name, role, is_active, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'משתמש לא נמצא' });
        }

        res.json({ success: true, user: result.rows[0] });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בעדכון משתמש' });
    }
});

// Delete user (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent admin from deleting themselves
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: true, message: 'לא ניתן למחוק את עצמך' });
        }

        await db.query('DELETE FROM users WHERE id = $1', [id]);

        res.json({ success: true });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: true, message: 'שגיאה במחיקת משתמש' });
    }
});

// Force password reset (admin only)
router.post('/:id/force-reset', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            'UPDATE users SET password_reset_required = true, updated_at = NOW() WHERE id = $1',
            [id]
        );

        res.json({ success: true, message: 'המשתמש יידרש לאפס סיסמה בהתחברות הבאה' });

    } catch (error) {
        console.error('Force reset error:', error);
        res.status(500).json({ error: true, message: 'שגיאה באיפוס סיסמה' });
    }
});

module.exports = router;
