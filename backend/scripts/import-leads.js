const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    user: process.env.POSTGRES_USER || 'giftcard',
    host: process.env.POSTGRES_HOST || 'postgres',
    database: process.env.POSTGRES_DB || 'giftcard_db',
    password: process.env.POSTGRES_PASSWORD || 'giftcard123',
    port: 5432,
});

// Parse CSV manually (simple parser for this format)
function parseCSV(content) {
    const lines = content.split('\n');
    const headers = parseCSVLine(lines[0]);
    const records = [];
    
    let i = 1;
    while (i < lines.length) {
        let line = lines[i];
        
        // Handle multi-line values (greeting field with newlines)
        while (i < lines.length - 1 && !isCompleteLine(line, headers.length)) {
            i++;
            line += '\n' + lines[i];
        }
        
        if (line.trim()) {
            const values = parseCSVLine(line);
            if (values.length >= headers.length) {
                const record = {};
                headers.forEach((header, index) => {
                    record[header] = values[index] || '';
                });
                records.push(record);
            }
        }
        i++;
    }
    
    return records;
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    
    return values;
}

function isCompleteLine(line, expectedFields) {
    const values = parseCSVLine(line);
    return values.length >= expectedFields;
}

async function importData() {
    const csvPath = process.argv[2] || '/data/Card_export.csv';
    
    console.log('קורא קובץ CSV:', csvPath);
    
    if (!fs.existsSync(csvPath)) {
        console.error('קובץ לא נמצא:', csvPath);
        process.exit(1);
    }
    
    const content = fs.readFileSync(csvPath, 'utf-8');
    const records = parseCSV(content);
    
    console.log(`נמצאו ${records.length} רשומות`);
    
    let customersCount = 0;
    let leadsCount = 0;
    let skippedCount = 0;
    
    for (const record of records) {
        try {
            // Skip empty records (no buyer info)
            if (!record.buyerEmail && !record.buyerPhone && !record.buyerFirstName) {
                skippedCount++;
                continue;
            }
            
            // Determine if customer (completed) or lead (pending)
            // Customer = has voucher_download_link OR whatsapp_sent is true
            const isCustomer = record.voucher_download_link || record.whatsapp_sent === 'true';
            const status = isCustomer ? 'completed' : 'pending';
            
            // Check if this voucher already exists
            const existingPurchase = await pool.query(
                'SELECT id FROM purchases WHERE voucher_number = $1',
                [record.voucherId]
            );
            
            if (existingPurchase.rows.length > 0) {
                console.log(`  - שובר ${record.voucherId} כבר קיים, מדלג`);
                skippedCount++;
                continue;
            }
            
            // Insert into purchases table
            const result = await pool.query(`
                INSERT INTO purchases 
                (voucher_number, amount, buyer_first_name, buyer_last_name, buyer_phone, buyer_email,
                 recipient_first_name, recipient_last_name, recipient_phone, greeting, status, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                ON CONFLICT DO NOTHING
                RETURNING id
            `, [
                record.voucherId,
                parseFloat(record.amount) || 0,
                record.buyerFirstName || '',
                record.buyerLastName || '',
                record.buyerPhone || '',
                record.buyerEmail || '',
                record.recipientFirstName || '',
                record.recipientLastName || '',
                record.recipientPhone || '',
                record.greeting || '',
                status,
                record.created_date ? new Date(record.created_date) : new Date()
            ]);
            
            if (result.rows.length > 0) {
                if (isCustomer) {
                    customersCount++;
                    console.log(`  ✓ לקוח: ${record.buyerFirstName} ${record.buyerLastName} - ${record.buyerEmail}`);
                } else {
                    leadsCount++;
                    console.log(`  ○ מתעניין: ${record.buyerFirstName} ${record.buyerLastName} - ${record.buyerEmail}`);
                }
            }
            
        } catch (error) {
            console.error(`שגיאה ברשומה ${record.voucherId}:`, error.message);
        }
    }
    
    console.log('\n========== סיכום ==========');
    console.log(`לקוחות חדשים: ${customersCount}`);
    console.log(`מתעניינים חדשים: ${leadsCount}`);
    console.log(`דילוגים (ריקים/קיימים): ${skippedCount}`);
    console.log('============================\n');
    
    await pool.end();
}

importData().catch(err => {
    console.error('שגיאה:', err);
    process.exit(1);
});
