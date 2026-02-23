// Thank you page state
let voucherData = {};
let isVerified = false;
let verificationInterval = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadVoucherData();
    startPaymentVerification();
});

function loadVoucherData() {
    const params = new URLSearchParams(window.location.search);
    
    voucherData = {
        amount: params.get('amount'),
        voucherId: params.get('voucherId'),
        buyerFirstName: params.get('buyerFirstName'),
        buyerLastName: params.get('buyerLastName'),
        buyerPhone: params.get('buyerPhone'),
        buyerEmail: params.get('buyerEmail'),
        recipientFirstName: params.get('recipientFirstName'),
        recipientLastName: params.get('recipientLastName'),
        recipientPhone: params.get('recipientPhone'),
        greeting: params.get('greeting')
    };
    
    if (!voucherData.voucherId) {
        showError();
        return;
    }
    
    // Pre-fill display data
    document.getElementById('displayVoucherId').textContent = voucherData.voucherId;
    document.getElementById('displayProductName').textContent = getProductName(voucherData.amount);
    document.getElementById('displayBuyerName').textContent = `${voucherData.buyerFirstName} ${voucherData.buyerLastName}`;
    document.getElementById('displayRecipientName').textContent = `${voucherData.recipientFirstName} ${voucherData.recipientLastName}`;
    document.getElementById('displayExpiry').textContent = getExpiryDate();
}

function getProductName(amount) {
    switch(amount) {
        case '95': return 'קפה מאפה זוגי + עציץ';
        case '188': return 'ארוחת בוקר זוגית';
        default: return `שובר בסך ₪${amount}`;
    }
}

function getExpiryDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toLocaleDateString('he-IL');
}

function startPaymentVerification() {
    // Check verification via backend
    verificationInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/purchase/verify/${voucherData.voucherId}`);
            const result = await response.json();
            
            if (result.verified) {
                clearInterval(verificationInterval);
                onPaymentVerified(result);
            }
        } catch (error) {
            console.error('Verification error:', error);
        }
    }, 3000);
    
    // Timeout after 5 minutes
    setTimeout(() => {
        if (!isVerified) {
            clearInterval(verificationInterval);
            showError();
        }
    }, 300000);
}

function onPaymentVerified(result) {
    isVerified = true;
    
    // Update download button
    if (result.voucherImageUrl) {
        document.getElementById('downloadBtn').href = result.voucherImageUrl;
        document.getElementById('downloadBtn').setAttribute('download', `voucher-${voucherData.voucherId}.png`);
    } else {
        // Fallback to API endpoint
        document.getElementById('downloadBtn').href = `${API_BASE}/voucher/${voucherData.voucherId}/image`;
        document.getElementById('downloadBtn').setAttribute('download', `voucher-${voucherData.voucherId}.png`);
    }
    
    showSuccess();
}

function showSuccess() {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('errorState').classList.add('hidden');
    document.getElementById('successState').classList.remove('hidden');
}

function showError() {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('successState').classList.add('hidden');
    document.getElementById('errorState').classList.remove('hidden');
}

// Manual verification trigger (for testing or fallback)
function manualVerify() {
    onPaymentVerified({
        verified: true,
        voucherImageUrl: `${API_BASE}/voucher/${voucherData.voucherId}/image`
    });
}
