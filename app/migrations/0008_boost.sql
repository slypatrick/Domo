-- Domo Boost: paid visibility + social media management for shops
CREATE TABLE IF NOT EXISTS boost_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pack TEXT,
  extras TEXT,
  note TEXT,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  admin_note TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  ends_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_boost_user ON boost_requests(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_boost_status ON boost_requests(status, created_at);
ALTER TABLE users ADD COLUMN featured_until INTEGER;
