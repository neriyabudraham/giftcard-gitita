const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Get all leads and customers
router.get('/', authMiddleware, async (req, res) => {
    try {
        // First, clean up old pending purchases (older than 24 hours)
        await db.query(`
            DELETE FROM purchases 
            WHERE status = 'pending' 
            AND created_at < NOW() - INTERVAL '24 hours'
        `);

        // Get all unique buyers - group by email (primary identifier)
        // A customer is someone who has a voucher in the vouchers table
        const purchasesResult = await db.query(`
            SELECT 
                COALESCE(NULLIF(TRIM(p.buyer_email), ''), NULLIF(TRIM(p.buyer_phone), ''), '') as email,
                MAX(COALESCE(NULLIF(TRIM(p.buyer_phone), ''), '')) as phone,
                MAX(TRIM(CONCAT(COALESCE(TRIM(p.buyer_first_name), ''), ' ', COALESCE(TRIM(p.buyer_last_name), '')))) as name,
                MIN(p.created_at) as created_at,
                ARRAY_AGG(
                    json_build_object(
                        'voucher_number', p.voucher_number,
                        'amount', p.amount,
                        'status', p.status,
                        'recipient_name', TRIM(CONCAT(COALESCE(TRIM(p.recipient_first_name), ''), ' ', COALESCE(TRIM(p.recipient_last_name), ''))),
                        'created_at', p.created_at,
                        'has_voucher', (SELECT COUNT(*) > 0 FROM vouchers v WHERE v.voucher_number = p.voucher_number)
                    ) ORDER BY p.created_at DESC
                ) as vouchers,
                COUNT(*) as purchase_count,
                -- Customer = has at least one voucher in vouchers table
                MAX(CASE WHEN EXISTS (SELECT 1 FROM vouchers v WHERE v.voucher_number = p.voucher_number) THEN 1 ELSE 0 END) as has_voucher,
                SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as total_spent
            FROM purchases p
            WHERE (p.buyer_email IS NOT NULL AND TRIM(p.buyer_email) != '') 
               OR (p.buyer_phone IS NOT NULL AND TRIM(p.buyer_phone) != '')
            GROUP BY COALESCE(NULLIF(TRIM(p.buyer_email), ''), NULLIF(TRIM(p.buyer_phone), ''), '')
            ORDER BY MAX(p.created_at) DESC
        `);

        // Process leads
        const leads = purchasesResult.rows.map(row => ({
            email: row.email,
            phone: row.phone,
            name: row.name?.trim() || null,
            created_at: row.created_at,
            vouchers: row.vouchers,
            purchase_count: parseInt(row.purchase_count),
            has_voucher: parseInt(row.has_voucher) > 0,
            total_spent: parseFloat(row.total_spent) || 0,
            // Customer = has at least one voucher, Lead = no vouchers
            type: parseInt(row.has_voucher) > 0 ? 'customer' : 'lead'
        }));

        // Calculate stats
        const customers = leads.filter(l => l.type === 'customer');
        const stats = {
            totalPurchases: customers.length,
            totalRevenue: leads.reduce((sum, l) => sum + l.total_spent, 0)
        };

        res.json({ leads, stats });

    } catch (error) {
        console.error('Get leads error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בטעינת לידים' });
    }
});

