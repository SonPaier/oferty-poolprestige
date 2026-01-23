-- Add column for storing extracted HEX color from product images
ALTER TABLE products ADD COLUMN IF NOT EXISTS extracted_hex text;