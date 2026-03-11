const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');
const emailService = require('../services/email.service');
const { generateCustomerToken, customerAuthMiddleware } = require('../middleware/customerAuth');

const GOOGLE_CUSTOMER_REDIRECT_URI = process.env.GOOGLE_CUSTOMER_REDIRECT_URI ||
    'https://giftcard-gitita.botomat.co.il/api/customer/auth/google/callback';

// POST /customer/register
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password } = req.body;
        if (!email || !password || !firstName) {
            return res.status(400).json({ error: true, message: 'שם פרטי, מייל וסיסמה הם שדות חובה' });
        }

        const existing = await db.query('SELECT id FROM customers WHERE email = $1', [email.trim().toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: true, message: 'כתובת המייל כבר רשומה במערכת' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verifyToken = crypto.randomBytes(32).toString('hex');
        const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const result = await db.query(
            `INSERT INTO customers (first_name, last_name, email, phone, password_hash, is_first_login, is_verified, verify_token, verify_token_expires)
             VALUES ($1, $2, $3, $4, $5, FALSE, FALSE, $6, $7)
             RETURNING id, first_name, last_name, email, phone, is_first_login, is_verified`,
            [firstName, lastName || '', email.trim().toLowerCase(), phone || '', hashedPassword, verifyToken, verifyExpires]
        );

        const customer = result.rows[0];

        try {
            await emailService.sendCustomerVerificationEmail(customer.email, `${firstName} ${lastName || ''}`.trim(), verifyToken);
        } catch (emailError) {
            console.error('Error sending verification email:', emailError);
        }

        res.json({ success: true, message: 'נרשמת בהצלחה! נשלח מייל אימות לכתובת שהזנת.' });
    } catch (error) {
        console.error('Customer register error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בהרשמה' });
    }
});

// GET /customer/verify/:token
router.get('/verify/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const result = await db.query(
            `UPDATE customers SET is_verified = TRUE, verify_token = NULL, verify_token_expires = NULL
             WHERE verify_token = $1 AND verify_token_expires > NOW()
             RETURNING id, first_name, email`,
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: true, message: 'קישור לא תקין או שפג תוקפו' });
        }

        res.json({ success: true, message: 'המייל אומת בהצלחה! ניתן להתחבר.' });
    } catch (error) {
        console.error('Customer verify error:', error);
        res.status(500).json({ error: true, message: 'שגיאה באימות' });
    }
});

// POST /customer/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: true, message: 'מייל וסיסמה הם שדות חובה' });
        }

        const result = await db.query(
            'SELECT * FROM customers WHERE email = $1',
            [email.trim().toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: true, message: 'מייל או סיסמה שגויים' });
        }

        const customer = result.rows[0];

        if (!customer.is_verified) {
            return res.status(401).json({ error: true, message: 'יש לאמת את כתובת המייל תחילה. בדקו את תיבת הדואר.' });
        }

        if (!customer.password_hash) {
            return res.status(401).json({ error: true, message: 'חשבון זה משתמש בכניסה עם גוגל. אנא התחבר עם כפתור Google.' });
        }

        const validPassword = await bcrypt.compare(password, customer.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: true, message: 'מייל או סיסמה שגויים' });
        }

        const token = generateCustomerToken(customer);

        res.json({
            success: true,
            token,
            customer: {
                id: customer.id,
                firstName: customer.first_name,
                lastName: customer.last_name,
                email: customer.email,
                phone: customer.phone,
                isFirstLogin: customer.is_first_login
            }
        });
    } catch (error) {
        console.error('Customer login error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בהתחברות' });
    }
});

// POST /customer/forgot-password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: true, message: 'מייל הוא שדה חובה' });
        }

        const result = await db.query('SELECT * FROM customers WHERE email = $1', [email.trim().toLowerCase()]);
        if (result.rows.length === 0) {
            // Don't reveal if email exists
            return res.json({ success: true, message: 'אם המייל קיים במערכת, ישלח קישור לאיפוס סיסמה.' });
        }

        const customer = result.rows[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await db.query(
            'UPDATE customers SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
            [resetToken, resetExpires, customer.id]
        );

        try {
            await emailService.sendCustomerPasswordResetEmail(customer.email, `${customer.first_name} ${customer.last_name || ''}`.trim(), resetToken);
        } catch (emailError) {
            console.error('Error sending reset email:', emailError);
        }

        res.json({ success: true, message: 'אם המייל קיים במערכת, ישלח קישור לאיפוס סיסמה.' });
    } catch (error) {
        console.error('Customer forgot-password error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בשליחת קישור לאיפוס' });
    }
});

