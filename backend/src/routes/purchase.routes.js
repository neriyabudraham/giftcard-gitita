const express = require('express');
const router = express.Router();
const db = require('../db');
const voucherService = require('../services/voucher.service');
const emailService = require('../services/email.service');

// Save purchase data (before payment)
router.post('/save', async (req, res) => {
    try {
        const {
            voucherId,
            amount,
            buyerFirstName,
            buyerLastName,
            buyerPhone,
            buyerEmail,
            recipientFirstName,
            recipientLastName,
            recipientPhone,
            greeting
        } = req.body;

        // Save to purchases table
        const result = await db.query(
            `INSERT INTO purchases 
             (voucher_number, amount, buyer_first_name, buyer_last_name, buyer_phone, buyer_email,
              recipient_first_name, recipient_last_name, recipient_phone, greeting, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
             RETURNING id`,
            [voucherId, amount, buyerFirstName, buyerLastName, buyerPhone, buyerEmail,
             recipientFirstName, recipientLastName, recipientPhone, greeting]
        );

        res.json({
            success: true,
            purchaseId: result.rows[0].id,
            voucherId
        });

    } catch (error) {
        console.error('Save purchase error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בשמירת נתוני רכישה' });
    }
});

// Verify payment and create voucher
router.get('/verify/:voucherId', async (req, res) => {
    try {
        const { voucherId } = req.params;

        // Check if voucher already exists (payment completed)
        const existingVoucher = await db.query(
            'SELECT * FROM vouchers WHERE voucher_number = $1',
            [voucherId]
        );

        if (existingVoucher.rows.length > 0) {
            return res.json({
                verified: true,
                voucher: existingVoucher.rows[0]
            });
        }

        // Check purchase status
        const purchase = await db.query(
            'SELECT * FROM purchases WHERE voucher_number = $1 ORDER BY created_at DESC LIMIT 1',
            [voucherId]
        );

        if (purchase.rows.length === 0) {
            return res.json({ verified: false, message: 'רכישה לא נמצאה' });
        }

        if (purchase.rows[0].status === 'completed') {
            const voucher = await db.query(
                'SELECT * FROM vouchers WHERE voucher_number = $1',
                [voucherId]
            );
            return res.json({
                verified: true,
                voucher: voucher.rows[0]
            });
        }

        // Payment not yet verified
        res.json({ verified: false });

    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ error: true, message: 'שגיאה באימות תשלום' });
    }
});

// Payment webhook (called by payment provider)
router.post('/webhook', async (req, res) => {
    try {
        const { voucherId, paymentId, status } = req.body;

        if (status !== 'success' && status !== 'completed') {
            return res.json({ success: false, message: 'סטטוס תשלום לא תקין' });
        }

        // Get purchase data
        const purchaseResult = await db.query(
            'SELECT * FROM purchases WHERE voucher_number = $1 ORDER BY created_at DESC LIMIT 1',
            [voucherId]
        );

        if (purchaseResult.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'רכישה לא נמצאה' });
        }

        const purchase = purchaseResult.rows[0];

        if (purchase.status === 'completed') {
            return res.json({ success: true, message: 'תשלום כבר אומת' });
        }

        // Calculate expiry date (1 year from now)
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        // Create voucher
        const voucherResult = await db.query(
            `INSERT INTO vouchers 
             (voucher_number, original_amount, remaining_amount, customer_name, phone_number, email,
              expiry_date, greeting, buyer_name, buyer_phone, buyer_email, recipient_name, recipient_phone, status)
             VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')
             RETURNING *`,
            [
                voucherId,
                purchase.amount,
                `${purchase.recipient_first_name} ${purchase.recipient_last_name}`,
                purchase.recipient_phone,
                purchase.buyer_email,
                expiryDate.toISOString().split('T')[0],
                purchase.greeting,
                `${purchase.buyer_first_name} ${purchase.buyer_last_name}`,
                purchase.buyer_phone,
                purchase.buyer_email,
                `${purchase.recipient_first_name} ${purchase.recipient_last_name}`,
                purchase.recipient_phone
            ]
        );

        const voucher = voucherResult.rows[0];

        // Update purchase status
        await db.query(
            'UPDATE purchases SET status = $1, voucher_id = $2, payment_id = $3, completed_at = NOW() WHERE id = $4',
            ['completed', voucher.id, paymentId, purchase.id]
        );

        // Generate voucher image
        try {
            await voucherService.generateVoucherImage({
                voucherId,
                amount: purchase.amount,
                greeting: purchase.greeting,
                recipientName: `${purchase.recipient_first_name} ${purchase.recipient_last_name}`,
                expiryDate: expiryDate.toLocaleDateString('he-IL')
            });

            // Update voucher with image URL
            await db.query(
                'UPDATE vouchers SET voucher_image_url = $1 WHERE id = $2',
                [`/api/voucher/${voucherId}/image`, voucher.id]
            );
        } catch (imgError) {
            console.error('Error generating voucher image:', imgError);
        }

        // Send email
        try {
            await emailService.sendVoucherEmail({
                to: purchase.buyer_email,
                buyerName: `${purchase.buyer_first_name} ${purchase.buyer_last_name}`,
                voucherNumber: voucherId,
                amount: purchase.amount,
                voucherId
            });
        } catch (emailError) {
            console.error('Error sending email:', emailError);
        }

        res.json({ success: true, voucher });

    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בעיבוד תשלום' });
    }
});

