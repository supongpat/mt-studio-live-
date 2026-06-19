-- ============================================
-- VRich Clone - Database Schema (PostgreSQL)
-- ============================================

-- เพจ Facebook ของแม่ค้าแต่ละคน (1 account ในระบบ อาจมีหลายเพจ)
CREATE TABLE pages (
    id              SERIAL PRIMARY KEY,
    facebook_page_id VARCHAR(64) UNIQUE NOT NULL,
    page_name       VARCHAR(255) NOT NULL,
    access_token    TEXT NOT NULL,          -- Page Access Token จาก Meta
    owner_user_id   INTEGER,                 -- ผูกกับเจ้าของระบบ (แม่ค้า)
    reminder_message TEXT DEFAULT 'กรุณาโอนยอดด้วยนะคะ',  -- ข้อความทวงยอด (แก้ได้)
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- สินค้า แต่ละตัวมี "รหัส CF" เช่น A01, B12
CREATE TABLE products (
    id              SERIAL PRIMARY KEY,
    page_id         INTEGER REFERENCES pages(id),
    code            VARCHAR(20) NOT NULL,    -- รหัสที่ลูกค้าพิมพ์ตอน CF เช่น A01
    name            VARCHAR(255) NOT NULL,
    price           NUMERIC(10,2) NOT NULL,
    stock_qty       INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (page_id, code)
);

-- ลูกค้า (ระบุจาก Facebook user id ของคนคอมเมนต์)
CREATE TABLE customers (
    id                  SERIAL PRIMARY KEY,
    facebook_user_id    VARCHAR(64) NOT NULL,
    page_id             INTEGER REFERENCES pages(id),
    display_name        VARCHAR(255),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (page_id, facebook_user_id)
);

-- บันทึกคอมเมนต์ดิบทุกตัวที่ระบบรับมา (เก็บไว้ตรวจสอบ/แก้บั๊ก)
CREATE TABLE comment_logs (
    id              BIGSERIAL PRIMARY KEY,
    page_id         INTEGER REFERENCES pages(id),
    fb_comment_id   VARCHAR(128) UNIQUE NOT NULL,
    fb_post_id      VARCHAR(128) NOT NULL,
    facebook_user_id VARCHAR(64) NOT NULL,
    raw_message     TEXT NOT NULL,
    matched_code    VARCHAR(20),             -- รหัสที่จับได้ (ถ้าจับไม่ได้ = NULL)
    is_order_created BOOLEAN DEFAULT FALSE,
    received_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ออเดอร์ (หัวบิล) — 1 ครั้งที่ CF = 1 ออเดอร์ (อาจมีหลายรายการ)
CREATE TABLE orders (
    id              BIGSERIAL PRIMARY KEY,
    page_id         INTEGER REFERENCES pages(id),
    customer_id     INTEGER REFERENCES customers(id),
    comment_log_id  BIGINT REFERENCES comment_logs(id),
    total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
    status          VARCHAR(20) DEFAULT 'pending', -- pending, paid, packed, shipped, cancelled
    slip_image_url  TEXT,
    paid_at         TIMESTAMPTZ,
    reminder_count  INTEGER DEFAULT 0,       -- ทวงไปแล้วกี่ครั้ง
    last_reminded_at TIMESTAMPTZ,            -- ทวงครั้งล่าสุดเมื่อไหร่
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- รายการสินค้าในออเดอร์ (1 ออเดอร์มีได้หลายแถว เช่น CF A01 C01 Z02 ทีเดียว)
CREATE TABLE order_items (
    id              BIGSERIAL PRIMARY KEY,
    order_id        BIGINT REFERENCES orders(id) ON DELETE CASCADE,
    product_id      INTEGER REFERENCES products(id),
    code            VARCHAR(20) NOT NULL,
    product_name    VARCHAR(255) NOT NULL,
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit_price      NUMERIC(10,2) NOT NULL
);

-- บัญชีรับเงินของร้าน (1 เพจ 1 บัญชี ตามที่ต้องการ)
CREATE TABLE bank_accounts (
    id              SERIAL PRIMARY KEY,
    page_id         INTEGER REFERENCES pages(id) UNIQUE,
    bank_name       VARCHAR(100) NOT NULL,   -- เช่น กสิกรไทย, ไทยพาณิชย์
    account_number  VARCHAR(30) NOT NULL,
    account_name    VARCHAR(255) NOT NULL,
    promptpay_id    VARCHAR(30),             -- เบอร์/เลขบัตรพร้อมเพย์ (ถ้ามี ใช้สร้าง QR)
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- index ที่ใช้บ่อยตอนไลฟ์ (lookup สต็อกไวๆ)
CREATE INDEX idx_products_page_code ON products(page_id, code);
CREATE INDEX idx_orders_page_status ON orders(page_id, status);
