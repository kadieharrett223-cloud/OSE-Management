-- Add profit column to price_list_items
-- Profit = sell_price - per_unit (final cost before multiplier markup)

ALTER TABLE price_list_items
  ADD COLUMN profit NUMERIC(12, 2);

-- Add comment to explain calculation
COMMENT ON COLUMN price_list_items.profit IS 'Profit per unit: sell_price - per_unit (cost before shipping and markup)';
