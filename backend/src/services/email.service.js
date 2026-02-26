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
    const { to, buyerName, voucherNumber, amount, voucherId, recipientName, greeting, expiryDate, imageBuffer, isBuyerCopy } = data;

    let attachments = [];

    // If imageBuffer is provided (from admin creation), use it directly
    if (imageBuffer) {
        attachments.push({
            filename: `voucher-${voucherNumber}.png`,
            content: imageBuffer,
            cid: 'voucher'
        });
    } else {
        // Otherwise try to load from file
        const voucherPath = path.join(VOUCHERS_DIR, `${voucherId || voucherNumber}.png`);
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
    }
    
    const displayName = isBuyerCopy ? (buyerName || 'לקוח יקר') : (recipientName || buyerName || 'לקוח יקר');

    // Format amount - check if it's numeric or product name
    const numAmount = parseFloat(amount);
    const isProductVoucher = isNaN(numAmount) || numAmount === 0;
    const displayAmount = isProductVoucher ? amount : `₪${Number.isInteger(numAmount) ? numAmount : numAmount.toLocaleString()}`;
    const subjectAmount = isProductVoucher ? amount : `₪${numAmount}`;
    const expiryText = expiryDate ? new Date(expiryDate).toLocaleDateString('he-IL') : 'שנה מיום הרכישה';

    // Different content for buyer vs recipient
    const emailSubject = isBuyerCopy 
        ? `העתק שובר המתנה שרכשת - ${subjectAmount} | שפת המדבר`
        : `שובר המתנה שלך - ${subjectAmount} | שפת המדבר`;
    
    const introText = isBuyerCopy
        ? `תודה על הרכישה! מצורף העתק של שובר המתנה ששלחת${recipientName ? ' ל' + recipientName : ''}:`
        : 'קיבלת שובר מתנה מיוחד! מצורף השובר שלך:';

    const mailOptions = {
        from: process.env.SMTP_FROM || '"שפת המדבר" <office@neriyabudraham.co.il>',
        to,
        subject: emailSubject,
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
            <h1>${isBuyerCopy ? 'תודה על הרכישה!' : 'שובר המתנה שלך מוכן!'}</h1>
        </div>
        <div class="content">
            <p>שלום ${displayName},</p>
            <p>${introText}</p>
            <div class="voucher-info">
                <p><strong>מספר שובר:</strong> ${voucherNumber}</p>
                <p><strong>${isProductVoucher ? 'מוצר' : 'סכום'}:</strong> ${displayAmount}</p>
                ${recipientName && isBuyerCopy ? `<p><strong>מקבל:</strong> ${recipientName}</p>` : ''}
                <p><strong>תוקף עד:</strong> ${expiryText}</p>
            </div>
            ${attachments.length > 0 ? '<div class="voucher-image"><img src="cid:voucher" alt="שובר מתנה"></div>' : ''}
            <p>השובר מצורף גם כקובץ תמונה להורדה.</p>
            ${greeting && !isBuyerCopy ? `<p><em>"${greeting.replace(/\n/g, '<br>')}"</em></p>` : ''}
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

async function sendAdminNotificationEmail(data) {
    const { adminEmails, voucherNumber, amount, buyerName, buyerEmail, buyerPhone, recipientName, imageBuffer } = data;
    
    // Support both single email (string) and multiple emails (array)
    const emails = Array.isArray(adminEmails) ? adminEmails : (adminEmails ? [adminEmails] : []);
    if (emails.length === 0) return;

    // Prepare attachments if image is provided
    const attachments = [];
    if (imageBuffer) {
        attachments.push({
            filename: `voucher-${voucherNumber}.png`,
            content: imageBuffer,
            cid: 'voucherImage'
        });
    }

    const mailOptions = {
        from: process.env.SMTP_FROM || '"שפת המדבר" <office@neriyabudraham.co.il>',
        to: emails.join(', '),
        subject: `רכישה חדשה! שובר ${voucherNumber} - ${amount}`,
        attachments,
        html: `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #22c55e; padding-bottom: 20px; }
        h1 { color: #22c55e; margin: 0; }
        .content { line-height: 1.8; color: #333; }
        .info-box { background: #f0fdf4; border-radius: 10px; padding: 20px; margin: 20px 0; border-right: 4px solid #22c55e; }
        .info-box p { margin: 8px 0; }
        .info-box strong { color: #166534; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 רכישה חדשה!</h1>
        </div>
        <div class="content">
            <p>התקבלה רכישה חדשה במערכת השוברים:</p>
            <div class="info-box">
                <p><strong>מספר שובר:</strong> ${voucherNumber}</p>
                <p><strong>סכום/מוצר:</strong> ${amount}</p>
                <p><strong>שם הרוכש:</strong> ${buyerName || '-'}</p>
                <p><strong>מייל:</strong> ${buyerEmail || '-'}</p>
                <p><strong>טלפון:</strong> ${buyerPhone || '-'}</p>
                ${recipientName ? `<p><strong>מקבל השובר:</strong> ${recipientName}</p>` : ''}
            </div>
            ${imageBuffer ? `
            <div style="text-align:center; margin: 25px 0;">
                <p style="color:#166534; font-weight:600; margin-bottom:15px;">השובר:</p>
                <img src="cid:voucherImage" alt="שובר מתנה" style="max-width:100%; border-radius:10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            </div>
            ` : ''}
            <p>תוכל לצפות בפרטים המלאים במערכת הניהול.</p>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} שפת המדבר - מערכת ניהול שוברים</p>
        </div>
    </div>
</body>
</html>`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Admin notification sent to ${emails.join(', ')}`);
    } catch (error) {
        console.error('Error sending admin notification:', error);
    }
}

async function sendUnmatchedVoucherNotification(data) {
    const { adminEmails, voucherNumber, amount, payerName, payerEmail, payerPhone, paymentReference, imageBuffer } = data;
    
    // Support both single email (string) and multiple emails (array)
    const emails = Array.isArray(adminEmails) ? adminEmails : (adminEmails ? [adminEmails] : []);
    if (emails.length === 0) return;

    // Prepare attachments if image is provided
    const attachments = [];
    if (imageBuffer) {
        attachments.push({
            filename: `voucher-${voucherNumber}.png`,
            content: imageBuffer,
            cid: 'voucherImage'
        });
    }

    const mailOptions = {
        from: process.env.SMTP_FROM || '"שפת המדבר" <office@neriyabudraham.co.il>',
        to: emails.join(', '),
        subject: `⚠️ שובר נוצר ללא לקוח מזוהה - ${voucherNumber}`,
        attachments,
        html: `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #f59e0b; padding-bottom: 20px; }
        h1 { color: #f59e0b; margin: 0; }
        .content { line-height: 1.8; color: #333; }
        .warning-box { background: #fef3c7; border-radius: 10px; padding: 20px; margin: 20px 0; border-right: 4px solid #f59e0b; }
        .info-box { background: #f0fdf4; border-radius: 10px; padding: 20px; margin: 20px 0; border-right: 4px solid #22c55e; }
        .info-box p, .warning-box p { margin: 8px 0; }
        .info-box strong { color: #166534; }
        .warning-box strong { color: #92400e; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9rem; }
        .action-note { background: #dbeafe; padding: 15px; border-radius: 10px; margin-top: 20px; color: #1e40af; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ שובר נוצר ללא לקוח מזוהה</h1>
        </div>
        <div class="content">
            <div class="warning-box">
                <p><strong>שים לב:</strong> התקבל תשלום והשובר נוצר במערכת, אך לא זוהה לקוח תואם.</p>
                <p>השובר <strong>לא נשלח</strong> לאף אחד.</p>
            </div>
            
            <div class="info-box">
                <p><strong>מספר שובר:</strong> ${voucherNumber}</p>
                <p><strong>סכום:</strong> ₪${amount}</p>
                <p><strong>שם המשלם:</strong> ${payerName || 'לא ידוע'}</p>
                <p><strong>מייל:</strong> ${payerEmail || 'לא ידוע'}</p>
                <p><strong>טלפון:</strong> ${payerPhone || 'לא ידוע'}</p>
                ${paymentReference ? `<p><strong>אסמכתא:</strong> ${paymentReference}</p>` : ''}
            </div>
            
            ${imageBuffer ? `
            <div style="text-align:center; margin: 25px 0;">
                <p style="color:#166534; font-weight:600; margin-bottom:15px;">השובר שנוצר:</p>
                <img src="cid:voucherImage" alt="שובר מתנה" style="max-width:100%; border-radius:10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            </div>
            ` : ''}
            
            <div class="action-note">
                <p><strong>מה לעשות?</strong></p>
                <p>1. היכנס למערכת הניהול וחפש את השובר לפי המספר</p>
                <p>2. עדכן את פרטי הלקוח/מקבל</p>
                <p>3. שלח את השובר ידנית מממשק הניהול</p>
            </div>
        </div>
        <div class="footer">
            <p>© ${new Date().getFullYear()} שפת המדבר - מערכת ניהול שוברים</p>
        </div>
    </div>
</body>
</html>`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Unmatched voucher notification sent to ${emails.join(', ')}`);
    } catch (error) {
        console.error('Error sending unmatched voucher notification:', error);
    }
}

module.exports = {
    sendVoucherEmail,
    sendPasswordResetEmail,
    sendAdminNotificationEmail,
    sendUnmatchedVoucherNotification
};
