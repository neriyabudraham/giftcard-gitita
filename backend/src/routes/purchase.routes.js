const express = require('express');
const router = express.Router();
const purchaseService = require('../services/purchase.service');
const voucherService = require('../services/voucher.service');
const emailService = require('../services/email.service');

// Save purchase data (before payment)
router.post('/save', async (req, res, next) => {
    try {
        const purchaseData = req.body;

        if (!purchaseData.voucherId || !purchaseData.amount) {
            return res.status(400).json({
                error: true,
                message: 'חסרים פרטים נדרשים'
            });
        }

        const purchase = await purchaseService.savePurchase(purchaseData);

        res.json({
            success: true,
            purchaseId: purchase.id,
            voucherId: purchase.voucherId
        });

    } catch (error) {
        next(error);
    }
});

// Verify payment status
router.get('/verify/:voucherId', async (req, res, next) => {
    try {
        const { voucherId } = req.params;

        // Check if payment was verified (via webhook or polling)
        const purchase = await purchaseService.getPurchaseByVoucherId(voucherId);

        if (!purchase) {
            return res.json({ verified: false });
        }

        if (purchase.status === 'completed') {
            return res.json({
                verified: true,
                voucherImageUrl: `/voucher/${voucherId}/image`,
                orderId: purchase.orderId
            });
        }

        // Poll external verification (base44)
        const externalVerified = await purchaseService.checkExternalVerification(voucherId);
        
        if (externalVerified) {
            // Update status and generate voucher
            await purchaseService.markAsCompleted(voucherId);
            
            // Generate voucher image
            const voucherImage = await voucherService.generateVoucherImage({
                voucherNumber: voucherId,
                amount: purchase.amount,
                recipientName: `${purchase.recipientFirstName} ${purchase.recipientLastName}`,
                greeting: purchase.greeting,
                expiryDate: purchaseService.getExpiryDate()
            });

            await voucherService.saveVoucherImage(voucherId, voucherImage);

            // Send email
            await emailService.sendVoucherEmail({
                to: purchase.buyerEmail,
                buyerName: `${purchase.buyerFirstName} ${purchase.buyerLastName}`,
                voucherNumber: voucherId,
                amount: purchase.amount,
                voucherId: voucherId
            });

            return res.json({
                verified: true,
                voucherImageUrl: `/voucher/${voucherId}/image`
            });
        }

        res.json({ verified: false });

    } catch (error) {
        next(error);
    }
});

// Webhook for payment confirmation (from meshulam or n8n)
router.post('/webhook', async (req, res, next) => {
    try {
        const { voucherId, transactionId, status } = req.body;

        if (status === 'success' || status === 'approved') {
            const purchase = await purchaseService.getPurchaseByVoucherId(voucherId);
            
            if (purchase && purchase.status !== 'completed') {
                await purchaseService.markAsCompleted(voucherId, transactionId);

                // Generate voucher image
                const voucherImage = await voucherService.generateVoucherImage({
                    voucherNumber: voucherId,
                    amount: purchase.amount,
                    recipientName: `${purchase.recipientFirstName} ${purchase.recipientLastName}`,
                    greeting: purchase.greeting,
                    expiryDate: purchaseService.getExpiryDate()
                });

                await voucherService.saveVoucherImage(voucherId, voucherImage);

                // Send email
                await emailService.sendVoucherEmail({
                    to: purchase.buyerEmail,
                    buyerName: `${purchase.buyerFirstName} ${purchase.buyerLastName}`,
                    voucherNumber: voucherId,
                    amount: purchase.amount,
                    voucherId: voucherId
                });
            }
        }

        res.json({ success: true });

    } catch (error) {
        next(error);
    }
});

// Legacy endpoint for full purchase (if needed)
router.post('/', async (req, res, next) => {
    try {
        const { voucher, buyer, recipient, payment } = req.body;

        if (!voucher?.amount || !buyer?.name || !buyer?.email || !recipient?.name) {
            return res.status(400).json({
                error: true,
                message: 'חסרים פרטים נדרשים'
            });
        }

        const purchase = await purchaseService.createPurchase({
            voucher,
            buyer,
            recipient
        });

        const voucherImage = await voucherService.generateVoucherImage({
            voucherNumber: purchase.voucherNumber,
            amount: voucher.amount,
            recipientName: recipient.name,
            greeting: recipient.greeting,
            expiryDate: purchase.expiryDate
        });

        await voucherService.saveVoucherImage(purchase.voucherId, voucherImage);

        await emailService.sendVoucherEmail({
            to: buyer.email,
            buyerName: buyer.name,
            voucherNumber: purchase.voucherNumber,
            amount: voucher.amount,
            voucherId: purchase.voucherId
        });

        res.json({
            success: true,
            orderId: purchase.orderId,
            voucherId: purchase.voucherId,
            voucherNumber: purchase.voucherNumber,
            amount: voucher.amount,
            expiryDate: purchase.expiryDate,
            voucherImageUrl: `/voucher/${purchase.voucherId}/image`
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
