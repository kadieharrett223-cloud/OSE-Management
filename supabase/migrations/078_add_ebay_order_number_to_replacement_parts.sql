-- Add optional eBay order number to replacement parts records

ALTER TABLE replacement_parts
ADD COLUMN IF NOT EXISTS ebay_order_number TEXT;

CREATE INDEX IF NOT EXISTS idx_replacement_parts_ebay_order_number
  ON replacement_parts(ebay_order_number);
