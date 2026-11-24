-- Integrations: public tracking IDs, shop pages with a product catalogue, seller API keys.

ALTER TABLE orders ADD COLUMN ref TEXT;            -- public tracking ID, stored normalised e.g. WS7K3P9Q (shown WS-7K3P9Q)
ALTER TABLE orders ADD COLUMN external_id TEXT;    -- id from the seller's website / shop system
CREATE UNIQUE INDEX idx_orders_ref ON orders(ref);

ALTER TABLE users ADD COLUMN slug TEXT;            -- shop handle used in the public order link
ALTER TABLE users ADD COLUMN api_key_hash TEXT;    -- sha256 of the seller's API key
ALTER TABLE users ADD COLUMN api_key_hint TEXT;    -- last 4 characters, to recognise the key
CREATE UNIQUE INDEX idx_users_slug ON users(slug);

CREATE TABLE products (
  id         TEXT PRIMARY KEY,
  seller_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  price      REAL NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_products_seller ON products(seller_id, sort);

-- Backfill tracking IDs for orders created before this migration.
UPDATE orders SET ref = 'WS' || upper(substr(hex(randomblob(4)), 1, 6)) WHERE ref IS NULL;
