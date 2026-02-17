-- Add note field to purchase_order_lines table
-- Notes can be added to individual line items without weight, price, or qty requirements

ALTER TABLE purchase_order_lines
ADD COLUMN IF NOT EXISTS note TEXT;