// POST /customer/reset-password
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ error: true, message: 'חסרים פרטים לאיפוס סיסמה' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: true, message: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
        }

        const result = await db.query(
            'SELECT * FROM customers WHERE reset_token = $1 AND reset_token_expires > NOW()',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: true, message: 'קישור לא תקין או שפג תוקפו' });
        }

        const customer = result.rows[0];
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            `UPDATE customers SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL,
             is_first_login = FALSE, temp_password = NULL WHERE id = $2`,
            [hashedPassword, customer.id]
        );

        const newToken = generateCustomerToken(customer);
        res.json({
            success: true,
            message: 'הסיסמה אופסה בהצלחה!',
            token: newToken,
            customer: {
                id: customer.id,
                firstName: customer.first_name,
                lastName: customer.last_name,
                email: customer.email,
                phone: customer.phone,
                isFirstLogin: false
            }
        });
    } catch (error) {
        console.error('Customer reset-password error:', error);
        res.status(500).json({ error: true, message: 'שגיאה באיפוס סיסמה' });
    }
});

// PUT /customer/change-password (auth required)
router.put('/change-password', customerAuthMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: true, message: 'הסיסמה החדשה חייבת להכיל לפחות 6 תווים' });
        }

        const customerResult = await db.query('SELECT password_hash, is_first_login FROM customers WHERE id = $1', [req.customer.id]);
        const customer = customerResult.rows[0];

        // On first login, skip current password check
        if (!customer.is_first_login) {
            if (!currentPassword) {
                return res.status(400).json({ error: true, message: 'יש להזין את הסיסמה הנוכחית' });
            }
            const validPassword = await bcrypt.compare(currentPassword, customer.password_hash);
            if (!validPassword) {
                return res.status(401).json({ error: true, message: 'הסיסמה הנוכחית שגויה' });
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query(
            'UPDATE customers SET password_hash = $1, is_first_login = FALSE, temp_password = NULL WHERE id = $2',
            [hashedPassword, req.customer.id]
        );

        res.json({ success: true, message: 'הסיסמה עודכנה בהצלחה!' });
    } catch (error) {
        console.error('Customer change-password error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בעדכון סיסמה' });
    }
});

// GET /customer/me (auth required)
router.get('/me', customerAuthMiddleware, async (req, res) => {
    res.json({
        success: true,
        customer: {
            id: req.customer.id,
            firstName: req.customer.first_name,
            lastName: req.customer.last_name,
            email: req.customer.email,
            phone: req.customer.phone,
            isFirstLogin: req.customer.is_first_login
        }
    });
});

// GET /customer/vouchers (auth required)
router.get('/vouchers', customerAuthMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT v.*, p.recipient_first_name, p.recipient_last_name, p.recipient_email, p.greeting as purchase_greeting
             FROM vouchers v
             LEFT JOIN purchases p ON p.voucher_number = v.voucher_number AND p.status = 'completed'
             WHERE v.buyer_email = $1 OR v.email = $1
             ORDER BY v.created_at DESC`,
            [req.customer.email]
        );
        res.json({ success: true, vouchers: result.rows });
    } catch (error) {
        console.error('Customer vouchers error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בטעינת שוברים' });
    }
});

// GET /customer/purchases (auth required)
router.get('/purchases', customerAuthMiddleware, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM purchases
             WHERE buyer_email = $1
             ORDER BY created_at DESC`,
            [req.customer.email]
        );
        res.json({ success: true, purchases: result.rows });
    } catch (error) {
        console.error('Customer purchases error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בטעינת רכישות' });
    }
});

// PUT /customer/vouchers/:voucherNumber/greeting (auth required)
router.put('/vouchers/:voucherNumber/greeting', customerAuthMiddleware, async (req, res) => {
    try {
        const { voucherNumber } = req.params;
        const { greeting } = req.body;

        // Verify ownership
        const voucherResult = await db.query(
            'SELECT * FROM vouchers WHERE voucher_number = $1 AND (buyer_email = $2 OR email = $2)',
            [voucherNumber, req.customer.email]
        );

        if (voucherResult.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'שובר לא נמצא' });
        }

        await db.query(
            'UPDATE vouchers SET greeting = $1 WHERE voucher_number = $2',
            [greeting, voucherNumber]
        );

        // Also update the purchase greeting
        await db.query(
            "UPDATE purchases SET greeting = $1 WHERE voucher_number = $2 AND buyer_email = $3",
            [greeting, voucherNumber, req.customer.email]
        );

        // Delete cached image to force regeneration
        const path = require('path');
        const fs = require('fs').promises;
        const imagePath = path.join(__dirname, '../../vouchers', `${voucherNumber}.png`);
        try { await fs.unlink(imagePath); } catch {}

        res.json({ success: true, message: 'הברכה עודכנה בהצלחה' });
    } catch (error) {
        console.error('Customer update greeting error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בעדכון ברכה' });
    }
});

