-- Wsel schema: sellers and customers, orders, status history, two-sided reviews.

CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  role           TEXT NOT NULL CHECK (role IN ('seller', 'customer')),
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,              -- 8-digit Tunisian number, no country code
  pass           TEXT NOT NULL,              -- pbkdf2$iterations$salt$hash
  city           TEXT,
  shop           TEXT,                       -- sellers only
  settings       TEXT NOT NULL DEFAULT '{}', -- sellers: WhatsApp template, default fees
  phone_verified INTEGER NOT NULL DEFAULT 0, -- customers: proven by opening a WhatsApp order link
  created_at     INTEGER NOT NULL,
  UNIQUE (role, phone)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE orders (
  id          TEXT PRIMARY KEY,
  seller_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES users(id) ON DELETE SET NULL, -- set only for verified customers
  phone       TEXT NOT NULL,
  name        TEXT NOT NULL,
  gov         TEXT,
  addr        TEXT,
  items       TEXT NOT NULL,
  price       REAL NOT NULL,
  cost        REAL NOT NULL DEFAULT 0,
  courier     REAL NOT NULL DEFAULT 0,
  ret         REAL NOT NULL DEFAULT 0,
  src         TEXT,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'new'
              CHECK (status IN ('new','noanswer','confirmed','shipped','delivered','refused','cancelled')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  claim_token TEXT NOT NULL UNIQUE,          -- secret in the WhatsApp link sent to the customer
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_orders_seller   ON orders(seller_id, created_at DESC);
CREATE INDEX idx_orders_phone    ON orders(phone);
CREATE INDEX idx_orders_customer ON orders(customer_id);

CREATE TABLE order_events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status   TEXT NOT NULL,
  by_role  TEXT NOT NULL,  -- seller | customer
  at       INTEGER NOT NULL
);
CREATE INDEX idx_events_order ON order_events(order_id);

CREATE TABLE reviews (
  id         TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  author_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags       TEXT NOT NULL DEFAULT '[]',
  comment    TEXT,
  reply      TEXT,                 -- one public reply from the person reviewed
  reported   INTEGER NOT NULL DEFAULT 0,
  report_reason TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (order_id, author_id)
);
CREATE INDEX idx_reviews_target ON reviews(target_id, created_at DESC);
