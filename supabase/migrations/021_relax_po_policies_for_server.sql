-- Temporarily relax purchase order RLS to allow server (anon key) access
-- Note: Prefer setting SUPABASE_SERVICE_ROLE_KEY in .env and removing these.

-- Purchase orders: allow SELECT and INSERT for anon
DROP POLICY IF EXISTS "Purchase orders: read for anon" ON purchase_orders;
CREATE POLICY "Purchase orders: read for anon" ON purchase_orders
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Purchase orders: insert for anon" ON purchase_orders;
CREATE POLICY "Purchase orders: insert for anon" ON purchase_orders
  FOR INSERT TO anon
  WITH CHECK (true);

-- Purchase order lines: allow SELECT and INSERT for anon
DROP POLICY IF EXISTS "Purchase order lines: read for anon" ON purchase_order_lines;
CREATE POLICY "Purchase order lines: read for anon" ON purchase_order_lines
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Purchase order lines: insert for anon" ON purchase_order_lines;
CREATE POLICY "Purchase order lines: insert for anon" ON purchase_order_lines
  FOR INSERT TO anon
  WITH CHECK (true);

-- Purchase order payments: allow SELECT and INSERT for anon
DROP POLICY IF EXISTS "Purchase order payments: read for anon" ON purchase_order_payments;
CREATE POLICY "Purchase order payments: read for anon" ON purchase_order_payments
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Purchase order payments: insert for anon" ON purchase_order_payments;
CREATE POLICY "Purchase order payments: insert for anon" ON purchase_order_payments
  FOR INSERT TO anon
  WITH CHECK (true);
