const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Rate limiter for voucher search (anti-bot protection)
const searchAttempts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_UNIQUE_VOUCHERS = 5; // max 5 different voucher searches per minute per IP
const BLOCK_DURATION = 5 * 60 * 1000; // 5 minutes block after exceeding

function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const voucherNumber = req.query.number || '';
    const now = Date.now();
    
    let record = searchAttempts.get(ip);
    
    if (!record) {
        record = { voucherSearches: new Map(), blockedUntil: 0 };
        searchAttempts.set(ip, record);
    }
    
    // Check if blocked
    if (record.blockedUntil > now) {
        const waitSeconds = Math.ceil((record.blockedUntil - now) / 1000);
        return res.status(429).json({ 
            error: true, 
            message: `יותר מדי ניסיונות. נסה שוב בעוד ${waitSeconds} שניות`,
            retryAfter: waitSeconds
        });
    }
    
    // Clean old voucher searches
    for (const [voucher, timestamp] of record.voucherSearches.entries()) {
        if (now - timestamp > RATE_LIMIT_WINDOW) {
            record.voucherSearches.delete(voucher);
        }
    }
    
    // If same voucher was searched recently, allow it (polling)
    if (record.voucherSearches.has(voucherNumber)) {
        record.voucherSearches.set(voucherNumber, now); // Update timestamp
        return next();
    }
    
    // Check limit on unique voucher searches
    if (record.voucherSearches.size >= MAX_UNIQUE_VOUCHERS) {
        record.blockedUntil = now + BLOCK_DURATION;
        return res.status(429).json({ 
            error: true, 
            message: 'יותר מדי ניסיונות חיפוש. נסה שוב בעוד 5 דקות',
            retryAfter: BLOCK_DURATION / 1000
        });
    }
    
    // Record this voucher search
    record.voucherSearches.set(voucherNumber, now);
    next();
}

// Cleanup old records every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of searchAttempts.entries()) {
        if (record.voucherSearches.size === 0 && record.blockedUntil < now) {
            searchAttempts.delete(ip);
        }
    }
}, 10 * 60 * 1000);

// Search voucher (public - for customer check)
router.get('/search', rateLimitMiddleware, async (req, res) => {
    try {
        const { number } = req.query;

        if (!number) {
            return res.status(400).json({ error: true, message: 'נדרש מספר שובר' });
        }

        const result = await db.query(
            `SELECT voucher_number, original_amount, remaining_amount, customer_name, 
                    purchase_date, expiry_date, status, voucher_image_url, recipient_name
             FROM vouchers WHERE voucher_number = $1`,
            [number]
        );

        if (result.rows.length === 0) {
            return res.json({ found: false });
        }

        const voucher = result.rows[0];
        const isExpired = voucher.expiry_date && new Date(voucher.expiry_date) < new Date();
        const canBeUsed = voucher.status === 'active' && !isExpired && voucher.remaining_amount > 0;

        res.json({
            found: true,
            voucher: {
                ...voucher,
                is_expired: isExpired,
                can_be_used: canBeUsed
            }
        });

    } catch (error) {
        console.error('Search voucher error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בחיפוש שובר' });
    }
});

// API check endpoint (returns true/false as text)
router.get('/check', rateLimitMiddleware, async (req, res) => {
    try {
        const { card } = req.query;

        if (!card) {
            return res.send('false');
        }

        const result = await db.query(
            'SELECT status, remaining_amount, expiry_date FROM vouchers WHERE voucher_number = $1',
            [card]
        );

        if (result.rows.length === 0) {
            return res.send('false');
        }

        const voucher = result.rows[0];
        const isExpired = voucher.expiry_date && new Date(voucher.expiry_date) < new Date();
        const canBeUsed = voucher.status === 'active' && !isExpired && voucher.remaining_amount > 0;

        res.send(String(canBeUsed));

    } catch (error) {
        console.error('Check voucher error:', error);
        res.send('false');
    }
});

// Public voucher redemption (with staff PIN)
const STAFF_PIN = process.env.STAFF_PIN || '1234';

