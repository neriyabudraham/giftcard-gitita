const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const db = require('../db');
const voucherService = require('../services/voucher.service');

const VOUCHERS_DIR = path.join(__dirname, '../../vouchers');

// Ensure vouchers directory exists
(async () => {
    try {
        await fs.mkdir(VOUCHERS_DIR, { recursive: true });
    } catch {}
})();

// Generate voucher image on demand
router.get('/:voucherNumber/generate', async (req, res, next) => {
    try {
        const { voucherNumber } = req.params;
        const forceRegenerate = req.query.force === 'true';
        
        // Get voucher data from database
        const result = await db.query(
            `SELECT v.*, p.greeting as purchase_greeting, p.recipient_first_name, p.recipient_last_name, p.product_name as purchase_product_name
             FROM vouchers v
             LEFT JOIN purchases p ON p.voucher_number = v.voucher_number
             WHERE v.voucher_number = $1`,
            [voucherNumber]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: true, message: 'שובר לא נמצא' });
        }
        
        const voucher = result.rows[0];
        const imagePath = path.join(VOUCHERS_DIR, `${voucherNumber}.png`);
        
        // Check if image already exists
        let imageExists = false;
        try {
            await fs.access(imagePath);
            imageExists = true;
        } catch {}
        
        // Generate if doesn't exist or force regenerate
        if (!imageExists || forceRegenerate) {
            const expiryDate = voucher.expiry_date 
                ? new Date(voucher.expiry_date).toLocaleDateString('he-IL')
                : new Date(Date.now() + 365*24*60*60*1000).toLocaleDateString('he-IL');
            
            const recipientName = voucher.recipient_first_name 
                ? `${voucher.recipient_first_name} ${voucher.recipient_last_name || ''}`
                : voucher.customer_name || voucher.recipient_name || '';
            
            // Use product_name if available (for product vouchers), otherwise use amount
            const displayAmount = voucher.product_name || voucher.purchase_product_name || voucher.original_amount || voucher.remaining_amount;
            
            const imageBuffer = await voucherService.generateVoucherImage({
                voucherNumber,
                amount: displayAmount,
                recipientName,
                greeting: voucher.greeting || voucher.purchase_greeting || `מתנה מיוחדת עבור ${recipientName}`,
                expiryDate
            });
            
            await fs.writeFile(imagePath, imageBuffer);
        }
        
        // Return the image
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="voucher-${voucherNumber}.png"`);
        
        const imageBuffer = await fs.readFile(imagePath);
        res.send(imageBuffer);

    } catch (error) {
        console.error('Generate voucher image error:', error);
        next(error);
    }
});

// Get existing voucher image
router.get('/:voucherId/image', async (req, res, next) => {
    try {
        const { voucherId } = req.params;
        const imagePath = path.join(VOUCHERS_DIR, `${voucherId}.png`);

        try {
            await fs.access(imagePath);
        } catch {
            return res.status(404).json({
                error: true,
                message: 'שובר לא נמצא'
            });
        }

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="voucher-${voucherId}.png"`);
        
        const imageBuffer = await fs.readFile(imagePath);
        res.send(imageBuffer);

    } catch (error) {
        next(error);
    }
});

module.exports = router;
