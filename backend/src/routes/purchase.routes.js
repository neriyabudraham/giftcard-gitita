const express = require('express');
const router = express.Router();
const db = require('../db');
const voucherService = require('../services/voucher.service');
const emailService = require('../services/email.service');

// Generate random voucher number (13 digits)
function generateVoucherNumber() {
    return Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
}

// Create new purchase (main endpoint)
router.post('/', async (req, res) => {
    try {
        const {
            voucherType,
            amount,
            paymentUrl: requestedPaymentUrl,
            buyerFirstName,
            buyerLastName,
            buyerPhone,
            buyerEmail,
            recipientFirstName,
            recipientLastName,
            recipientPhone,
            greeting
        } = req.body;

        // Generate unique voucher number
        let voucherNumber = generateVoucherNumber();
        
        // Check if voucher number already exists
        let exists = await db.query('SELECT 1 FROM purchases WHERE voucher_number = $1', [voucherNumber]);
        while (exists.rows.length > 0) {
            voucherNumber = generateVoucherNumber();
            exists = await db.query('SELECT 1 FROM purchases WHERE voucher_number = $1', [voucherNumber]);
        }

        // Check if this is a product voucher (non-numeric price like "קפה מאפה זוגי")
        const productName = voucherType && !voucherType.includes('₪') && isNaN(parseFloat(voucherType)) ? voucherType : null;

        // Save purchase
        const result = await db.query(
            `INSERT INTO purchases 
             (voucher_number, amount, product_name, buyer_first_name, buyer_last_name, buyer_phone, buyer_email,
              recipient_first_name, recipient_last_name, recipient_phone, greeting, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
             RETURNING id`,
            [voucherNumber, amount, productName, buyerFirstName, buyerLastName, buyerPhone, buyerEmail,
             recipientFirstName, recipientLastName, recipientPhone, greeting]
        );

        const purchaseId = result.rows[0].id;

        // Use provided payment URL or fallback to default links by amount
        let paymentUrl = requestedPaymentUrl;
        if (!paymentUrl) {
            const paymentLinks = {
                '95': 'https://meshulam.co.il/quick_payment?b=94d3052b31acdf125df594d1b61d9d06',
                '188': 'https://meshulam.co.il/quick_payment?b=94f3afb628451a34b6868895f1cef522',
                '100': 'https://meshulam.co.il/quick_payment?b=e5cbd287b0610688a5dc413649649a40',
                '300': 'https://meshulam.co.il/quick_payment?b=bb441e5bf72a76ecb2be8498f7c43149',
                '600': 'https://meshulam.co.il/quick_payment?b=7b3fdae2f87845522fd06fdd5a9c47e6'
            };
            paymentUrl = paymentLinks[amount] || paymentLinks['100'];
        }

        res.json({
            success: true,
            purchaseId,
            voucherNumber,
            paymentUrl
        });

    } catch (error) {
        console.error('Create purchase error:', error);
        res.status(500).json({ error: true, message: 'שגיאה ביצירת הזמנה' });
    }
});

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

