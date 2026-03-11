-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    google_id VARCHAR(255),
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    password_created BOOLEAN DEFAULT false,
    password_reset_required BOOLEAN DEFAULT false,
    receives_voucher_notifications BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    last_login TIMESTAMP
);

-- Add receives_voucher_notifications column if not exists (for migration)
ALTER TABLE users ADD COLUMN IF NOT EXISTS receives_voucher_notifications BOOLEAN DEFAULT false;

-- Vouchers table
CREATE TABLE IF NOT EXISTS vouchers (
    id SERIAL PRIMARY KEY,
    voucher_number VARCHAR(20) UNIQUE NOT NULL,
    original_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    remaining_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    customer_name VARCHAR(255),
    phone_number VARCHAR(20),
    email VARCHAR(255),
    purchase_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    voucher_image_url TEXT,
    greeting TEXT,
    buyer_name VARCHAR(255),
    buyer_phone VARCHAR(20),
    buyer_email VARCHAR(255),
    recipient_name VARCHAR(255),
    recipient_phone VARCHAR(20),
    product_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add product_name column if not exists (for migration)
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);

-- Add recipient_email column if not exists (for migration)
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    voucher_id INTEGER REFERENCES vouchers(id),
    voucher_number VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    product_name VARCHAR(255),
    buyer_first_name VARCHAR(255),
    buyer_last_name VARCHAR(255),
    buyer_phone VARCHAR(20),
    buyer_email VARCHAR(255),
    recipient_first_name VARCHAR(255),
    recipient_last_name VARCHAR(255),
    recipient_phone VARCHAR(20),
    greeting TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    payment_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Add product_name column if not exists (for migration)
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);

-- Add recipient_email column if not exists (for migration)
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255);

-- Voucher usage history
CREATE TABLE IF NOT EXISTS voucher_usage (
    id SERIAL PRIMARY KEY,
    voucher_id INTEGER REFERENCES vouchers(id),
    amount_used DECIMAL(10,2) NOT NULL,
    remaining_after DECIMAL(10,2) NOT NULL,
    used_by INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table for JWT refresh tokens
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial admin user
INSERT INTO users (email, name, role, is_active, password_created)
VALUES ('office@neriyabudraham.co.il', 'מנהל ראשי', 'admin', true, false)
ON CONFLICT (email) DO NOTHING;

-- Site settings table (for carousel, FAQ, etc.)
CREATE TABLE IF NOT EXISTS site_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default carousel images
INSERT INTO site_settings (setting_key, setting_value) VALUES
('carousel_images', '[
    {"url": "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/dbef79067_WhatsAppImage2025-09-01at214813.jpg", "alt": "קפה ומאפה"},
    {"url": "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/e5807747d_WhatsAppImage2025-09-01at215020.jpg", "alt": "ארוחת בוקר"},
    {"url": "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/abe928931_WhatsAppImage2025-09-01at220738.jpg", "alt": "שובר מתנה"}
]'::jsonb),
('faq_items', '[
    {"question": "מה כולל שובר המתנה?", "answer": "שובר המתנה ניתן למימוש בעגלת הקפה לכל סוגי המשקאות והמאפים, או לרכישת צמחים ועציצים במשתלה. השובר תקף לשנה מיום הרכישה."},
    {"question": "איך מממשים את השובר?", "answer": "פשוט מאוד! מגיעים לשפת המדבר, מציגים את השובר (דיגיטלי או מודפס) ונהנים. אפשר לממש בפעם אחת או בכמה פעמים עד גמר הסכום."},
    {"question": "האם אפשר לשלוח את השובר במתנה?", "answer": "בהחלט! בתהליך הרכישה תוכלו להוסיף ברכה אישית ולשלוח את השובר ישירות למקבל המתנה במייל או להוריד ולשלוח בעצמכם."},
    {"question": "מה קורה אם השובר לא נוצל במלואו?", "answer": "היתרה נשמרת! אפשר להשתמש בשובר מספר פעמים עד גמר הסכום. תוכלו תמיד לבדוק את היתרה באתר."}
]'::jsonb),
('admin_notification_email', '"netanelbar9@gmail.com"'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    image_url TEXT,
    payment_url TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_premium BOOLEAN DEFAULT false,
    icon VARCHAR(10) DEFAULT '🎁',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default products
INSERT INTO products (name, price, description, image_url, payment_url, display_order, icon) VALUES
('קפה מאפה זוגי + עציץ', 95, 'חוויה מושלמת של קפה טרי, מאפה טעים ועציץ יפהפה.', 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/dbef79067_WhatsAppImage2025-09-01at214813.jpg', 'https://meshulam.co.il/quick_payment?b=94d3052b31acdf125df594d1b61d9d06', 1, '☕'),
('ארוחת בוקר זוגית', 188, 'ארוחת בוקר מפנקת וטעימה לזוג מול הנוף הקסום.', 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/e5807747d_WhatsAppImage2025-09-01at215020.jpg', 'https://meshulam.co.il/quick_payment?b=94f3afb628451a34b6868895f1cef522', 2, '🍳'),
('שובר 100₪', 100, 'פינוק בעגלת הקפה ו/או צמחים יפים במשתלה בשווי 100₪', 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/abe928931_WhatsAppImage2025-09-01at220738.jpg', 'https://meshulam.co.il/quick_payment?b=e5cbd287b0610688a5dc413649649a40', 3, '🎁'),
('שובר 300₪', 300, 'פינוק משודרג בעגלת הקפה ו/או במשתלה בשווי 300₪', 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/38f50aafd_WhatsAppImage2025-09-01at220726.jpg', 'https://meshulam.co.il/quick_payment?b=bb441e5bf72a76ecb2be8498f7c43149', 4, '💎'),
('שובר 600₪', 600, 'השובר המושלם לחווייה כוללת בשפת המדבר', 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/81307b929_WhatsAppImage2025-09-01at220716.jpg', 'https://meshulam.co.il/quick_payment?b=7b3fdae2f87845522fd06fdd5a9c47e6', 5, '👑')
ON CONFLICT DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vouchers_number ON vouchers(voucher_number);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_purchases_voucher_number ON purchases(voucher_number);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
