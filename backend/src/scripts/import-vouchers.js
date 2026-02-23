const db = require('../db');

const csvData = `voucher_number,remaining_amount,original_amount,customer_name,phone_number,purchase_date,expiry_date,status,voucher_image_url
"6307832152026","95","95","ברכה  .","0547672678","29-12-2025","29-12-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_BiVD6FMzsm6eEdmATZ1v5spBZDUGDmViulX0sK26xBDJhNeQc4Ste3w8leZnoatg9uLkLvKKBorjg0iDOFS19.jpeg"
"6728623515804","0","95","עומרי .","0547672678","29-12-2025","29-12-2026","used","https://cdnj1.com/assets/1210166/inbox/0584254229/img_Yuodp5bykvxzYxN0rSmlT9goLutkfV8N8qIvhlfCNZMmCXopKFTtWMTQFTQusaAOO2AIm.jpeg"
"3630031435308","0","95","צבי יהודה .","0547672678","29-12-2025","29-12-2026","used","https://cdnj1.com/assets/1210166/inbox/0584254229/img_6lZBHpDYY9aaEmCCXjWLdlutH9bgSA21yqORzAqc3oDqGVftuNXdrbn8mtkkl5b3BzsUEzkSpAm7sODxmI8SkXK2s17Qsc.jpeg"
"2662971722752","95","95","אורלי .","0547672678","29-12-2025","29-12-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_8UFLvrGVrXMii9ag4n0dl69OGuyxrN7kkQPGeHYBMKmIHHbbTGVrPezseKudnGMO4OgaVPPKEYF.jpeg"
"3944767250486","95","95","תהל .","0547672678","29-12-2025","29-12-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_crWTGzMvDpd8Vz3z0cLqBaOHhsIMYpCXrxfsgyIFlCw9X7uHwb1JFycrxTkfFW70var07Ns.jpeg"
"7686250945645","188","188","אורי נעם","0507405556","29-12-2025","29-12-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_3aMi6WgN62nC99p8zBOH3dBZlcWawNLsAkBvyhGlShZwtVzx9WI.jpeg"
"7091550698156","0","300","אשר והדר  פרבר","0584536460","24-12-2025","24-12-2026","used","https://cdnj1.com/assets/1210166/inbox/0584254229/img_pq5CBX13HgBsyLwMWIfHeT80I9TTIBIYpbPsxtS5Ye7WUdlS15iCJuTyYGwqRWAPf4YQTwW8KCxErfa5VIpqNThULHD.jpeg"
"6669968033698","600","600","יואל שילה","0587929611","20-12-2025","20-12-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_z5ELv41I6Uvwurr0hhCifAyeZ5G9sp1i5MuVC6QoTjcXjjtj0k6wgo2MYrv.jpeg"
"1005697199675","0","300","צופיה ושגיב  ליכטמן","0509947573","20-12-2025","20-12-2026","used","https://cdnj1.com/assets/1210166/inbox/0584254229/img_yqxflBsM1KYLx8oIkKTo4xHMRTg7VF6OPf05bWDlSMJS1iLiO3MdjdsHdix5JXtXPZSZoCY4ABe1TndcSawAjnUIdNdFHpMaZb9y.jpeg"
"5809223677885","0","100","רחלי ואילון  וייס","0547878880","18-12-2025","18-12-2026","used","https://cdnj1.com/assets/1210166/inbox/0584254229/img_TgMvqssOf5tWa7Yx52pB7Awh2qQoiutRqMhhk7DaOpowdkpunwg.jpeg"
"6668750634428","100","100","ספיר .","0542411961","17-12-2025","17-12-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_GAt3WdD46QeTEn4fprAfPKeVThkWZGe9hDT3XqFJ9GrgseMM1h2CZPa.jpeg"
"2502793184742","113","600","יואל  שילה","0586484663","09-12-2025","09-12-2026","active",""
"0646815785497","95","95","יונתן ומרים  לאופר","0552668228","08-12-2025","08-12-2026","active",""
"5839268666087","0","188","יובל  גולדיס ","0556644305","08-12-2025","08-12-2026","used",""
"1629068729014","100","100","דיני שטרנברג","0523871479","20-11-2025","20-11-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_gpN49fW43yaCgLk4h70bfMENwZ5muqvYUn5ZNyXpkKWmJNaH2seyeDWs2wbt6z9xbI8ULm.jpeg"
"2044412381335","100","100","אופירה זק","0522224267","20-11-2025","20-11-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_edd5Fqr3RbOlp2GxWhe9CenDq8mxjOrFD78eiNfI7tH4aL8jCFVJ3P3i2pqieHLgy6xirXzArZJ2DcFr2MxC5Vc7pv.jpeg"
"5448071447419","100","100","לאבא ואמא האהובים","0584478826","10-11-2025","10-11-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_XNmzxhVDR0uC6UBWYE0MQ6WT3WyL5o4rd6w9Zm6jmUSinYYn1w7LKin7k.jpeg"
"5285465991040","100","100","אתי גולדשטיין","0525580536","22-10-2025","22-10-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_QYmBoyejIZo310VTKhxH8TcvCBrZ6qQuWLKFbfIC5grHYBeN2BhjCqyu3RfK4X7Jy.jpeg"
"6478336928706","100","100","ישראל  שטרית","0509223229","05-10-2025","05-10-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_QeSNb5wtwf6G4bJ1RG8CP3t7GKnAdzvkJUjHB7ChWYPOmIl6imWNCAuH42SG1xzMJDpr85ZCXzcixiBl08riF.jpeg"
"8771507037024","0","100","טליה דיקשטיין","0509223229","05-10-2025","05-10-2026","used","https://cdnj1.com/assets/1210166/inbox/0584254229/img_e4fzmh3NANcpyH73cQv1MixgYQcfthP37hbRFpLaCfFPxjKWiWaZiSoBCFv2Gy.jpeg"
"7038706477157","188","188","מרים  גרינברג","0509223229","05-10-2025","05-10-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_XiJx1nKl8VLF1lVl2W4EMhxXfywYmnamWGAJYVuMSdnIMKCRqgg2y0jkbLOQWLLtRmW3oEuDVV1Xw2mu.jpeg"
"9485317158423","100","100","תחיה כלף","0509223229","05-10-2025","05-10-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_nLjtpDLYzpciqo4x5oUQVj0kRQGpCF5liX91EVDpHwyi4re1ZU6XQy4FIZHLGmdywp3iDwuKC8Q4gZSznptf9nROdI4.jpeg"
"6624316757746","100","100","חנה  בן לולו","0509223229","05-10-2025","05-10-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_kBmQFRXcNIc2qdJdCeoBqkmHUNEqqToQBV5JWVMrzdphrONCq6TrX.jpeg"
"1478454961886","100","100","גפן כהן","0509223229","05-10-2025","05-10-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_CF3MKvptV8x5B8AQda2ZjGi0kFlyPnt93JlfVqIfju3EAaWzeeQ8XHpspQJsKul7s9YZSgf2WZ.jpeg"
"7367766043598","100","100","הודיה אחדות","0509223229","05-10-2025","05-10-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_83LCAbtlw5UUFVy0IDbciQN0653dRe3wcbHaOQeamKMWyoCFk1WAdfaKDRLGdI4ofIN965UdonnsIQ7s81udWomcvisnTfo.jpeg"
"6665083294294","100","100","דושי טמיר","0509223229","05-10-2025","05-10-2026","active","https://cdnj1.com/assets/1210166/inbox/0584254229/img_UTbfyUd5SOeThoTYO3JR6UNj8iaNJUAkEGSMf5rY9ycT1hDz9swPeTca5f6b3Btad1b.jpeg"
"2916048460965","95","95","רפאל ליבור","0542628887","15-09-2025","15-09-2026","active",""
"6256100686178","100","100","נתנאל בר","0556822072","15-09-2025","15-09-2026","active",""`;