// Import leads from CSV data
router.post('/import', authMiddleware, async (req, res) => {
    try {
        const { records } = req.body;
        
        if (!records || !Array.isArray(records)) {
            return res.status(400).json({ error: true, message: 'נדרש מערך של רשומות' });
        }

        let customersCount = 0;
        let leadsCount = 0;
        let skippedCount = 0;
        const errors = [];

        for (const record of records) {
            try {
                // Skip empty records
                if (!record.buyerEmail && !record.buyerPhone && !record.buyerFirstName) {
                    skippedCount++;
                    continue;
                }

                // Determine if customer or lead
                const isCustomer = record.voucher_download_link || record.whatsapp_sent === 'true' || record.whatsapp_sent === true;
                const status = isCustomer ? 'completed' : 'pending';

                // Check if voucher already exists
                if (record.voucherId) {
                    const existing = await db.query(
                        'SELECT id FROM purchases WHERE voucher_number = $1',
                        [record.voucherId]
                    );
                    if (existing.rows.length > 0) {
                        skippedCount++;
                        continue;
                    }
                }

                // Insert purchase
                const result = await db.query(`
                    INSERT INTO purchases 
                    (voucher_number, amount, buyer_first_name, buyer_last_name, buyer_phone, buyer_email,
                     recipient_first_name, recipient_last_name, recipient_phone, greeting, status, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT DO NOTHING
                    RETURNING id
                `, [
                    record.voucherId || Math.floor(1000000000000 + Math.random() * 9000000000000).toString(),
                    parseFloat(record.amount) || 0,
                    record.buyerFirstName || '',
                    record.buyerLastName || '',
                    record.buyerPhone || '',
                    record.buyerEmail || '',
                    record.recipientFirstName || '',
                    record.recipientLastName || '',
                    record.recipientPhone || '',
                    record.greeting || '',
                    status,
                    record.created_date ? new Date(record.created_date) : new Date()
                ]);

                if (result.rows.length > 0) {
                    if (isCustomer) {
                        customersCount++;
                    } else {
                        leadsCount++;
                    }
                }
            } catch (recordError) {
                errors.push({ voucherId: record.voucherId, error: recordError.message });
            }
        }

        res.json({
            success: true,
            summary: {
                customers: customersCount,
                leads: leadsCount,
                skipped: skippedCount,
                errors: errors.length
            },
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Import leads error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בייבוא לידים' });
    }
});

// Delete lead/customer by email (deletes all purchases for this email)
router.delete('/by-email/:email', authMiddleware, async (req, res) => {
    try {
        const { email } = req.params;
        
        const result = await db.query(
            'DELETE FROM purchases WHERE buyer_email = $1 OR buyer_phone = $1 RETURNING id',
            [email]
        );
        
        res.json({ 
            success: true, 
            deletedCount: result.rows.length,
            message: `נמחקו ${result.rows.length} רשומות`
        });
        
    } catch (error) {
        console.error('Delete lead error:', error);
        res.status(500).json({ error: true, message: 'שגיאה במחיקת ליד' });
    }
});

// Delete single purchase by voucher number
router.delete('/purchase/:voucherNumber', authMiddleware, async (req, res) => {
    try {
        const { voucherNumber } = req.params;
        
        const result = await db.query(
            'DELETE FROM purchases WHERE voucher_number = $1 RETURNING id',
            [voucherNumber]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'רכישה לא נמצאה' });
        }
        
        res.json({ success: true, message: 'הרכישה נמחקה בהצלחה' });
        
    } catch (error) {
        console.error('Delete purchase error:', error);
        res.status(500).json({ error: true, message: 'שגיאה במחיקת רכישה' });
    }
});

// Get single lead details
router.get('/:email', authMiddleware, async (req, res) => {
    try {
        const { email } = req.params;

        const result = await db.query(`
            SELECT 
                p.*,
                v.voucher_number as v_number,
                v.original_amount,
                v.remaining_amount,
                v.status as voucher_status,
                v.expiry_date
            FROM purchases p
            LEFT JOIN vouchers v ON p.voucher_id = v.id
            WHERE p.buyer_email = $1
            ORDER BY p.created_at DESC
        `, [email]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'ליד לא נמצא' });
        }

        const firstRow = result.rows[0];
        const lead = {
            email: firstRow.buyer_email,
            phone: firstRow.buyer_phone,
            name: `${firstRow.buyer_first_name} ${firstRow.buyer_last_name}`,
            purchases: result.rows
        };

        res.json({ lead });

    } catch (error) {
        console.error('Get lead error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בטעינת פרטי ליד' });
    }
});

module.exports = router;
