-- Product type (drives which details the seller fills in), details as JSON [[label, value], ...],
-- per-variant price/stock as JSON [{k:"size|color", price, stock}], and a discount (percent or amount, optional end date).
ALTER TABLE products ADD COLUMN kind TEXT;
ALTER TABLE products ADD COLUMN specs TEXT;
ALTER TABLE products ADD COLUMN variants TEXT;
ALTER TABLE products ADD COLUMN disc REAL;
ALTER TABLE products ADD COLUMN disc_type TEXT;
ALTER TABLE products ADD COLUMN disc_until INTEGER;
