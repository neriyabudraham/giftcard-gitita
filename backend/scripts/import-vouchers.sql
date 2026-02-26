-- ייבוא שוברים מקובץ Voucher_export
-- כולל סטטוס מימוש ויתרות

INSERT INTO vouchers (voucher_number, original_amount, remaining_amount, customer_name, phone_number, purchase_date, expiry_date, status, voucher_image_url, created_at)
SELECT * FROM (VALUES
    ('6307832152026', 95, 95, 'ברכה .', '0547672678', '2025-12-29'::date, '2026-12-29'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_BiVD6FMzsm6eEdmATZ1v5spBZDUGDmViulX0sK26xBDJhNeQc4Ste3w8leZnoatg9uLkLvKKBorjg0iDOFS19.jpeg', '2025-12-29'::timestamp),
    ('6728623515804', 95, 0, 'עומרי .', '0547672678', '2025-12-29'::date, '2026-12-29'::date, 'used', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_Yuodp5bykvxzYxN0rSmlT9goLutkfV8N8qIvhlfCNZMmCXopKFTtWMTQFTQusaAOO2AIm.jpeg', '2025-12-29'::timestamp),
    ('3630031435308', 95, 0, 'צבי יהודה .', '0547672678', '2025-12-29'::date, '2026-12-29'::date, 'used', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_6lZBHpDYY9aaEmCCXjWLdlutH9bgSA21yqORzAqc3oDqGVftuNXdrbn8mtkkl5b3BzsUEzkSpAm7sODxmI8SkXK2s17Qsc.jpeg', '2025-12-29'::timestamp),
    ('2662971722752', 95, 95, 'אורלי .', '0547672678', '2025-12-29'::date, '2026-12-29'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_8UFLvrGVrXMii9ag4n0dl69OGuyxrN7kkQPGeHYBMKmIHHbbTGVrPezseKudnGMO4OgaVPPKEYF.jpeg', '2025-12-29'::timestamp),
    ('3944767250486', 95, 95, 'תהל .', '0547672678', '2025-12-29'::date, '2026-12-29'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_crWTGzMvDpd8Vz3z0cLqBaOHhsIMYpCXrxfsgyIFlCw9X7uHwb1JFycrxTkfFW70var07Ns.jpeg', '2025-12-29'::timestamp),
    ('7686250945645', 188, 188, 'אורי נעם', '0507405556', '2025-12-29'::date, '2026-12-29'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_3aMi6WgN62nC99p8zBOH3dBZlcWawNLsAkBvyhGlShZwtVzx9WI.jpeg', '2025-12-29'::timestamp),
    ('7091550698156', 300, 0, 'אשר והדר פרבר', '0584536460', '2025-12-24'::date, '2026-12-24'::date, 'used', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_pq5CBX13HgBsyLwMWIfHeT80I9TTIBIYpbPsxtS5Ye7WUdlS15iCJuTyYGwqRWAPf4YQTwW8KCxErfa5VIpqNThULHD.jpeg', '2025-12-24'::timestamp),
    ('6669968033698', 600, 600, 'יואל שילה', '0587929611', '2025-12-20'::date, '2026-12-20'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_z5ELv41I6Uvwurr0hhCifAyeZ5G9sp1i5MuVC6QoTjcXjjtj0k6wgo2MYrv.jpeg', '2025-12-20'::timestamp),
    ('1005697199675', 300, 0, 'צופיה ושגיב ליכטמן', '0509947573', '2025-12-20'::date, '2026-12-20'::date, 'used', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_yqxflBsM1KYLx8oIkKTo4xHMRTg7VF6OPf05bWDlSMJS1iLiO3MdjdsHdix5JXtXPZSZoCY4ABe1TndcSawAjnUIdNdFHpMaZb9y.jpeg', '2025-12-20'::timestamp),
    ('5809223677885', 100, 0, 'רחלי ואילון וייס', '0547878880', '2025-12-18'::date, '2026-12-18'::date, 'used', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_TgMvqssOf5tWa7Yx52pB7Awh2qQoiutRqMhhk7DaOpowdkpunwg.jpeg', '2025-12-18'::timestamp),
    ('6668750634428', 100, 100, 'ספיר .', '0542411961', '2025-12-17'::date, '2026-12-17'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_GAt3WdD46QeTEn4fprAfPKeVThkWZGe9hDT3XqFJ9GrgseMM1h2CZPa.jpeg', '2025-12-17'::timestamp),
    ('2502793184742', 600, 113, 'יואל שילה', '0586484663', '2025-12-09'::date, '2026-12-09'::date, 'active', '', '2025-12-09'::timestamp),
    ('0646815785497', 95, 95, 'יונתן ומרים לאופר', '0552668228', '2025-12-08'::date, '2026-12-08'::date, 'active', '', '2025-12-08'::timestamp),
    ('5839268666087', 188, 0, 'יובל גולדיס', '0556644305', '2025-12-08'::date, '2026-12-08'::date, 'used', '', '2025-12-08'::timestamp),
    ('1629068729014', 100, 100, 'דיני שטרנברג', '0523871479', '2025-11-20'::date, '2026-11-20'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_gpN49fW43yaCgLk4h70bfMENwZ5muqvYUn5ZNyXpkKWmJNaH2seyeDWs2wbt6z9xbI8ULm.jpeg', '2025-11-20'::timestamp),
    ('2044412381335', 100, 100, 'אופירה זק', '0522224267', '2025-11-20'::date, '2026-11-20'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_edd5Fqr3RbOlp2GxWhe9CenDq8mxjOrFD78eiNfI7tH4aL8jCFVJ3P3i2pqieHLgy6xirXzArZJ2DcFr2MxC5Vc7pv.jpeg', '2025-11-20'::timestamp),
    ('5448071447419', 100, 100, 'לאבא ואמא האהובים', '0584478826', '2025-11-10'::date, '2026-11-10'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_XNmzxhVDR0uC6UBWYE0MQ6WT3WyL5o4rd6w9Zm6jmUSinYYn1w7LKin7k.jpeg', '2025-11-10'::timestamp),
    ('5285465991040', 100, 100, 'אתי גולדשטיין', '0525580536', '2025-10-22'::date, '2026-10-22'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_QYmBoyejIZo310VTKhxH8TcvCBrZ6qQuWLKFbfIC5grHYBeN2BhjCqyu3RfK4X7Jy.jpeg', '2025-10-22'::timestamp),
    ('6478336928706', 100, 100, 'ישראל שטרית', '0502210503', '2025-10-05'::date, '2026-10-05'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_QeSNb5wtwf6G4bJ1RG8CP3t7GKnAdzvkJUjHB7ChWYPOmIl6imWNCAuH42SG1xzMJDpr85ZCXzcixiBl08riF.jpeg', '2025-10-05'::timestamp),
    ('8771507037024', 100, 0, 'טליה דיקשטיין', '0527710204', '2025-10-05'::date, '2026-10-05'::date, 'used', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_e4fzmh3NANcpyH73cQv1MixgYQcfthP37hbRFpLaCfFPxjKWiWaZiSoBCFv2Gy.jpeg', '2025-10-05'::timestamp),
    ('7038706477157', 188, 188, 'מרים גרינברג', '0508740143', '2025-10-05'::date, '2026-10-05'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_XiJx1nKl8VLF1lVl2W4EMhxXfywYmnamWGAJYVuMSdnIMKCRqgg2y0jkbLOQWLLtRmW3oEuDVV1Xw2mu.jpeg', '2025-10-05'::timestamp),
    ('9485317158423', 100, 100, 'תחיה כלף', '0508740143', '2025-10-05'::date, '2026-10-05'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_nLjtpDLYzpciqo4x5oUQVj0kRQGpCF5liX91EVDpHwyi4re1ZU6XQy4FIZHLGmdywp3iDwuKC8Q4gZSznptf9nROdI4.jpeg', '2025-10-05'::timestamp),
    ('6624316757746', 100, 100, 'חנה בן לולו', '0556668424', '2025-10-05'::date, '2026-10-05'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_kBmQFRXcNIc2qdJdCeoBqkmHUNEqqToQBV5JWVMrzdphrONCq6TrX.jpeg', '2025-10-05'::timestamp),
    ('7367766043598', 100, 100, 'הודיה אחדות', '0585586665', '2025-10-05'::date, '2026-10-05'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_83LCAbtlw5UUFVy0IDbciQN0653dRe3wcbHaOQeamKMWyoCFk1WAdfaKDRLGdI4ofIN965UdonnsIQ7s81udWomcvisnTfo.jpeg', '2025-10-05'::timestamp),
    ('1478454961886', 100, 100, 'גפן כהן', '0586277433', '2025-10-05'::date, '2026-10-05'::date, 'active', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_CF3MKvptV8x5B8AQda2ZjGi0kFlyPnt93JlfVqIfju3EAaWzeeQ8XHpspQJsKul7s9YZSgf2WZ.jpeg', '2025-10-05'::timestamp),
    ('6665083294294', 100, 0, 'דושי טמיר', '0508740143', '2025-10-05'::date, '2026-10-05'::date, 'used', 'https://cdnj1.com/assets/1210166/inbox/0584254229/img_UTbfyUd5SOeThoTYO3JR6UNj8iaNJUAkEGSMf5rY9ycT1hDz9swPeTca5f6b3Btad1b.jpeg', '2025-10-05'::timestamp),
    ('2916048460965', 95, 95, 'רפאל ליבור', '0542628887', '2025-09-15'::date, '2026-09-15'::date, 'active', '', '2025-09-15'::timestamp),
    ('6256100686178', 100, 100, 'נתנאל בר', '0556822072', '2025-09-15'::date, '2026-09-15'::date, 'active', '', '2025-09-15'::timestamp)
) AS t(voucher_number, original_amount, remaining_amount, customer_name, phone_number, purchase_date, expiry_date, status, voucher_image_url, created_at)
WHERE NOT EXISTS (SELECT 1 FROM vouchers v WHERE v.voucher_number = t.voucher_number);

-- עדכון סטטיסטיקות
SELECT 
    COUNT(*) as total_vouchers,
    COUNT(*) FILTER (WHERE status = 'active') as active_vouchers,
    COUNT(*) FILTER (WHERE status = 'used') as used_vouchers,
    SUM(remaining_amount) as total_remaining
FROM vouchers;
