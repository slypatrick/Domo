-- Domo: one person, several spaces (buyer / seller / driver), profile settings,
-- badges, verified sellers, Domo delivery with dispatch, cash and payouts.

-- Buyer and seller profiles of the same person share a link_id (switch without logging in again).
ALTER TABLE users ADD COLUMN link_id TEXT;
ALTER TABLE users ADD COLUMN avatar TEXT;                       -- media key, profile photo
ALTER TABLE users ADD COLUMN prefs TEXT NOT NULL DEFAULT '{}';  -- notification categories, privacy, theme
ALTER TABLE users ADD COLUMN seller_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN seller_verified_at INTEGER;
ALTER TABLE users ADD COLUMN pickup TEXT;                       -- JSON {addr, gov, phone, notes} for Domo pickups
ALTER TABLE users ADD COLUMN badges TEXT;                       -- cached stats used to compute badges
ALTER TABLE users ADD COLUMN badges_at INTEGER;                 -- cache time; NULL = recompute
CREATE INDEX idx_users_link ON users(link_id);

-- Private documents (ID cards, business registration). Never served by /media.
CREATE TABLE docs (
  key        TEXT PRIMARY KEY,
  owner_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  data       BLOB NOT NULL,
  size       INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_docs_owner ON docs(owner_id);

CREATE TABLE verifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  legal_name  TEXT NOT NULL,
  doc_type    TEXT NOT NULL CHECK (doc_type IN ('cin', 'rne', 'patente')),
  doc_front   TEXT NOT NULL,
  doc_back    TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  note        TEXT,
  created_at  INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT
);
CREATE INDEX idx_verif_user ON verifications(user_id, created_at DESC);
CREATE INDEX idx_verif_status ON verifications(status, created_at);

-- Domo drivers: their own accounts and sessions (hired and dispatched by Domo).
CREATE TABLE drivers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL UNIQUE,
  pass       TEXT NOT NULL,
  city       TEXT,
  zones      TEXT,
  vehicle    TEXT,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
  available  INTEGER NOT NULL DEFAULT 0,
  prefs      TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  last_seen  INTEGER
);
CREATE TABLE driver_sessions (
  token_hash TEXT PRIMARY KEY,
  driver_id  TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_dsessions_driver ON driver_sessions(driver_id);
CREATE TABLE driver_push (
  id         TEXT PRIMARY KEY,
  driver_id  TEXT NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  ua         TEXT,
  created_at INTEGER NOT NULL,
  last_ok    INTEGER
);
CREATE INDEX idx_dpush_driver ON driver_push(driver_id);

-- Domo delivery on orders.
-- delivery: NULL | requested | assigned | picked | delivered | returning | returned
ALTER TABLE orders ADD COLUMN delivery TEXT;
ALTER TABLE orders ADD COLUMN driver_id TEXT;
ALTER TABLE orders ADD COLUMN delivery_fee REAL NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN delivery_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN delivery_note TEXT;
ALTER TABLE orders ADD COLUMN delivery_requested_at INTEGER;
ALTER TABLE orders ADD COLUMN delivery_assigned_at INTEGER;
ALTER TABLE orders ADD COLUMN picked_at INTEGER;
ALTER TABLE orders ADD COLUMN delivered_at INTEGER;
ALTER TABLE orders ADD COLUMN cash_collected REAL;
ALTER TABLE orders ADD COLUMN cash_settled_at INTEGER;
ALTER TABLE orders ADD COLUMN payout_at INTEGER;
CREATE INDEX idx_orders_delivery ON orders(delivery, delivery_requested_at);
CREATE INDEX idx_orders_driver ON orders(driver_id, delivery);
