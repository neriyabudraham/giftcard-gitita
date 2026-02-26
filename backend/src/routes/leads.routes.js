const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// Get all leads and customers
router.get('/', authMiddleware, async (req, res) => {
    try {
        // Get all unique buyers from purchases (grouped by email/phone)
        const purchasesResult = await db.query(`
            SELECT 
                COALESCE(buyer_email, '') as email,
                COALESCE(buyer_phone, '') as phone,
                CONCAT(buyer_first_name, ' ', buyer_last_name) as name,
                MIN(created_at) as created_at,
                ARRAY_AGG(
                    json_build_object(
                        'voucher_number', voucher_number,
                        'amount', amount,
                        'status', status,
                        'recipient_name', CONCAT(recipient_first_name, ' ', recipient_last_name),
                        'created_at', created_at
                    ) ORDER BY created_at DESC
                ) as vouchers,
                COUNT(*) as purchase_count,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_spent
            FROM purchases
            WHERE buyer_email IS NOT NULL OR buyer_phone IS NOT NULL
            GROUP BY buyer_email, buyer_phone, buyer_first_name, buyer_last_name
            ORDER BY MAX(created_at) DESC
        `);

        // Process leads
        const leads = purchasesResult.rows.map(row => ({
            email: row.email,
            phone: row.phone,
            name: row.name?.trim() || null,
            created_at: row.created_at,
            vouchers: row.vouchers,
            purchase_count: parseInt(row.purchase_count),
            completed_count: parseInt(row.completed_count),
            total_spent: parseFloat(row.total_spent) || 0,
            type: parseInt(row.completed_count) > 0 ? 'customer' : 'lead'
        }));

        // Calculate stats
        const stats = {
            totalPurchases: leads.reduce((sum, l) => sum + l.completed_count, 0),
            totalRevenue: leads.reduce((sum, l) => sum + l.total_spent, 0)
        };

        res.json({ leads, stats });

    } catch (error) {
        console.error('Get leads error:', error);
        res.status(500).json({ error: true, message: 'שגיאה בטעינת לידים' });
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
