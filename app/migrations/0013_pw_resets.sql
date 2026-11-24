CREATE TABLE IF NOT EXISTS pw_resets (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  token_hash TEXT,
  expires_at INTEGER,
  link_at INTEGER,
  used_at INTEGER
);
CREATE INDEX IF NOT EXISTS pw_resets_open ON pw_resets (used_at, created_at);
CREATE INDEX IF NOT EXISTS pw_resets_token ON pw_resets (token_hash);
