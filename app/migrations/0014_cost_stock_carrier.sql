-- Product purchase cost (private to the seller) and optional stock; courier name and tracking number on orders.
ALTER TABLE products ADD COLUMN cost REAL;
ALTER TABLE products ADD COLUMN stock INTEGER;
ALTER TABLE orders ADD COLUMN carrier TEXT;
ALTER TABLE orders ADD COLUMN carrier_ref TEXT;
