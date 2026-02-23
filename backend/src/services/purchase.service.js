const { v4: uuidv4 } = require('uuid');

// In-memory storage (replace with database in production)
const purchases = new Map();

// External verification URL (base44)
const VERIFICATION_URL = 'https://base44.app/api/apps/68a70851bac1fc26b58e4900/entities/Voucher';

function generateVoucherNumber() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SM-${timestamp}-${random}`;
}

function getExpiryDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toLocaleDateString('he-IL');
}

async function savePurchase(data) {
    const id = uuidv4();
    
    const purchase = {
        id,
        voucherId: data.voucherId,
        amount: data.amount,
        buyerFirstName: data.buyerFirstName,
        buyerLastName: data.buyerLastName,
        buyerPhone: data.buyerPhone,
        buyerEmail: data.buyerEmail,
        recipientFirstName: data.recipientFirstName,
        recipientLastName: data.recipientLastName,
        recipientPhone: data.recipientPhone,
        greeting: data.greeting,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    purchases.set(data.voucherId, purchase);
    
    return purchase;
}

async function getPurchaseByVoucherId(voucherId) {
    return purchases.get(voucherId);
}

async function markAsCompleted(voucherId, transactionId = null) {
    const purchase = purchases.get(voucherId);
    
    if (purchase) {
        purchase.status = 'completed';
        purchase.completedAt = new Date().toISOString();
        if (transactionId) {
            purchase.transactionId = transactionId;
        }
        purchases.set(voucherId, purchase);
    }
    
    return purchase;
}

async function checkExternalVerification(voucherId) {
    try {
        const response = await fetch(
            `${VERIFICATION_URL}?status=active&voucher_number=${voucherId}`
        );
        
        if (!response.ok) {
            return false;
        }
        
        const result = await response.json();
        return result && result.length > 0;
        
    } catch (error) {
        console.error('External verification error:', error);
        return false;
    }
}

async function processPayment(paymentDetails, amount) {
    // Placeholder for actual payment processing
    if (!paymentDetails.cardNumber || !paymentDetails.expiry || !paymentDetails.cvv) {
        return {
            success: false,
            message: 'פרטי כרטיס חסרים'
        };
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    return {
        success: true,
        transactionId: `TXN-${uuidv4().substring(0, 8).toUpperCase()}`
    };
}

async function createPurchase(data) {
    const orderId = `ORD-${uuidv4().substring(0, 8).toUpperCase()}`;
    const voucherId = uuidv4();
    const voucherNumber = generateVoucherNumber();
    const expiryDate = getExpiryDate();

    const purchase = {
        orderId,
        voucherId,
        voucherNumber,
        expiryDate,
        ...data,
        createdAt: new Date().toISOString(),
        status: 'completed'
    };

    purchases.set(orderId, purchase);

    return purchase;
}

async function getPurchase(orderId) {
    return purchases.get(orderId);
}

module.exports = {
    savePurchase,
    getPurchaseByVoucherId,
    markAsCompleted,
    checkExternalVerification,
    processPayment,
    createPurchase,
    getPurchase,
    getExpiryDate
};
