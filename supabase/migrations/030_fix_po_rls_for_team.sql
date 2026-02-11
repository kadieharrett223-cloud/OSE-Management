-- Fix RLS policies to allow all users full access to POs

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Purchase orders: read for authenticated" ON purchase_orders;
DROP POLICY IF EXISTS "Purchase order lines: read for authenticated" ON purchase_order_lines;
DROP POLICY IF EXISTS "Purchase order payments: read for authenticated" ON purchase_order_payments;
DROP POLICY IF EXISTS "PO: read for authenticated" ON purchase_orders;
DROP POLICY IF EXISTS "PO: insert for authenticated" ON purchase_orders;
DROP POLICY IF EXISTS "PO: update for authenticated" ON purchase_orders;
DROP POLICY IF EXISTS "PO: delete for authenticated" ON purchase_orders;
DROP POLICY IF EXISTS "POL: read for authenticated" ON purchase_order_lines;
DROP POLICY IF EXISTS "POL: insert for authenticated" ON purchase_order_lines;
DROP POLICY IF EXISTS "POL: update for authenticated" ON purchase_order_lines;
DROP POLICY IF EXISTS "POL: delete for authenticated" ON purchase_order_lines;
DROP POLICY IF EXISTS "POP: read for authenticated" ON purchase_order_payments;
DROP POLICY IF EXISTS "POP: insert for authenticated" ON purchase_order_payments;
DROP POLICY IF EXISTS "POP: update for authenticated" ON purchase_order_payments;
DROP POLICY IF EXISTS "POP: delete for authenticated" ON purchase_order_payments;

-- Recreate with permissive policies allowing all users
-- Purchase Orders
CREATE POLICY "PO: allow all" ON purchase_orders
  FOR ALL USING (true) WITH CHECK (true);

-- Purchase Order Lines
CREATE POLICY "POL: allow all" ON purchase_order_lines
  FOR ALL USING (true) WITH CHECK (true);

-- Purchase Order Payments
CREATE POLICY "POP: allow all" ON purchase_order_payments
  FOR ALL USING (true) WITH CHECK (true);

-- Also allow all access to suppliers
DROP POLICY IF EXISTS "Suppliers: read for authenticated" ON suppliers;
DROP POLICY IF EXISTS "Suppliers: insert for authenticated" ON suppliers;
DROP POLICY IF EXISTS "Suppliers: update for authenticated" ON suppliers;

CREATE POLICY "Suppliers: allow all" ON suppliers
  FOR ALL USING (true) WITH CHECK (true);

-- Allow all access to price list items
DROP POLICY IF EXISTS "price_list_items: read for authenticated" ON price_list_items;
DROP POLICY IF EXISTS "price_list_items: insert for authenticated" ON price_list_items;
DROP POLICY IF EXISTS "price_list_items: update for authenticated" ON price_list_items;
DROP POLICY IF EXISTS "price_list_items: delete for authenticated" ON price_list_items;

CREATE POLICY "price_list_items: allow all" ON price_list_items
  FOR ALL USING (true) WITH CHECK (true);

-- Allow all access to price list categories
DROP POLICY IF EXISTS "price_list_categories: read for authenticated" ON price_list_categories;
DROP POLICY IF EXISTS "price_list_categories: insert for authenticated" ON price_list_categories;
DROP POLICY IF EXISTS "price_list_categories: update for authenticated" ON price_list_categories;
DROP POLICY IF EXISTS "price_list_categories: delete for authenticated" ON price_list_categories;

CREATE POLICY "price_list_categories: allow all" ON price_list_categories
  FOR ALL USING (true) WITH CHECK (true);