// Payment webhook - receives email content from Grow/Meshulam
router.post('/webhook', async (req, res) => {
    try {
        // Log EVERYTHING for debugging
        console.log('');
        console.log('########## WEBHOOK START ##########');
        console.log('Body type:', typeof req.body);
        console.log('Is array:', Array.isArray(req.body));
        console.log('Keys:', Object.keys(req.body || {}));
        console.log('Full body:', JSON.stringify(req.body, null, 2));
        console.log('########## WEBHOOK END ##########');
        console.log('');

        let textContent = '';
        let payerPhone = '';
        let payerEmail = '';
        let payerName = '';
        let paymentAmount = '';
        let paymentReference = '';

        // Handle different formats
        if (Array.isArray(req.body) && req.body.length > 0) {
            // Array format from Make/n8n
            textContent = req.body[0].text || req.body[0].textHtml || req.body[0].html || '';
        } else if (req.body.text) {
            // Direct object with text field (from Make email parsing)
            textContent = req.body.text;
        } else {
            // Fallback to other formats
            textContent = req.body.html || req.body.textHtml || '';
            payerPhone = req.body.phone || '';
            payerEmail = req.body.email || '';
            payerName = req.body.name || '';
            paymentAmount = req.body.amount || '';
            paymentReference = req.body.reference || '';
        }

        // Parse text content from Grow email
        if (textContent) {
            console.log('Parsing text content, length:', textContent.length);
            
            // Extract phone - "טלפון: 0584254229"
            const phoneMatch = textContent.match(/טלפון:?\s*(0\d{8,9})/);
            if (phoneMatch) {
                payerPhone = phoneMatch[1].replace(/[-\s]/g, '');
                console.log('Found phone:', payerPhone);
            }
            
            // Extract email - "מייל: neriy.nisim@gmail.com"
            const emailMatch = textContent.match(/מייל:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (emailMatch) {
                payerEmail = emailMatch[1];
                console.log('Found email:', payerEmail);
            }
            
            // Extract amount - "תשלום של X ש"ח"
            const amountMatch = textContent.match(/תשלום\s+(?:של\s+)?(\d+)\s*ש"ח/);
            if (amountMatch) {
                paymentAmount = amountMatch[1];
                console.log('Found amount:', paymentAmount);
            }
            
            // Extract name - "שם:\nנריה אבודרהם" or "שם: נריה אבודרהם"
            const nameMatch = textContent.match(/שם:?\s*\n?([^\n]+?)(?:\s+טלפון|\s*$)/);
            if (nameMatch) {
                payerName = nameMatch[1].trim();
                console.log('Found name:', payerName);
            }
            
            // Extract reference - "אסמכתא: 467413334"
            const refMatch = textContent.match(/אסמכתא:?\s*(\d+)/);
            if (refMatch) {
                paymentReference = refMatch[1];
                console.log('Found reference:', paymentReference);
            }
        }

        console.log('Webhook parsed:', { payerPhone, payerEmail, paymentAmount, payerName, paymentReference });

        if (!payerPhone && !payerEmail) {
            return res.status(400).json({ error: true, message: 'חסר טלפון או מייל לזיהוי' });
        }

        // Check if this payment reference was already processed (prevent duplicate webhooks)
        if (paymentReference) {
            const existingPayment = await db.query(
                'SELECT id FROM purchases WHERE payment_id = $1',
                [paymentReference]
            );
            if (existingPayment.rows.length > 0) {
                console.log('Payment already processed:', paymentReference);
                return res.json({ success: true, message: 'תשלום כבר עובד', alreadyProcessed: true });
            }
        }

        // Find the oldest pending purchase matching phone/email and amount
        // Using FIFO (First In First Out) to handle multiple purchases
        const purchaseResult = await db.query(
            `SELECT * FROM purchases 
             WHERE status = 'pending' 
             AND amount = $1
             AND (buyer_phone LIKE $2 OR buyer_email = $3)
             ORDER BY created_at ASC 
             LIMIT 1`,
            [paymentAmount, `%${payerPhone ? payerPhone.slice(-9) : 'NOMATCH'}%`, payerEmail || 'NOMATCH']
        );

        if (purchaseResult.rows.length === 0) {
            console.log('No pending purchase found for:', { payerPhone, payerEmail, paymentAmount });
            return res.status(404).json({ error: true, message: 'רכישה ממתינה לא נמצאה' });
        }

        const purchase = purchaseResult.rows[0];
        console.log('Found purchase:', purchase.id, purchase.voucher_number);

        // Calculate expiry date (1 year from now)
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        // Create voucher
        const voucherResult = await db.query(
            `INSERT INTO vouchers 
             (voucher_number, original_amount, remaining_amount, customer_name, phone_number, email,
              expiry_date, greeting, buyer_name, buyer_phone, buyer_email, recipient_name, recipient_phone, product_name, status)
             VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active')
             RETURNING *`,
            [
                purchase.voucher_number,
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
                purchase.recipient_phone,
                purchase.product_name // Will be null for monetary vouchers
            ]
        );

        const voucher = voucherResult.rows[0];

        // Update purchase status
        await db.query(
            'UPDATE purchases SET status = $1, voucher_id = $2, payment_id = $3, completed_at = NOW() WHERE id = $4',
            ['completed', voucher.id, paymentReference, purchase.id]
        );

        // Generate voucher image
        // Use product_name if available (for product vouchers), otherwise use amount
        const voucherDisplayAmount = purchase.product_name || purchase.amount;
        
        try {
            await voucherService.generateVoucherImage({
                voucherId: purchase.voucher_number,
                amount: voucherDisplayAmount,
                greeting: purchase.greeting,
                recipientName: `${purchase.recipient_first_name} ${purchase.recipient_last_name}`,
                expiryDate: expiryDate.toLocaleDateString('he-IL')
            });

            await db.query(
                'UPDATE vouchers SET voucher_image_url = $1 WHERE id = $2',
                [`/api/voucher/${purchase.voucher_number}/image`, voucher.id]
            );
        } catch (imgError) {
            console.error('Error generating voucher image:', imgError);
        }

        // Send email to buyer
        try {
            await emailService.sendVoucherEmail({
                to: purchase.buyer_email,
                buyerName: `${purchase.buyer_first_name} ${purchase.buyer_last_name}`,
                voucherNumber: purchase.voucher_number,
                amount: voucherDisplayAmount, // Use product name if available
                voucherId: purchase.voucher_number,
                recipientName: `${purchase.recipient_first_name} ${purchase.recipient_last_name}`,
                greeting: purchase.greeting,
                expiryDate: expiryDate
            });
            console.log('Email sent to:', purchase.buyer_email);
        } catch (emailError) {
            console.error('Error sending email:', emailError);
        }

        res.json({ 
            success: true, 
            message: 'שובר נוצר בהצלחה',
            voucherNumber: purchase.voucher_number,
            purchaseId: purchase.id
        });

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
