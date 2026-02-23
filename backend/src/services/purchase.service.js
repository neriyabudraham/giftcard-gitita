const { v4: uuidv4 } = require('uuid');

// In-memory storage (replace with database in production)
const purchases = new Map();

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

async function processPayment(paymentDetails, amount) {
    // TODO: Integrate with actual payment provider (e.g., Tranzila, CardCom, etc.)
    // For now, simulate payment processing

    // Basic validation
    if (!paymentDetails.cardNumber || !paymentDetails.expiry || !paymentDetails.cvv) {
        return {
            success: false,
            message: 'פרטי כרטיס חסרים'
        };
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate successful payment
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
    processPayment,
    createPurchase,
    getPurchase
};