router.post('/public-redeem', rateLimitMiddleware, async (req, res) => {
    try {
        const { voucher_number, amount, notes, staff_pin } = req.body;

        // Verify staff PIN
        if (!staff_pin || staff_pin !== STAFF_PIN) {
            return res.status(403).json({ error: true, message: 'קוד צוות שגוי' });
        }

        if (!voucher_number || !amount) {
            return res.status(400).json({ error: true, message: 'נדרש מספר שובר וסכום' });
        }

        // Get voucher
        const voucherResult = await db.query(
            'SELECT * FROM vouchers WHERE voucher_number = $1',
            [voucher_number]
        );

        if (voucherResult.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'שובר לא נמצא' });
        }

        const voucher = voucherResult.rows[0];
        const isExpired = voucher.expiry_date && new Date(voucher.expiry_date) < new Date();

        if (voucher.status !== 'active') {
            return res.status(400).json({ error: true, message: 'השובר אינו פעיל' });
        }

        if (isExpired) {
            return res.status(400).json({ error: true, message: 'השובר פג תוקף' });
        }

        if (parseFloat(voucher.remaining_amount) < parseFloat(amount)) {
            return res.status(400).json({ error: true, message: 'הסכום גדול מהיתרה הקיימת' });
        }

        const newRemaining = parseFloat(voucher.remaining_amount) - parseFloat(amount);
        const newStatus = newRemaining <= 0 ? 'used' : 'active';

        // Update voucher
        await db.query(
            `UPDATE vouchers SET 
             remaining_amount = $1, 
             status = $2,
             updated_at = NOW()
             WHERE id = $3`,
            [newRemaining, newStatus, voucher.id]
        );

        // Record usage history
        await db.query(
            `INSERT INTO voucher_usage (voucher_id, amount_used, remaining_after, notes)
             VALUES ($1, $2, $3, $4)`,
            [voucher.id, amount, newRemaining, notes || 'מימוש ציבורי']
        );

        console.log(`Public voucher redemption: ${voucher_number}, amount: ${amount}, remaining: ${newRemaining}`);

        res.json({
            success: true,
            remaining_amount: newRemaining,
            status: newStatus
        });

    } catch (error) {
        console.error('Public redeem error:', error);
        res.status(500).json({ error: true, message: 'שגיאה במימוש שובר' });
    }
});

// Get all vouchers (admin)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { status, search, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM vouchers WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (status) {
            query += ` AND status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (search) {
            query += ` AND (voucher_number ILIKE $${paramIndex} OR customer_name ILIKE $${paramIndex} OR phone_number ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ' ORDER BY created_at DESC';
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await db.query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) FROM vouchers WHERE 1=1';
        const countParams = [];
        paramIndex = 1;

        if (status) {
            countQuery += ` AND status = $${paramIndex}`;
            countParams.push(status);
            paramIndex++;
        }

        if (search) {
            countQuery += ` AND (voucher_number ILIKE $${paramIndex} OR customer_name ILIKE $${paramIndex} OR phone_number ILIKE $${paramIndex})`;
            countParams.push(`%${search}%`);
        }

        const countResult = await db.query(countQuery, countParams);

        res.json({
            vouchers: result.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('Get vouchers error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בטעינת שוברים' });
    }
});

// Get single voucher (admin)
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query('SELECT * FROM vouchers WHERE id = $1', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'שובר לא נמצא' });
        }

        // Get usage history
        const usageResult = await db.query(
            `SELECT vu.*, u.name as used_by_name 
             FROM voucher_usage vu 
             LEFT JOIN users u ON vu.used_by = u.id 
             WHERE vu.voucher_id = $1 
             ORDER BY vu.created_at DESC`,
            [id]
        );

        res.json({
            voucher: result.rows[0],
            usage_history: usageResult.rows
        });

    } catch (error) {
        console.error('Get voucher error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בטעינת שובר' });
    }
});

