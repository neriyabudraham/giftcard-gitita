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

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Static files for admin panel
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// Routes
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/vouchers', vouchersRoutes);
app.use('/purchase', purchaseRoutes);
app.use('/purchases', purchaseRoutes);
app.use('/voucher', voucherRoutes);
app.use('/products', productsRoutes);

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
