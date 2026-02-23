const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { generateToken, generateRefreshToken, authMiddleware } = require('../middleware/auth');
const emailService = require('../services/email.service');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

// Get current user
router.get('/me', authMiddleware, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name,
            role: req.user.role,
            password_created: req.user.password_created,
            password_reset_required: req.user.password_reset_required
        }
    });
});

// Login with email/password
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: true, message: 'נדרש אימייל וסיסמה' });
        }

        const result = await db.query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: true, message: 'אימייל או סיסמה שגויים' });
        }

        const user = result.rows[0];

        if (!user.password_hash) {
            return res.status(400).json({ 
                error: true, 
                message: 'נדרש ליצור סיסמה',
                needsPasswordCreation: true
            });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: true, message: 'אימייל או סיסמה שגויים' });
        }

        // Update last login
        await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);

        // Save refresh token
        await db.query(
            'INSERT INTO sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
            [user.id, refreshToken]
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                password_reset_required: user.password_reset_required
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בהתחברות' });
    }
});

// Create password (first time)
router.post('/create-password', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: true, message: 'נדרש אימייל וסיסמה' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: true, message: 'סיסמה חייבת להכיל לפחות 8 תווים' });
        }

        const result = await db.query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'משתמש לא נמצא' });
        }

        const user = result.rows[0];

        if (user.password_created) {
            return res.status(400).json({ 
                error: true, 
                message: 'סיסמה כבר נוצרה. יש לבצע איפוס סיסמה.',
                needsPasswordReset: true
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await db.query(
            'UPDATE users SET password_hash = $1, password_created = true, updated_at = NOW() WHERE id = $2',
            [passwordHash, user.id]
        );

        // Auto login after password creation
        const token = generateToken(user);

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });

        res.json({
            success: true,
            message: 'סיסמה נוצרה בהצלחה',
            token
        });

    } catch (error) {
        console.error('Create password error:', error);
        res.status(500).json({ error: true, message: 'שגיאה ביצירת סיסמה' });
    }
});

// Request password reset
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        const result = await db.query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            // Don't reveal if user exists
            return res.json({ success: true, message: 'אם האימייל קיים במערכת, נשלח קישור לאיפוס סיסמה' });
        }

        const user = result.rows[0];
        const token = crypto.randomBytes(32).toString('hex');

        // Save reset token
        await db.query(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'1 hour\')',
            [user.id, token]
        );

        // Send reset email
        await emailService.sendPasswordResetEmail(user.email, user.name, token);

        res.json({ success: true, message: 'קישור לאיפוס סיסמה נשלח למייל' });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בשליחת קישור איפוס' });
    }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: true, message: 'נדרש טוקן וסיסמה' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: true, message: 'סיסמה חייבת להכיל לפחות 8 תווים' });
        }

        const result = await db.query(
            `SELECT prt.*, u.id as user_id, u.email 
             FROM password_reset_tokens prt 
             JOIN users u ON prt.user_id = u.id 
             WHERE prt.token = $1 AND prt.expires_at > NOW() AND prt.used = false`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: true, message: 'קישור לא תקין או פג תוקף' });
        }

        const resetToken = result.rows[0];
        const passwordHash = await bcrypt.hash(password, 10);

        // Update password
        await db.query(
            'UPDATE users SET password_hash = $1, password_created = true, password_reset_required = false, updated_at = NOW() WHERE id = $2',
            [passwordHash, resetToken.user_id]
        );

        // Mark token as used
        await db.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [resetToken.id]);

        res.json({ success: true, message: 'סיסמה עודכנה בהצלחה' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: true, message: 'שגיאה באיפוס סיסמה' });
    }
});

// Google OAuth - initiate
router.get('/google', (req, res) => {
    const scope = encodeURIComponent('email profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&response_type=code&scope=${scope}&access_type=offline`;
    res.redirect(authUrl);
});

// Google OAuth - callback
router.get('/google/callback', async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.redirect('/admin/login.html?error=no_code');
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });

        const tokens = await tokenResponse.json();

        if (!tokens.access_token) {
            return res.redirect('/admin/login.html?error=token_error');
        }

        // Get user info
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });

        const googleUser = await userInfoResponse.json();

        // Check if user exists and is allowed
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [googleUser.email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.redirect('/admin/login.html?error=not_authorized');
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.redirect('/admin/login.html?error=inactive');
        }

        // Update user with Google ID and last login
        await db.query(
            'UPDATE users SET google_id = $1, name = COALESCE(name, $2), last_login = NOW() WHERE id = $3',
            [googleUser.id, googleUser.name, user.id]
        );

        const token = generateToken(user);

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });

        // Check if needs password creation
        if (!user.password_created) {
            return res.redirect('/admin/create-password.html');
        }

        res.redirect('/admin/');

    } catch (error) {
        console.error('Google OAuth error:', error);
        res.redirect('/admin/login.html?error=oauth_error');
    }
});

// Logout
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        // Clear sessions
        await db.query('DELETE FROM sessions WHERE user_id = $1', [req.user.id]);

        res.clearCookie('token');
        res.json({ success: true });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בהתנתקות' });
    }
});

module.exports = router;
