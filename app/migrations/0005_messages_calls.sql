-- In-app messaging between a customer and a seller, and in-app voice calls (WebRTC signalling).

CREATE TABLE conversations (
  id              TEXT PRIMARY KEY,
  seller_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      INTEGER NOT NULL,
  last_at         INTEGER NOT NULL,
  last_text       TEXT,
  seller_unread   INTEGER NOT NULL DEFAULT 0,
  customer_unread INTEGER NOT NULL DEFAULT 0,
  UNIQUE (seller_id, customer_id)
);
CREATE INDEX idx_conv_seller ON conversations(seller_id, last_at DESC);
CREATE INDEX idx_conv_customer ON conversations(customer_id, last_at DESC);

CREATE TABLE messages (
  id         TEXT PRIMARY KEY,
  conv_id    TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind       TEXT NOT NULL DEFAULT 'text',   -- text | order | call
  body       TEXT NOT NULL,
  meta       TEXT,                           -- JSON: order ref, call duration…
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_messages_conv ON messages(conv_id, created_at);

CREATE TABLE calls (
  id          TEXT PRIMARY KEY,
  conv_id     TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  caller_id   TEXT NOT NULL,
  callee_id   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'ringing', -- ringing | accepted | ended | declined | missed
  offer       TEXT,
  answer      TEXT,
  caller_ice  TEXT NOT NULL DEFAULT '[]',
  callee_ice  TEXT NOT NULL DEFAULT '[]',
  created_at  INTEGER NOT NULL,
  answered_at INTEGER,
  ended_at    INTEGER
);
CREATE INDEX idx_calls_callee ON calls(callee_id, status);