// Create voucher (admin)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const {
            voucher_number,
            original_amount,
            customer_name,
            phone_number,
            email,
            expiry_date,
            voucher_image_url,
            greeting,
            buyer_name,
            buyer_phone,
            buyer_email,
            recipient_name,
            recipient_phone,
            product_name,
            send_email,
            send_to_admin,
            send_to_buyer,
            send_to_recipient
        } = req.body;

        // For product vouchers, we might have product_name but no amount
        if (!voucher_number) {
            return res.status(400).json({ error: true, message: 'מספר שובר נדרש' });
        }
        
        if (!original_amount && !product_name) {
            return res.status(400).json({ error: true, message: 'סכום או שם מוצר נדרשים' });
        }

        // Check if voucher number exists
        const existing = await db.query(
            'SELECT id FROM vouchers WHERE voucher_number = $1',
            [voucher_number]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: true, message: 'מספר שובר כבר קיים' });
        }

        const result = await db.query(
            `INSERT INTO vouchers 
             (voucher_number, original_amount, remaining_amount, customer_name, phone_number, email, 
              expiry_date, voucher_image_url, greeting, buyer_name, buyer_phone, buyer_email, 
              recipient_name, recipient_phone, product_name, status)
             VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active')
             RETURNING *`,
            [voucher_number, original_amount || 0, customer_name, phone_number, email,
             expiry_date, voucher_image_url, greeting, buyer_name, buyer_phone, buyer_email,
             recipient_name, recipient_phone, product_name]
        );

        const voucher = result.rows[0];
        const voucherService = require('../services/voucher.service');
        const emailService = require('../services/email.service');
        
        // Determine if we need to generate voucher image (if any email is being sent)
        const shouldSendToRecipient = (send_to_recipient || send_email) && email;
        const shouldSendToBuyer = send_to_buyer && buyer_email;
        const shouldSendToAdmin = send_to_admin !== false; // default true
        
        let imageBuffer = null;
        
        if (shouldSendToRecipient || shouldSendToBuyer || shouldSendToAdmin) {
            try {
                // Generate voucher image
                imageBuffer = await voucherService.generateVoucherImage({
                    voucherNumber: voucher_number,
                    amount: product_name || original_amount,
                    greeting: greeting || '',
                    recipientName: recipient_name || customer_name || '',
                    expiryDate: expiry_date ? new Date(expiry_date).toLocaleDateString('he-IL') : ''
                });
                
                // Save image
                await voucherService.saveVoucherImage(voucher_number, imageBuffer);
                
                // Update voucher with image URL
                await db.query(
                    'UPDATE vouchers SET voucher_image_url = $1 WHERE id = $2',
                    [`/api/voucher/${voucher_number}/image`, voucher.id]
                );
            } catch (imgError) {
                console.error('Error generating voucher image:', imgError);
            }
        }
        
        const displayAmount = product_name || `₪${original_amount}`;
        const displayRecipient = recipient_name || customer_name || '';
        
        // Send email to recipient
        if (shouldSendToRecipient) {
            try {
                await emailService.sendVoucherEmail({
                    to: email,
                    voucherNumber: voucher_number,
                    amount: displayAmount,
                    recipientName: displayRecipient,
                    buyerName: buyer_name || '',
                    greeting: greeting || '',
                    expiryDate: expiry_date,
                    imageBuffer
                });
                console.log('Voucher email sent to recipient:', email);
            } catch (emailError) {
                console.error('Error sending email to recipient:', emailError);
            }
        }
        
        // Send email to buyer (different from recipient)
        if (shouldSendToBuyer && buyer_email !== email) {
            try {
                await emailService.sendVoucherEmail({
                    to: buyer_email,
                    voucherNumber: voucher_number,
                    amount: displayAmount,
                    recipientName: displayRecipient,
                    buyerName: buyer_name || '',
                    greeting: greeting || '',
                    expiryDate: expiry_date,
                    imageBuffer,
                    isBuyerCopy: true
                });
                console.log('Voucher email sent to buyer:', buyer_email);
            } catch (emailError) {
                console.error('Error sending email to buyer:', emailError);
            }
        }

        // Send admin notification
        if (shouldSendToAdmin) {
            try {
                const adminEmailSetting = await db.query(
                    "SELECT setting_value FROM site_settings WHERE setting_key = 'admin_notification_email'"
                );
                if (adminEmailSetting.rows.length > 0) {
                    const adminEmail = JSON.parse(adminEmailSetting.rows[0].setting_value);
                    await emailService.sendAdminNotificationEmail({
                        adminEmail,
                        voucherNumber: voucher_number,
                        amount: displayAmount,
                        buyerName: buyer_name || customer_name || 'נוצר דרך ממשק הניהול',
                        buyerEmail: buyer_email || email,
                        buyerPhone: buyer_phone || phone_number,
                        recipientName: recipient_name
                    });
                }
            } catch (adminEmailError) {
                console.error('Error sending admin notification:', adminEmailError);
            }
        }

        res.json({ success: true, voucher });

    } catch (error) {
        console.error('Create voucher error:', error);
        res.status(500).json({ error: true, message: 'שגיאה ביצירת שובר' });
    }
});

