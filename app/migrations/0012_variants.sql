-- Product options buyers pick by tapping (sizes, colours), stored as JSON arrays.
ALTER TABLE products ADD COLUMN sizes TEXT;
ALTER TABLE products ADD COLUMN colors TEXT;
