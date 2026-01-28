-- Add Shopify product mapping fields to price_list_items
ALTER TABLE price_list_items
ADD COLUMN IF NOT EXISTS shopify_product_id TEXT,
ADD COLUMN IF NOT EXISTS shopify_variant_id TEXT,
ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS compare_at_price DECIMAL(10,2);

-- Add index for Shopify lookups
CREATE INDEX IF NOT EXISTS idx_price_list_shopify_variant 
ON price_list_items(shopify_variant_id) 
WHERE shopify_variant_id IS NOT NULL;

COMMENT ON COLUMN price_list_items.shopify_product_id IS 'Mapped Shopify product ID for price sync';
COMMENT ON COLUMN price_list_items.shopify_variant_id IS 'Mapped Shopify variant ID for price sync';
COMMENT ON COLUMN price_list_items.sale_price IS 'Current sale price (0 if no sale)';
COMMENT ON COLUMN price_list_items.compare_at_price IS 'Compare-at price (strike-through price)';
