// Global state
const APP_STATE = {
    selectedVoucher: null,
    apiBase: '/api'
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initVoucherSelection();
    loadSelectedVoucher();
});

// Voucher selection
function initVoucherSelection() {
    const selectButtons = document.querySelectorAll('.select-voucher');
    
    selectButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.voucher-card');
            const amount = card.dataset.amount;
            const price = card.dataset.price;
            
            selectVoucher(amount, price);
        });
    });
}

function selectVoucher(amount, price) {
    APP_STATE.selectedVoucher = { amount, price };
    localStorage.setItem('selectedVoucher', JSON.stringify(APP_STATE.selectedVoucher));
    window.location.href = 'payment.html';
}

function loadSelectedVoucher() {
    const saved = localStorage.getItem('selectedVoucher');
    if (saved) {
        APP_STATE.selectedVoucher = JSON.parse(saved);
        updateSummary();
    }
}

function updateSummary() {
    const amountEl = document.getElementById('summaryAmount');
    const totalEl = document.getElementById('summaryTotal');
    
    if (amountEl && APP_STATE.selectedVoucher) {
        amountEl.textContent = `₪${APP_STATE.selectedVoucher.amount}`;
    }
    if (totalEl && APP_STATE.selectedVoucher) {
        totalEl.textContent = `₪${APP_STATE.selectedVoucher.price}`;
    }
}

// Utility functions
function formatCardNumber(value) {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    
    for (let i = 0, len = match.length; i < len; i += 4) {
        parts.push(match.substring(i, i + 4));
    }
    
    return parts.length ? parts.join(' ') : value;
}

function formatExpiry(value) {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
        return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
}

// API calls
async function createPurchase(data) {
    const response = await fetch(`${APP_STATE.apiBase}/purchase`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'שגיאה ביצירת הזמנה');
    }
    
    return response.json();
}

async function getVoucherImage(voucherId) {
    const response = await fetch(`${APP_STATE.apiBase}/voucher/${voucherId}/image`);
    
    if (!response.ok) {
        throw new Error('שגיאה בטעינת השובר');
    }
    
    return response.blob();
}