// Manual payment completion (admin)
router.post('/complete/:voucherId', async (req, res) => {
    try {
        const { voucherId } = req.params;

        // Reuse webhook logic
        req.body = { voucherId, status: 'success' };
        
        // Get purchase
        const purchaseResult = await db.query(
            'SELECT * FROM purchases WHERE voucher_number = $1 ORDER BY created_at DESC LIMIT 1',
            [voucherId]
        );

        if (purchaseResult.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'רכישה לא נמצאה' });
        }

        const purchase = purchaseResult.rows[0];

        if (purchase.status === 'completed') {
            const voucher = await db.query(
                'SELECT * FROM vouchers WHERE voucher_number = $1',
                [voucherId]
            );
            return res.json({ success: true, voucher: voucher.rows[0] });
        }

        // Calculate expiry date
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        // Create voucher
        const voucherResult = await db.query(
            `INSERT INTO vouchers 
             (voucher_number, original_amount, remaining_amount, customer_name, phone_number, email,
              expiry_date, greeting, buyer_name, buyer_phone, buyer_email, recipient_name, recipient_phone, status)
             VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')
             RETURNING *`,
            [
                voucherId,
                purchase.amount,
                `${purchase.recipient_first_name} ${purchase.recipient_last_name}`,
                purchase.recipient_phone,
                purchase.buyer_email,
                expiryDate.toISOString().split('T')[0],
                purchase.greeting,
                `${purchase.buyer_first_name} ${purchase.buyer_last_name}`,
                purchase.buyer_phone,
                purchase.buyer_email,
                `${purchase.recipient_first_name} ${purchase.recipient_last_name}`,
                purchase.recipient_phone
            ]
        );

        const voucher = voucherResult.rows[0];

        // Update purchase
        await db.query(
            'UPDATE purchases SET status = $1, voucher_id = $2, completed_at = NOW() WHERE id = $3',
            ['completed', voucher.id, purchase.id]
        );

        // Generate image
        try {
            await voucherService.generateVoucherImage({
                voucherId,
                amount: purchase.amount,
                greeting: purchase.greeting,
                recipientName: `${purchase.recipient_first_name} ${purchase.recipient_last_name}`,
                expiryDate: expiryDate.toLocaleDateString('he-IL')
            });

            await db.query(
                'UPDATE vouchers SET voucher_image_url = $1 WHERE id = $2',
                [`/api/voucher/${voucherId}/image`, voucher.id]
            );
        } catch (imgError) {
            console.error('Error generating voucher image:', imgError);
        }

        // Send email
        try {
            await emailService.sendVoucherEmail({
                to: purchase.buyer_email,
                buyerName: `${purchase.buyer_first_name} ${purchase.buyer_last_name}`,
                voucherNumber: voucherId,
                amount: purchase.amount,
                voucherId
            });
        } catch (emailError) {
            console.error('Error sending email:', emailError);
        }

        res.json({ success: true, voucher });

    } catch (error) {
        console.error('Complete payment error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בהשלמת תשלום' });
    }
});

module.exports = router;
