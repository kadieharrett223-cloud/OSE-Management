-- Add internal notes column to purchase orders
ALTER TABLE purchase_orders 
ADD COLUMN internal_notes TEXT;

-- Create index for searching internal notes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_internal_notes ON purchase_orders USING GIN(to_tsvector('english', internal_notes));

-- Update RLS to allow internal notes to be updated
CREATE POLICY "Purchase orders: update internal_notes for authenticated" ON purchase_orders
  FOR UPDATE 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
