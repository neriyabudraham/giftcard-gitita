const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;

const VOUCHERS_DIR = path.join(__dirname, '../../vouchers');

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function sendVoucherEmail(data) {
    const { to, buyerName, voucherNumber, amount, voucherId } = data;

    // Get voucher image
    const voucherPath = path.join(VOUCHERS_DIR, `${voucherId}.png`);
    let attachments = [];

    try {
        await fs.access(voucherPath);
        attachments.push({
            filename: `voucher-${voucherNumber}.png`,
            path: voucherPath,
            cid: 'voucher'
        });
    } catch {
        console.warn('Voucher image not found for email attachment');
    }

    const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@giftcard-gitita.botomat.co.il',
        to,
        subject: `שובר המתנה שלך - ₪${amount} | שפת המדבר`,
        html: `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            margin-bottom: 15px;
        }
        h1 {
            color: #6B7D4F;
            margin: 0;
        }
        .content {
            line-height: 1.8;
            color: #333;
        }
        .voucher-info {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            border-right: 4px solid #8B9D6F;
        }
        .voucher-info p {
            margin: 8px 0;
        }
        .voucher-image {
            text-align: center;
            margin: 20px 0;
        }
        .voucher-image img {
            max-width: 100%;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://files.neriyabudraham.co.il/files/save_IMG_0392_20250916_xhwpe.jpg" alt="שפת המדבר" class="logo">
            <h1>שובר המתנה שלך מוכן!</h1>
        </div>
        
        <div class="content">
            <p>שלום ${buyerName},</p>
            <p>תודה על רכישת שובר המתנה שלנו. מצורף השובר שלך:</p>
            
            <div class="voucher-info">
                <p><strong>מספר שובר:</strong> ${voucherNumber}</p>
                <p><strong>סכום:</strong> ₪${amount}</p>
                <p><strong>תוקף:</strong> שנה מיום הרכישה</p>
            </div>
            
            ${attachments.length > 0 ? `
            <div class="voucher-image">
                <img src="cid:voucher" alt="שובר מתנה">
            </div>
            ` : ''}
            
            <p>השובר מצורף גם כקובץ תמונה להורדה.</p>
            <p>בברכה,<br>צוות שפת המדבר</p>
        </div>
        
        <div class="footer">
            <p>© 2026 שפת המדבר - חוויה של יופי וטבע</p>
        </div>
    </div>
</body>
</html>
        `,
        attachments
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to}`);
    } catch (error) {
        console.error('Error sending email:', error);
        // Don't throw - email failure shouldn't fail the purchase
    }
}

module.exports = {
    sendVoucherEmail
};
