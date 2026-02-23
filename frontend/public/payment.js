// Payment page initialization
document.addEventListener('DOMContentLoaded', () => {
    initPaymentForm();
    initCardFormatting();
    checkVoucherSelected();
});

function checkVoucherSelected() {
    const saved = localStorage.getItem('selectedVoucher');
    if (!saved) {
        window.location.href = 'index.html';
    }
}

function initCardFormatting() {
    const cardNumber = document.getElementById('cardNumber');
    const cardExpiry = document.getElementById('cardExpiry');
    const cardCvv = document.getElementById('cardCvv');
    const cardId = document.getElementById('cardId');
    
    if (cardNumber) {
        cardNumber.addEventListener('input', (e) => {
            e.target.value = formatCardNumber(e.target.value);
        });
    }
    
    if (cardExpiry) {
        cardExpiry.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.substring(0, 2) + '/' + value.substring(2, 4);
            }
            e.target.value = value;
        });
    }
    
    if (cardCvv) {
        cardCvv.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
        });
    }
    
    if (cardId) {
        cardId.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').substring(0, 9);
        });
    }
}

function initPaymentForm() {
    const form = document.getElementById('purchaseForm');
    
    if (form) {
        form.addEventListener('submit', handlePurchaseSubmit);
    }
}

async function handlePurchaseSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    // Disable button and show loader
    submitBtn.disabled = true;
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    
    try {
        const formData = new FormData(e.target);
        const selectedVoucher = JSON.parse(localStorage.getItem('selectedVoucher'));
        
        const purchaseData = {
            voucher: {
                amount: selectedVoucher.amount,
                price: selectedVoucher.price
            },
            buyer: {
                name: formData.get('buyerName'),
                email: formData.get('buyerEmail'),
                phone: formData.get('buyerPhone')
            },
            recipient: {
                name: formData.get('recipientName'),
                greeting: formData.get('greeting') || ''
            },
            payment: {
                cardNumber: formData.get('cardNumber').replace(/\s/g, ''),
                expiry: formData.get('cardExpiry'),
                cvv: formData.get('cardCvv'),
                cardHolder: formData.get('cardHolder'),
                cardId: formData.get('cardId')
            }
        };
        
        const result = await createPurchase(purchaseData);
        
        // Store result for thank you page
        localStorage.setItem('purchaseResult', JSON.stringify(result));
        localStorage.removeItem('selectedVoucher');
        
        // Redirect to thank you page
        window.location.href = 'thank-you.html';
        
    } catch (error) {
        alert(error.message || 'אירעה שגיאה בעיבוד התשלום. אנא נסו שנית.');
        console.error('Purchase error:', error);
        
        // Re-enable button
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
    }
}
