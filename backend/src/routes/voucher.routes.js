const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

const VOUCHERS_DIR = path.join(__dirname, '../../vouchers');

router.get('/:voucherId/image', async (req, res, next) => {
    try {
        const { voucherId } = req.params;
        const imagePath = path.join(VOUCHERS_DIR, `${voucherId}.png`);

        // Check if file exists
        try {
            await fs.access(imagePath);
        } catch {
            return res.status(404).json({
                error: true,
                message: 'שובר לא נמצא'
            });
        }

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="voucher-${voucherId}.png"`);
        
        const imageBuffer = await fs.readFile(imagePath);
        res.send(imageBuffer);

    } catch (error) {
        next(error);
    }
});

module.exports = router;
