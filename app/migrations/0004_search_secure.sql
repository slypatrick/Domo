-- Store search, short shareable store IDs, secure purchase (buyer protection) and disputes.

ALTER TABLE users ADD COLUMN store_code TEXT;          -- e.g. DY7K3P, shown DY-7K3P
CREATE UNIQUE INDEX idx_users_store_code ON users(store_code);

ALTER TABLE orders ADD COLUMN secure INTEGER NOT NULL DEFAULT 0;   -- buyer chose "Achat sécurisé"
ALTER TABLE orders ADD COLUMN secure_fee REAL NOT NULL DEFAULT 0;  -- fee included in price, owed to Wsel
ALTER TABLE orders ADD COLUMN dispute_status TEXT;      -- open | refunded | replaced | rejected
ALTER TABLE orders ADD COLUMN dispute_reason TEXT;
ALTER TABLE orders ADD COLUMN dispute_details TEXT;
ALTER TABLE orders ADD COLUMN dispute_note TEXT;        -- seller's answer
ALTER TABLE orders ADD COLUMN dispute_at INTEGER;
ALTER TABLE orders ADD COLUMN dispute_resolved_at INTEGER;
CREATE INDEX idx_orders_dispute ON orders(seller_id, dispute_status);
