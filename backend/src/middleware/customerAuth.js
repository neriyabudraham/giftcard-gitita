const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

function generateCustomerToken(customer) {
    return jwt.sign(
        { id: customer.id, email: customer.email, type: 'customer' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

async function customerAuthMiddleware(req, res, next) {
    try {
        let token = null;
        if (req.headers.authorization?.startsWith('Bearer ')) {
            token = req.headers.authorization.substring(7);
        } else if (req.cookies?.customerToken) {
            token = req.cookies.customerToken;
        }

        if (!token) {
            return res.status(401).json({ error: true, message: 'לא מחובר' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch {
            return res.status(401).json({ error: true, message: 'טוקן לא תקין' });
        }

        if (decoded.type !== 'customer') {
            return res.status(401).json({ error: true, message: 'טוקן לא תקין' });
        }

        const result = await db.query(
            'SELECT id, first_name, last_name, email, phone, is_first_login, is_verified FROM customers WHERE id = $1',
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: true, message: 'לקוח לא נמצא' });
        }

        req.customer = result.rows[0];
        next();
    } catch (error) {
        console.error('Customer auth middleware error:', error);
        res.status(500).json({ error: true, message: 'שגיאת אימות' });
    }
}

module.exports = { generateCustomerToken, customerAuthMiddleware };