// GET /customer/auth/google — redirect to Google OAuth
router.get('/auth/google', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(500).send('Google login not configured');
    const scope = encodeURIComponent('email profile');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(GOOGLE_CUSTOMER_REDIRECT_URI)}&response_type=code&scope=${scope}&access_type=offline&prompt=select_account`;
    res.redirect(authUrl);
});

// GET /customer/auth/google/callback — handle Google OAuth callback
router.get('/auth/google/callback', async (req, res) => {
    const { code, error } = req.query;
    if (error) return res.redirect('/portal?auth_error=oauth_error');

    try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_CUSTOMER_REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });
        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) return res.redirect('/portal?auth_error=oauth_error');

        // Get Google user info
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const googleUser = await userInfoRes.json();
        if (!googleUser.email) return res.redirect('/portal?auth_error=oauth_error');

        const normalizedEmail = googleUser.email.toLowerCase();

        // Find or create customer
        const existing = await db.query(
            'SELECT * FROM customers WHERE google_id = $1 OR email = $2 LIMIT 1',
            [googleUser.id, normalizedEmail]
        );

        let customer;
        if (existing.rows.length > 0) {
            customer = existing.rows[0];
            if (!customer.google_id) {
                await db.query(
                    'UPDATE customers SET google_id = $1, is_verified = TRUE WHERE id = $2',
                    [googleUser.id, customer.id]
                );
                customer.google_id = googleUser.id;
            }
        } else {
            const result = await db.query(
                `INSERT INTO customers (first_name, last_name, email, google_id, is_first_login, is_verified)
                 VALUES ($1, $2, $3, $4, FALSE, TRUE) RETURNING *`,
                [googleUser.given_name || '', googleUser.family_name || '', normalizedEmail, googleUser.id]
            );
            customer = result.rows[0];
        }

        // If profile incomplete (missing phone), issue temp token for completion
        if (!customer.phone || !customer.first_name || !customer.last_name) {
            const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
            const tempToken = jwt.sign(
                { id: customer.id, type: 'complete_profile', firstName: customer.first_name, lastName: customer.last_name },
                secret,
                { expiresIn: '1h' }
            );
            return res.redirect(`/portal?needsProfile=${tempToken}`);
        }

        const token = generateCustomerToken(customer);
        return res.redirect(`/portal?authToken=${token}`);

    } catch (err) {
        console.error('Customer Google callback error:', err);
        res.redirect('/portal?auth_error=oauth_error');
    }
});

// POST /customer/complete-profile — complete profile after Google login
router.post('/complete-profile', async (req, res) => {
    const { tempToken, phone, firstName, lastName } = req.body;
    if (!tempToken || !phone) {
        return res.status(400).json({ error: true, message: 'יש להזין מספר טלפון' });
    }
    try {
        const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
        const decoded = jwt.verify(tempToken, secret);
        if (decoded.type !== 'complete_profile') {
            return res.status(401).json({ error: true, message: 'טוקן לא תקין' });
        }

        const setParts = ['phone = $1'];
        const values = [phone.trim()];
        let idx = 2;
        if (firstName) { setParts.push(`first_name = $${idx++}`); values.push(firstName.trim()); }
        if (lastName) { setParts.push(`last_name = $${idx++}`); values.push(lastName.trim()); }
        values.push(decoded.id);

        const result = await db.query(
            `UPDATE customers SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );
        const customer = result.rows[0];
        const token = generateCustomerToken(customer);
        res.json({
            success: true,
            token,
            customer: {
                id: customer.id,
                firstName: customer.first_name,
                lastName: customer.last_name,
                email: customer.email,
                phone: customer.phone,
                isFirstLogin: false
            }
        });
    } catch (err) {
        console.error('Complete profile error:', err);
        res.status(401).json({ error: true, message: 'הקישור פג תוקף, אנא התחבר שוב' });
    }
});

module.exports = router;
