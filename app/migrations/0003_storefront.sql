-- Storefronts: shop cover, logo and bio; product photos, categories and descriptions.
-- Image columns hold R2 object keys (u/<seller id>/<random>.webp), served at /media/<key>.

ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN cover TEXT;
ALTER TABLE users ADD COLUMN logo TEXT;

ALTER TABLE products ADD COLUMN image TEXT;
ALTER TABLE products ADD COLUMN category TEXT;
ALTER TABLE products ADD COLUMN description TEXT;
CREATE INDEX idx_products_category ON products(seller_id, category);

-- Image storage used until an R2 bucket is bound as MEDIA (then new uploads go to R2).
CREATE TABLE media (
  key        TEXT PRIMARY KEY,
  owner_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  data       BLOB NOT NULL,
  size       INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_media_owner ON media(owner_id);
