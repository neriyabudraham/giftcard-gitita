// Payment page state
let formData = {};
let amount = '95';
let voucherId = '';

// Payment URLs for meshulam
const PAYMENT_URLS = {
    '95': 'https://meshulam.co.il/quick_payment?b=94d3052b31acdf125df594d1b61d9d06',
    '188': 'https://meshulam.co.il/quick_payment?b=94f3afb628451a34b6868895f1cef522',
    '100': 'https://meshulam.co.il/quick_payment?b=e5cbd287b0610688a5dc413649649a40',
    '300': 'https://meshulam.co.il/quick_payment?b=bb441e5bf72a76ecb2be8498f7c43149',
    '600': 'https://meshulam.co.il/quick_payment?b=7b3fdae2f87845522fd06fdd5a9c47e6'
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initPaymentPage();
    loadSavedFormData();
    initPhoneFormatting();
    initFormSubmission();
});

function initPaymentPage() {
    const params = new URLSearchParams(window.location.search);
    amount = params.get('amount') || '95';
    voucherId = params.get('id') || generateVoucherId();
    
    // Update amount badge
    document.getElementById('amountBadge').textContent = `שובר בסך ₪${amount}`;
    
    // Check if voucher was selected
    const saved = localStorage.getItem('selectedVoucher');
    if (!saved && !params.get('amount')) {
        window.location.href = 'index.html';
    }
}

function generateVoucherId() {
    return Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0');
}

function loadSavedFormData() {
    const savedData = localStorage.getItem('voucherFormData');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            const form = document.getElementById('purchaseForm');
            
            if (data.buyerFirstName) form.buyerFirstName.value = data.buyerFirstName;
            if (data.buyerLastName) form.buyerLastName.value = data.buyerLastName;
            if (data.buyerPhone) form.buyerPhone.value = formatPhone(data.buyerPhone);
            if (data.buyerEmail) form.buyerEmail.value = data.buyerEmail;
            if (data.recipientFirstName) form.recipientFirstName.value = data.recipientFirstName;
            if (data.recipientLastName) form.recipientLastName.value = data.recipientLastName;
            if (data.recipientPhone) form.recipientPhone.value = formatPhone(data.recipientPhone);
            if (data.greeting) form.greeting.value = data.greeting;
        } catch (e) {
            console.error('Error loading saved form data:', e);
        }
    }
}

function saveFormData() {
    const form = document.getElementById('purchaseForm');
    const data = {
        buyerFirstName: form.buyerFirstName.value,
        buyerLastName: form.buyerLastName.value,
        buyerPhone: form.buyerPhone.value,
        buyerEmail: form.buyerEmail.value,
        recipientFirstName: form.recipientFirstName.value,
        recipientLastName: form.recipientLastName.value,
        recipientPhone: form.recipientPhone.value,
        greeting: form.greeting.value
    };
    
    if (data.buyerFirstName || data.buyerLastName || data.buyerPhone || data.buyerEmail) {
        localStorage.setItem('voucherFormData', JSON.stringify(data));
    }
}

function initPhoneFormatting() {
    const phoneInputs = document.querySelectorAll('input[type="tel"]');
    phoneInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            e.target.value = formatPhone(e.target.value);
        });
    });
    
    // Auto-save form data on change
    document.querySelectorAll('.form-input, .form-textarea').forEach(input => {
        input.addEventListener('change', saveFormData);
    });
}

function formatPhone(value) {
    let numbers = value.replace(/\D/g, '');
    
    if (numbers.startsWith('972') && numbers.length >= 10 && numbers.length <= 12) {
        numbers = '0' + numbers.substring(3);
    }
    
    if (numbers.length === 9 && !numbers.startsWith('0')) {
        numbers = '0' + numbers;
    }
    
    if (numbers.length > 10) {
        numbers = numbers.substring(0, 10);
    }
    
    if (numbers.length === 10) {
        return numbers.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }
    
    return numbers;
}

