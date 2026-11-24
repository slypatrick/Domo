-- Delivery map: exact positions shared by customers, and a cache of geocoded addresses.
ALTER TABLE orders ADD COLUMN lat REAL;
ALTER TABLE orders ADD COLUMN lng REAL;
ALTER TABLE orders ADD COLUMN loc_src TEXT;
CREATE TABLE IF NOT EXISTS geocache (q TEXT PRIMARY KEY, lat REAL, lng REAL, at INTEGER NOT NULL);
