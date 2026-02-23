const express = require('express');
const cors = require('cors');
const purchaseRoutes = require('./routes/purchase.routes');
const voucherRoutes = require('./routes/voucher.routes');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/purchase', purchaseRoutes);
app.use('/voucher', voucherRoutes);

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
