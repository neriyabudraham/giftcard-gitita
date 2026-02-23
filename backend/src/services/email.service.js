const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;

const VOUCHERS_DIR = path.join(__dirname, '../../vouchers');

// Create transporter with Gmail settings
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER || 'office@neriyabudraham.co.il',
        pass: process.env.SMTP_PASS
    }
});

async function sendVoucherEmail(data) {
    const { to, buyerName, voucherNumber, amount, voucherId } = data;

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
        from: process.env.SMTP_FROM || '"שפת המדבר" <office@neriyabudraham.co.il>',
        to,
        subject: `שובר המתנה שלך - ₪${amount} | שפת המדבר`,
        html: `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { width: 80px; height: 80px; border-radius: 50%; margin-bottom: 15px; }
        h1 { color: #6B7D4F; margin: 0; }
        .content { line-height: 1.8; color: #333; }
        .voucher-info { background: #f8f9fa; border-radius: 10px; padding: 20px; margin: 20px 0; border-right: 4px solid #8B9D6F; }
        .voucher-info p { margin: 8px 0; }
        .voucher-image { text-align: center; margin: 20px 0; }
        .voucher-image img { max-width: 100%; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9rem; }
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
            ${attachments.length > 0 ? '<div class="voucher-image"><img src="cid:voucher" alt="שובר מתנה"></div>' : ''}
            <p>השובר מצורף גם כקובץ תמונה להורדה.</p>
            <p>בברכה,<br>צוות שפת המדבר</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} שפת המדבר - חוויה של יופי וטבע</p>
        </div>
    </div>
</body>
</html>`,
        attachments
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to}`);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

async function sendPasswordResetEmail(to, name, token) {
    const resetUrl = `${process.env.FRONTEND_URL || 'https://giftcard-gitita.botomat.co.il'}/admin/reset-password.html?token=${token}`;

    const mailOptions = {
        from: process.env.SMTP_FROM || '"שפת המדבר" <office@neriyabudraham.co.il>',
        to,
        subject: 'איפוס סיסמה - מערכת שוברים',
        html: `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        h1 { color: #6B7D4F; text-align: center; }
        .content { line-height: 1.8; color: #333; }
        .button { display: block; width: 200px; margin: 30px auto; padding: 15px 30px; background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #1a1a1a; text-align: center; text-decoration: none; border-radius: 50px; font-weight: bold; }
        .warning { background: #fff3cd; border-radius: 10px; padding: 15px; margin: 20px 0; color: #856404; }
    </style>
</head>
<body>
    <div class="container">
        <h1>איפוס סיסמה</h1>
        <div class="content">
            <p>שלום ${name || 'משתמש'},</p>
            <p>קיבלנו בקשה לאיפוס הסיסמה שלך במערכת ניהול השוברים.</p>
            <a href="${resetUrl}" class="button">איפוס סיסמה</a>
            <div class="warning">
                <p><strong>שימו לב:</strong> קישור זה תקף לשעה אחת בלבד.</p>
                <p>אם לא ביקשת לאפס את הסיסמה, ניתן להתעלם ממייל זה.</p>
            </div>
        </div>
    </div>
</body>
</html>`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${to}`);
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw error;
    }
}

module.exports = {
    sendVoucherEmail,
    sendPasswordResetEmail
};
