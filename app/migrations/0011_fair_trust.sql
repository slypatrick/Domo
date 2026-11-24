-- Fair trust: every failed delivery carries a cause; only refusals by the customer count, and customers can contest them.
ALTER TABLE orders ADD COLUMN fail_cause TEXT;
ALTER TABLE orders ADD COLUMN fail_contest TEXT;
ALTER TABLE orders ADD COLUMN fail_contest_note TEXT;
ALTER TABLE orders ADD COLUMN fail_contest_at INTEGER;
ALTER TABLE orders ADD COLUMN idem TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idem ON orders(seller_id, idem) WHERE idem IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_contest ON orders(fail_contest, fail_contest_at);
