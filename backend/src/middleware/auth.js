const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

function generateToken(user, expiresIn = '24h') {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            role: user.role,
            name: user.name
        },
        JWT_SECRET,
        { expiresIn }
    );
}

function generateRefreshToken(user) {
    return jwt.sign(
        { id: user.id, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

async function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

async function authMiddleware(req, res, next) {
    try {
        // Check for token in cookie or Authorization header
        let token = req.cookies?.token;
        
        if (!token && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (!token) {
            return res.status(401).json({ error: true, message: 'לא מחובר' });
        }

        const decoded = await verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ error: true, message: 'טוקן לא תקין' });
        }

        // Get user from database
        const result = await db.query(
            'SELECT id, email, name, role, is_active, password_created, password_reset_required FROM users WHERE id = $1',
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: true, message: 'משתמש לא נמצא' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ error: true, message: 'משתמש לא פעיל' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: true, message: 'שגיאת אימות' });
    }
}

function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: true, message: 'גישה למנהלים בלבד' });
    }
    next();
}

module.exports = {
    generateToken,
    generateRefreshToken,
    verifyToken,
    authMiddleware,
    adminOnly,
    JWT_SECRET
};
