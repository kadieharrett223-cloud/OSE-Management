-- Mark POs as Chinese supplier orders
ALTER TABLE purchase_orders
ADD COLUMN is_china_supplier BOOLEAN DEFAULT FALSE,
ADD COLUMN country TEXT DEFAULT 'USA';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_purchase_orders_is_china_supplier ON purchase_orders(is_china_supplier);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_country ON purchase_orders(country);
