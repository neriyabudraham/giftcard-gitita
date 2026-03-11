const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const vouchersRoutes = require('./routes/vouchers.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const voucherRoutes = require('./routes/voucher.routes');
const productsRoutes = require('./routes/products.routes');
const uploadRoutes = require('./routes/upload.routes');
const settingsRoutes = require('./routes/settings.routes');
const leadsRoutes = require('./routes/leads.routes');
const customerRoutes = require('./routes/customer.routes');

const db = require('./db');
const app = express();
const PORT = process.env.PORT || 3001;

// Run DB migrations on startup
async function runMigrations() {
    try {
        await db.query('ALTER TABLE purchases ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255)');
        await db.query('ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255)');
        await db.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)');
        await db.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(20),
                password_hash VARCHAR(255),
                temp_password VARCHAR(20),
                is_first_login BOOLEAN DEFAULT TRUE,
                is_verified BOOLEAN DEFAULT FALSE,
                verify_token VARCHAR(255),
                verify_token_expires TIMESTAMP,
                reset_token VARCHAR(255),
                reset_token_expires TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('DB migrations completed');
    } catch (err) {
        console.error('DB migration error:', err.message);
    }
}
runMigrations();

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Static files for admin panel with clean URLs
const adminPath = path.join(__dirname, '../public/admin');
const publicPath = path.join(__dirname, '../public');
const fs = require('fs');

// Admin middleware: auth guard + clean URL support
const PUBLIC_ADMIN_PATHS = new Set(['/login', '/create-password', '/reset-password']);

app.use('/admin', (req, res, next) => {
    let filePath = req.path;

    // Normalize trailing slash
    if (filePath.endsWith('/') && filePath !== '/') {
        filePath = filePath.slice(0, -1);
    }

    const hasExtension = !!path.extname(filePath);

    // Server-side auth check for HTML pages (not static assets, not public pages)
    if (!hasExtension && !PUBLIC_ADMIN_PATHS.has(filePath)) {
        const token = req.cookies?.token;
        let authenticated = false;
        if (token) {
            try {
                const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
                jwt.verify(token, secret);
                authenticated = true;
            } catch {}
        }
        if (!authenticated) {
            return res.redirect('/admin/login');
        }
    }

    // Serve clean URLs: /admin/foo → /admin/foo.html
    if (!hasExtension) {
        const htmlFile = filePath === '/' ? 'index.html' : filePath.slice(1) + '.html';
        const fullHtmlPath = path.join(adminPath, htmlFile);
        if (fs.existsSync(fullHtmlPath)) {
            return res.sendFile(fullHtmlPath);
        }
    }

    next();
});

app.use('/admin', express.static(adminPath));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve portal page at /portal
app.get('/portal', (req, res) => {
    res.sendFile(path.join(publicPath, 'portal.html'));
});

// Routes
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/vouchers', vouchersRoutes);
app.use('/purchase', purchaseRoutes);
app.use('/purchases', purchaseRoutes);
app.use('/voucher', voucherRoutes);
app.use('/products', productsRoutes);
app.use('/upload', uploadRoutes);
app.use('/settings', settingsRoutes);
app.use('/leads', leadsRoutes);
app.use('/customer', customerRoutes);

// Public config (exposes non-sensitive client-side config)
app.get('/config', (req, res) => {
    res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: true,
        message: err.message || 'שגיאה פנימית בשרת'
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
