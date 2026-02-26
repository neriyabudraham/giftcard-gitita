const path = require('path');
const fs = require('fs').promises;

const HTML2PNG_URL = process.env.HTML2PNG_URL || 'https://html2png.botomat.co.il/html2png/coordinates';
const VOUCHERS_DIR = path.join(__dirname, '../../vouchers');

function generateVoucherHTML(data) {
    const { voucherNumber, amount, recipientName, greeting, expiryDate } = data;
    
    // Check if amount is a product name (string) or numeric value
    const numAmount = parseFloat(amount);
    const isProductVoucher = isNaN(numAmount) || numAmount === 0;
    
    // Format amount - for monetary show ₪X, for product show product name
    let formattedAmount;
    if (isProductVoucher) {
        formattedAmount = amount; // Product name
    } else {
        formattedAmount = Number.isInteger(numAmount) ? numAmount.toString() : numAmount.toLocaleString('he-IL');
    }
    
    const formattedGreeting = greeting 
        ? greeting.replace(/\n/g, '<br>') 
        : `שובר מתנה עבור ${recipientName}`;

    return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>שובר מתנה - שפת המדבר</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Varela+Round&family=Assistant:wght@300;400;500;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Assistant', Arial, sans-serif;
            background: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .voucher {
            background: white;
            border-radius: 25px;
            width: 1000px;
            max-width: 95vw;
            height: 300px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1), 0 8px 20px rgba(0,0,0,0.05);
            overflow: hidden;
            position: relative;
            display: flex;
            border: 2px solid #f0f2f5;
        }
        
        .voucher::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                radial-gradient(circle at 20% 20%, rgba(139, 157, 111, 0.05) 0%, transparent 50%),
                radial-gradient(circle at 80% 80%, rgba(171, 184, 143, 0.05) 0%, transparent 50%);
            pointer-events: none;
        }
        
        .voucher-left {
          flex: 1;
          background-image: url('https://images.unsplash.com/photo-1490750967868-88aa4486c946?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80');
          background-size: cover;
          background-position: center;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 30px 25px;
          color: white;
          position: relative;
          overflow: hidden;
        }
    
        .voucher-left::before {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 1;
        }
        
        .voucher-left::after {
            content: '';
            position: absolute;
            bottom: -30px;
            left: -30px;
            width: 80px;
            height: 80px;
            background: rgba(255,255,255,0.06);
            border-radius: 50%;
            z-index: 1;
        }
        
        .voucher-right {
            flex: 1;
            background: #fefefe;
            position: relative;
            display: flex;
        }
        
        .greeting-section {
            flex: 1;
            padding: 20px 25px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            border-left: 1px dashed #e0e6ed;
            position: relative;
        }
        
        .details-section {
            flex: 1;
            padding: 25px 30px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 0 23px 23px 0;
            position: relative;
        }
        
        .details-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="90" cy="10" r="1" fill="%23ABB88F" opacity="0.3"/><circle cx="10" cy="90" r="1.5" fill="%238B9D6F" opacity="0.2"/><circle cx="30" cy="20" r="0.8" fill="%23ABB88F" opacity="0.4"/><circle cx="70" cy="80" r="1.2" fill="%238B9D6F" opacity="0.3"/></svg>') repeat;
            opacity: 0.5;
            pointer-events: none;
        }
        
        .logo {
            width: 90px;
            height: 90px;
            border-radius: 50%;
            background-image: url('https://files.neriyabudraham.co.il/files/save_IMG_0392_20250916_xhwpe.jpg');
            background-size: cover;
            background-position: center;
            border: 3px solid rgba(255,255,255,0.4);
            margin-bottom: 15px;
            box-shadow: 0 6px 15px rgba(0,0,0,0.2);
            position: relative;
            z-index: 2;
        }
        
        .voucher-title {
            font-family: 'Varela Round', sans-serif;
            font-size: 1.8rem;
            font-weight: 400;
            text-align: center;
            margin-bottom: 8px;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
            position: relative;
            z-index: 2;
        }
        
        .voucher-amount {
            font-size: 2.8rem;
            font-weight: 700;
            text-align: center;
            color: #FFD700;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            margin-bottom: 8px;
            position: relative;
            z-index: 2;
        }
        
        .voucher-subtitle {
            font-size: 0.9rem;
            text-align: center;
            opacity: 0.9;
            line-height: 1.3;
            font-weight: 300;
            position: relative;
            z-index: 2;
        }
        
        .greeting-header {
            font-family: 'Varela Round', sans-serif;
            font-size: 1.4rem;
            color: #6B7D4F;
            margin-bottom: 15px;
            font-weight: 500;
            position: relative;
        }
        
        .greeting-header::after {
            content: '';
            position: absolute;
            bottom: -5px;
            right: 0;
            width: 40px;
            height: 2px;
            background: linear-gradient(to left, #ABB88F, transparent);
        }
        
        .personal-greeting {
            color: #444;
            word-wrap: break-word;
            overflow-wrap: break-word;
            font-weight: 400;
            flex: 1;
            display: flex;
            align-items: center;
            padding: 10px 0;
            text-align: justify;
            hyphens: auto;
        }
        
        .details-header {
            font-family: 'Varela Round', sans-serif;
            font-size: 1.2rem;
            color: #6B7D4F;
            margin-bottom: 15px;
            font-weight: 500;
            text-align: center;
            position: relative;
            z-index: 2;
        }
        
        .voucher-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 12px;
            position: relative;
            z-index: 2;
        }
        
        .info-item {
            background: white;
            padding: 10px 15px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            border-right: 3px solid #ABB88F;
        }
        
        .info-label {
            font-size: 0.8rem;
            color: #8B9D6F;
            font-weight: 500;
            margin-bottom: 2px;
        }
        
        .info-value {
            font-size: 0.95rem;
            color: #333;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="voucher">
        <div class="voucher-left">
            <div style="text-align: center; display: flex; flex-direction: column; align-items: center;">
                <div class="logo"></div>
                <div class="voucher-title">שובר מתנה</div>
                <div class="voucher-amount">${isProductVoucher ? formattedAmount : '₪' + formattedAmount}</div>
                <div class="voucher-subtitle">שפת המדבר<br>חוויה של יופי וטבע</div>
            </div>
        </div>
        
        <div class="voucher-right">
            <div class="greeting-section">
                <div class="greeting-header">ברכה אישית</div>
                <div class="personal-greeting" id="greetingText">
${formattedGreeting}
                </div>
            </div>
            
            <div class="details-section">
                <div class="details-header">פרטי השובר</div>
                <div class="voucher-info">
                    <div class="info-item">
                        <div class="info-label">תוקף עד</div>
                        <div class="info-value">${expiryDate}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">מספר שובר</div>
                        <div class="info-value">${voucherNumber}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        function adjustGreetingTextSize() {
            const greetingText = document.getElementById('greetingText');
            if (!greetingText) return;
            
            const greetingSection = greetingText.closest('.greeting-section');
            if (!greetingSection) return;
            
            const header = greetingSection.querySelector('.greeting-header');
            const headerHeight = header ? header.offsetHeight + 15 : 0;
            const availableHeight = greetingSection.clientHeight - headerHeight - 40;
            
            let fontSize = 22;
            let lineHeight = 1.6;
            
            greetingText.style.fontSize = fontSize + 'px';
            greetingText.style.lineHeight = lineHeight;
            
            while ((greetingText.scrollHeight > availableHeight) && fontSize > 10) {
                fontSize -= 1;
                if (fontSize < 16) lineHeight = 1.4;
                if (fontSize < 12) lineHeight = 1.2;
                
                greetingText.style.fontSize = fontSize + 'px';
                greetingText.style.lineHeight = lineHeight;
            }
            
            while ((greetingText.scrollHeight > availableHeight) && lineHeight > 1.0 && fontSize <= 10) {
                lineHeight -= 0.1;
                greetingText.style.lineHeight = lineHeight;
            }
        }
        
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(adjustGreetingTextSize, 100);
            window.addEventListener('resize', function() {
                setTimeout(adjustGreetingTextSize, 100);
            });
        });
        
        if (document.fonts) {
            document.fonts.ready.then(function() {
                setTimeout(adjustGreetingTextSize, 50);
            });
        }
    </script>
</body>
</html>`;
}

async function generateVoucherImage(data) {
    const html = generateVoucherHTML(data);
    
    try {
        const response = await fetch(HTML2PNG_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/html',
                'X-Screen-Width': '1200',
                'X-Screen-Height': '800',
                'X-Start-Right-X': '100',
                'X-Start-Right-Y': '250',
                'X-End-Left-X': '1100',
                'X-End-Left-Y': '550'
            },
            body: html
        });

        if (!response.ok) {
            throw new Error(`HTML2PNG service error: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer);

    } catch (error) {
        console.error('Error generating voucher image:', error);
        throw new Error('שגיאה ביצירת תמונת השובר');
    }
}

async function saveVoucherImage(voucherId, imageBuffer) {
    const filePath = path.join(VOUCHERS_DIR, `${voucherId}.png`);
    await fs.writeFile(filePath, imageBuffer);
    return filePath;
}

async function getVoucherImage(voucherId) {
    const filePath = path.join(VOUCHERS_DIR, `${voucherId}.png`);
    return fs.readFile(filePath);
}

module.exports = {
    generateVoucherImage,
    saveVoucherImage,
    getVoucherImage,
    generateVoucherHTML
};