function validateForm() {
    const form = document.getElementById('purchaseForm');
    const errors = {};
    
    // Clear previous errors
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    
    if (!form.buyerFirstName.value.trim()) errors.buyerFirstName = 'שם פרטי נדרש';
    if (!form.buyerLastName.value.trim()) errors.buyerLastName = 'שם משפחה נדרש';
    if (!form.buyerPhone.value.trim()) errors.buyerPhone = 'טלפון רוכש נדרש';
    if (!form.buyerEmail.value.trim()) errors.buyerEmail = 'אימייל רוכש נדרש';
    if (!form.recipientFirstName.value.trim()) errors.recipientFirstName = 'שם פרטי נדרש';
    if (!form.recipientLastName.value.trim()) errors.recipientLastName = 'שם משפחה נדרש';
    if (!form.recipientPhone.value.trim()) errors.recipientPhone = 'טלפון מקבל נדרש';
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (form.buyerEmail.value && !emailRegex.test(form.buyerEmail.value)) {
        errors.buyerEmail = 'פורמט אימייל לא תקין';
    }
    
    // Phone validation
    const buyerPhoneNumbers = form.buyerPhone.value.replace(/\D/g, '');
    if (form.buyerPhone.value && buyerPhoneNumbers.length !== 10) {
        errors.buyerPhone = 'טלפון רוכש חייב להכיל 10 ספרות';
    }
    
    const recipientPhoneNumbers = form.recipientPhone.value.replace(/\D/g, '');
    if (form.recipientPhone.value && recipientPhoneNumbers.length !== 10) {
        errors.recipientPhone = 'טלפון מקבל חייב להכיל 10 ספרות';
    }
    
    // Display errors
    Object.keys(errors).forEach(key => {
        const errorEl = document.getElementById(`error-${key}`);
        if (errorEl) errorEl.textContent = errors[key];
    });
    
    return Object.keys(errors).length === 0;
}

function initFormSubmission() {
    const form = document.getElementById('purchaseForm');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!validateForm()) return;
        
        const submitBtn = document.getElementById('submitBtn');
        const btnText = document.getElementById('btnText');
        const btnLoader = document.getElementById('btnLoader');
        
        // Disable button and show loader
        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        
        try {
            // Gather form data
            formData = {
                voucherId: voucherId,
                amount: amount,
                buyerFirstName: form.buyerFirstName.value,
                buyerLastName: form.buyerLastName.value,
                buyerPhone: form.buyerPhone.value.replace(/\D/g, ''),
                buyerEmail: form.buyerEmail.value,
                recipientFirstName: form.recipientFirstName.value,
                recipientLastName: form.recipientLastName.value,
                recipientPhone: form.recipientPhone.value.replace(/\D/g, ''),
                greeting: form.greeting.value
            };
            
            // Save to backend
            await savePurchaseData(formData);
            
            // Open payment modal
            openPaymentModal();
            
        } catch (error) {
            console.error('Error during submission:', error);
            alert('אירעה שגיאה. אנא נסה שוב.');
            
            submitBtn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
        }
    });
}

async function savePurchaseData(data) {
    try {
        const response = await fetch(`${API_BASE}/purchase/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...data,
                status: 'pending'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save purchase data');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error saving purchase:', error);
        // Don't block payment if save fails
    }
}

function openPaymentModal() {
    const paymentUrl = PAYMENT_URLS[amount] || PAYMENT_URLS['95'];
    
    document.getElementById('paymentIframe').src = paymentUrl;
    document.getElementById('paymentModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
    document.body.style.overflow = '';
    
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    
    submitBtn.disabled = false;
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    
    // Navigate to thank you page for verification
    navigateToThankYou();
}

function navigateToThankYou() {
    const params = new URLSearchParams({
        amount,
        voucherId,
        buyerFirstName: formData.buyerFirstName,
        buyerLastName: formData.buyerLastName,
        buyerPhone: formData.buyerPhone,
        buyerEmail: formData.buyerEmail,
        recipientFirstName: formData.recipientFirstName,
        recipientLastName: formData.recipientLastName,
        recipientPhone: formData.recipientPhone,
        greeting: formData.greeting
    });
    
    window.location.href = `thank-you.html?${params.toString()}`;
}
