const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const vouchersRoutes = require('./routes/vouchers.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const voucherRoutes = require('./routes/voucher.routes');
const productsRoutes = require('./routes/products.routes');
const uploadRoutes = require('./routes/upload.routes');
const settingsRoutes = require('./routes/settings.routes');
const leadsRoutes = require('./routes/leads.routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Static files for admin panel with clean URLs
const adminPath = path.join(__dirname, '../public/admin');
const fs = require('fs');

// Serve admin files without .html extension
app.use('/admin', (req, res, next) => {
    let filePath = req.path;
    
    // Remove trailing slash
    if (filePath.endsWith('/') && filePath !== '/') {
        filePath = filePath.slice(0, -1);
    }
    
    // Check if it's a directory or file without extension
    const fullPath = path.join(adminPath, filePath);
    const htmlPath = fullPath + '.html';
    
    // If no extension and .html file exists, serve it
    if (!path.extname(filePath) && fs.existsSync(htmlPath)) {
        return res.sendFile(htmlPath);
    }
    
    next();
});

app.use('/admin', express.static(adminPath));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