// Update voucher (admin)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            customer_name,
            phone_number,
            email,
            expiry_date,
            status,
            remaining_amount
        } = req.body;

        const result = await db.query(
            `UPDATE vouchers SET 
             customer_name = COALESCE($1, customer_name),
             phone_number = COALESCE($2, phone_number),
             email = COALESCE($3, email),
             expiry_date = COALESCE($4, expiry_date),
             status = COALESCE($5, status),
             remaining_amount = COALESCE($6, remaining_amount),
             updated_at = NOW()
             WHERE id = $7
             RETURNING *`,
            [customer_name, phone_number, email, expiry_date, status, remaining_amount, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'שובר לא נמצא' });
        }

        res.json({ success: true, voucher: result.rows[0] });

    } catch (error) {
        console.error('Update voucher error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בעדכון שובר' });
    }
});

// Use voucher (deduct amount)
router.post('/:id/use', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, notes } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: true, message: 'סכום לא תקין' });
        }

        // Get current voucher
        const voucherResult = await db.query('SELECT * FROM vouchers WHERE id = $1', [id]);

        if (voucherResult.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'שובר לא נמצא' });
        }

        const voucher = voucherResult.rows[0];

        if (voucher.status !== 'active') {
            return res.status(400).json({ error: true, message: 'השובר אינו פעיל' });
        }

        if (voucher.expiry_date && new Date(voucher.expiry_date) < new Date()) {
            return res.status(400).json({ error: true, message: 'תוקף השובר פג' });
        }

        if (amount > voucher.remaining_amount) {
            return res.status(400).json({ error: true, message: 'הסכום גבוה מהיתרה' });
        }

        const newRemaining = Math.max(0, voucher.remaining_amount - amount);
        const newStatus = newRemaining <= 0 ? 'used' : 'active';

        // Update voucher
        await db.query(
            'UPDATE vouchers SET remaining_amount = $1, status = $2, updated_at = NOW() WHERE id = $3',
            [newRemaining, newStatus, id]
        );

        // Log usage
        await db.query(
            'INSERT INTO voucher_usage (voucher_id, amount_used, remaining_after, used_by, notes) VALUES ($1, $2, $3, $4, $5)',
            [id, amount, newRemaining, req.user.id, notes]
        );

        res.json({
            success: true,
            used_amount: amount,
            remaining_amount: newRemaining,
            status: newStatus
        });

    } catch (error) {
        console.error('Use voucher error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בשימוש בשובר' });
    }
});

// Delete voucher (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: true, message: 'רק מנהל יכול למחוק שוברים' });
        }

        await db.query('DELETE FROM vouchers WHERE id = $1', [id]);

        res.json({ success: true });

    } catch (error) {
        console.error('Delete voucher error:', error);
        res.status(500).json({ error: true, message: 'שגיאה במחיקת שובר' });
    }
});

module.exports = router;
