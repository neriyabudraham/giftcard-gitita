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
        // A customer is someone who has a voucher in the vouchers table (matched by voucher_number OR by buyer email/phone)
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
                -- Customer = has at least one voucher (by voucher_number OR by buyer email/phone in vouchers table)
                MAX(CASE 
                    WHEN EXISTS (SELECT 1 FROM vouchers v WHERE v.voucher_number = p.voucher_number) THEN 1
                    WHEN EXISTS (SELECT 1 FROM vouchers v WHERE 
                        (NULLIF(TRIM(v.buyer_email), '') IS NOT NULL AND TRIM(v.buyer_email) = TRIM(p.buyer_email))
                        OR (NULLIF(TRIM(v.buyer_phone), '') IS NOT NULL AND TRIM(v.buyer_phone) = TRIM(p.buyer_phone))
                    ) THEN 1
                    ELSE 0 
                END) as has_voucher,
                SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as total_spent
            FROM purchases p
            WHERE (p.buyer_email IS NOT NULL AND TRIM(p.buyer_email) != '') 
               OR (p.buyer_phone IS NOT NULL AND TRIM(p.buyer_phone) != '')
            GROUP BY COALESCE(NULLIF(TRIM(p.buyer_email), ''), NULLIF(TRIM(p.buyer_phone), ''), '')
            ORDER BY MAX(p.created_at) DESC
        `);

        // Also get vouchers directly by buyer email/phone (not just by voucher_number)
        const vouchersResult = await db.query(`
            SELECT 
                COALESCE(NULLIF(TRIM(buyer_email), ''), NULLIF(TRIM(buyer_phone), ''), '') as buyer_id,
                voucher_number,
                original_amount as amount,
                remaining_amount,
                customer_name as recipient_name,
                status,
                created_at
            FROM vouchers
            WHERE (buyer_email IS NOT NULL AND TRIM(buyer_email) != '') 
               OR (buyer_phone IS NOT NULL AND TRIM(buyer_phone) != '')
        `);

        // Create a map of buyer_id to their vouchers
        const buyerVouchersMap = {};
        for (const v of vouchersResult.rows) {
            if (!buyerVouchersMap[v.buyer_id]) {
                buyerVouchersMap[v.buyer_id] = [];
            }
            buyerVouchersMap[v.buyer_id].push({
                voucher_number: v.voucher_number,
                amount: v.amount,
                remaining_amount: v.remaining_amount,
                recipient_name: v.recipient_name,
                status: v.status,
                created_at: v.created_at,
                has_voucher: true
            });
        }

        // Process leads and merge vouchers from both sources
        const leads = purchasesResult.rows.map(row => {
            const purchaseVouchers = row.vouchers || [];
            const directVouchers = buyerVouchersMap[row.email] || buyerVouchersMap[row.phone] || [];
            
            // Merge vouchers, avoid duplicates by voucher_number
            const voucherMap = {};
            for (const v of purchaseVouchers) {
                voucherMap[v.voucher_number] = v;
            }
            for (const v of directVouchers) {
                if (!voucherMap[v.voucher_number]) {
                    voucherMap[v.voucher_number] = v;
                } else {
                    // Mark as has_voucher if found in vouchers table
                    voucherMap[v.voucher_number].has_voucher = true;
                }
            }
            
            const allVouchers = Object.values(voucherMap);
            const hasAnyVoucher = allVouchers.some(v => v.has_voucher) || directVouchers.length > 0;
            
            return {
                email: row.email,
                phone: row.phone,
                name: row.name?.trim() || null,
                created_at: row.created_at,
                vouchers: allVouchers,
                purchase_count: parseInt(row.purchase_count),
                has_voucher: hasAnyVoucher,
                total_spent: parseFloat(row.total_spent) || 0,
                // Customer = has at least one voucher, Lead = no vouchers
                type: hasAnyVoucher ? 'customer' : 'lead'
            };
        });

        // Track which buyer IDs are already in leads
        const existingBuyerIds = new Set(leads.map(l => l.email).concat(leads.map(l => l.phone)).filter(Boolean));

        // Add buyers from vouchers table who don't have purchase records
        const voucherOnlyBuyers = await db.query(`
            SELECT 
                COALESCE(NULLIF(TRIM(buyer_email), ''), NULLIF(TRIM(buyer_phone), ''), '') as email,
                MAX(COALESCE(NULLIF(TRIM(buyer_phone), ''), '')) as phone,
                MAX(buyer_name) as name,
                MIN(created_at) as created_at,
                ARRAY_AGG(
                    json_build_object(
                        'voucher_number', voucher_number,
                        'amount', original_amount,
                        'remaining_amount', remaining_amount,
                        'recipient_name', customer_name,
                        'status', status,
                        'created_at', created_at,
                        'has_voucher', true
                    ) ORDER BY created_at DESC
                ) as vouchers,
                SUM(original_amount) as total_spent
            FROM vouchers
            WHERE (buyer_email IS NOT NULL AND TRIM(buyer_email) != '') 
               OR (buyer_phone IS NOT NULL AND TRIM(buyer_phone) != '')
            GROUP BY COALESCE(NULLIF(TRIM(buyer_email), ''), NULLIF(TRIM(buyer_phone), ''), '')
        `);

        for (const row of voucherOnlyBuyers.rows) {
            // Skip if already in leads
            if (existingBuyerIds.has(row.email) || existingBuyerIds.has(row.phone)) {
                continue;
            }
            
            leads.push({
                email: row.email,
                phone: row.phone,
                name: row.name?.trim() || null,
                created_at: row.created_at,
                vouchers: row.vouchers,
                purchase_count: row.vouchers?.length || 0,
                has_voucher: true,
                total_spent: parseFloat(row.total_spent) || 0,
                type: 'customer'
            });
        }

        // Sort by created_at desc
        leads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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
