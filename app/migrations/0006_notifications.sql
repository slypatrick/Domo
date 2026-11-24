-- Notification centre (bell) and Web Push subscriptions (Android, desktop, iOS home-screen app).

CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,          -- order | status | dispute | review | test
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  url        TEXT,
  read_at    INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE push_subs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  ua         TEXT,
  created_at INTEGER NOT NULL,
  last_ok    INTEGER
);
CREATE INDEX idx_push_user ON push_subs(user_id);
