// Thank you page initialization
document.addEventListener('DOMContentLoaded', () => {
    loadPurchaseResult();
    initDownloadButton();
});

function loadPurchaseResult() {
    const result = localStorage.getItem('purchaseResult');
    
    if (!result) {
        window.location.href = 'index.html';
        return;
    }
    
    const purchase = JSON.parse(result);
    
    // Update display
    document.getElementById('orderNumber').textContent = purchase.orderId || '-';
    document.getElementById('voucherNumber').textContent = purchase.voucherNumber || '-';
    document.getElementById('voucherAmount').textContent = `₪${purchase.amount}` || '-';
    document.getElementById('voucherExpiry').textContent = purchase.expiryDate || '-';
    
    // Load voucher image
    if (purchase.voucherImageUrl) {
        const voucherImage = document.getElementById('voucherImage');
        voucherImage.src = purchase.voucherImageUrl;
        voucherImage.alt = `שובר מתנה מספר ${purchase.voucherNumber}`;
    }
    
    // Store for download
    window.purchaseData = purchase;
}

function initDownloadButton() {
    const downloadBtn = document.getElementById('downloadBtn');
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', handleDownload);
    }
}

async function handleDownload() {
    const downloadBtn = document.getElementById('downloadBtn');
    const originalContent = downloadBtn.innerHTML;
    
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<span class="btn-loader">מוריד...</span>';
    
    try {
        const purchase = window.purchaseData;
        
        if (!purchase || !purchase.voucherId) {
            throw new Error('לא נמצאו פרטי שובר');
        }
        
        // Get voucher image
        const blob = await getVoucherImage(purchase.voucherId);
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voucher-${purchase.voucherNumber}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        alert(error.message || 'שגיאה בהורדת השובר');
        console.error('Download error:', error);
    } finally {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = originalContent;
    }
}
