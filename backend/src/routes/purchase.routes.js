const express = require('express');
const router = express.Router();
const purchaseService = require('../services/purchase.service');
const voucherService = require('../services/voucher.service');
const emailService = require('../services/email.service');

router.post('/', async (req, res, next) => {
    try {
        const { voucher, buyer, recipient, payment } = req.body;

        // Validate required fields
        if (!voucher?.amount || !buyer?.name || !buyer?.email || !recipient?.name) {
            return res.status(400).json({
                error: true,
                message: 'חסרים פרטים נדרשים'
            });
        }

        // TODO: Process payment (integrate with payment provider)
        // For now, simulate successful payment
        const paymentResult = await purchaseService.processPayment(payment, voucher.price);

        if (!paymentResult.success) {
            return res.status(400).json({
                error: true,
                message: paymentResult.message || 'התשלום נכשל'
            });
        }

        // Create purchase record
        const purchase = await purchaseService.createPurchase({
            voucher,
            buyer,
            recipient,
            paymentId: paymentResult.transactionId
        });

        // Generate voucher image
        const voucherImage = await voucherService.generateVoucherImage({
            voucherNumber: purchase.voucherNumber,
            amount: voucher.amount,
            recipientName: recipient.name,
            greeting: recipient.greeting,
            expiryDate: purchase.expiryDate
        });

        // Save voucher image
        await voucherService.saveVoucherImage(purchase.voucherId, voucherImage);

        // Send email with voucher
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
            voucherImageUrl: `/api/voucher/${purchase.voucherId}/image`
        });

    } catch (error) {
        next(error);
    }
});

module.exports = router;