function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Handle DD-MM-YYYY format
    const ddmmyyyy = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyy) {
        return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
    }
    
    // Handle YYYY-MM-DD format
    const yyyymmdd = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (yyyymmdd) {
        return dateStr;
    }
    
    // Handle ISO format
    if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
    }
    
    return dateStr;
}

async function importVouchers() {
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',');
    
    let imported = 0;
    let skipped = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/(".*?"|[^,]+)/g).map(v => v.replace(/^"|"$/g, ''));
        
        const voucher = {
            voucher_number: values[0],
            remaining_amount: parseFloat(values[1]) || 0,
            original_amount: parseFloat(values[2]) || 0,
            customer_name: values[3],
            phone_number: values[4],
            purchase_date: parseDate(values[5]),
            expiry_date: parseDate(values[6]),
            status: values[7] || 'active',
            voucher_image_url: values[8] || null
        };
        
        try {
            // Check if voucher already exists
            const existing = await db.query(
                'SELECT id FROM vouchers WHERE voucher_number = $1',
                [voucher.voucher_number]
            );
            
            if (existing.rows.length > 0) {
                console.log(`Skipping ${voucher.voucher_number} - already exists`);
                skipped++;
                continue;
            }
            
            await db.query(
                `INSERT INTO vouchers 
                 (voucher_number, remaining_amount, original_amount, customer_name, phone_number, 
                  purchase_date, expiry_date, status, voucher_image_url, recipient_name)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $4)`,
                [
                    voucher.voucher_number,
                    voucher.remaining_amount,
                    voucher.original_amount,
                    voucher.customer_name,
                    voucher.phone_number,
                    voucher.purchase_date,
                    voucher.expiry_date,
                    voucher.status,
                    voucher.voucher_image_url
                ]
            );
            
            console.log(`Imported: ${voucher.voucher_number} - ${voucher.customer_name}`);
            imported++;
            
        } catch (error) {
            console.error(`Error importing ${voucher.voucher_number}:`, error.message);
        }
    }
    
    console.log(`\nImport complete: ${imported} imported, ${skipped} skipped`);
    process.exit(0);
}

importVouchers().catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
});
