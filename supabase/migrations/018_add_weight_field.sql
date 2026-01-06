-- Add weight field to price_list_items and purchase_order_lines tables

-- Add weight to price_list_items
ALTER TABLE price_list_items 
ADD COLUMN IF NOT EXISTS weight_lbs NUMERIC(10, 2);

COMMENT ON COLUMN price_list_items.weight_lbs IS 'Product weight in pounds';

-- Add weight to purchase_order_lines
ALTER TABLE purchase_order_lines 
ADD COLUMN IF NOT EXISTS weight_lbs NUMERIC(10, 2);

COMMENT ON COLUMN purchase_order_lines.weight_lbs IS 'Unit weight in pounds';
