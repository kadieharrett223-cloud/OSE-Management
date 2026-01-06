-- Add INSERT, UPDATE, and DELETE policies for purchase orders

-- Purchase orders: allow insert for authenticated users
CREATE POLICY "Purchase orders: insert for authenticated" ON purchase_orders
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Purchase orders: allow update for authenticated users
CREATE POLICY "Purchase orders: update for authenticated" ON purchase_orders
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Purchase orders: allow delete for authenticated users
CREATE POLICY "Purchase orders: delete for authenticated" ON purchase_orders
  FOR DELETE USING (auth.role() = 'authenticated');

-- Purchase order lines: allow insert for authenticated users
CREATE POLICY "Purchase order lines: insert for authenticated" ON purchase_order_lines
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Purchase order lines: allow update for authenticated users
CREATE POLICY "Purchase order lines: update for authenticated" ON purchase_order_lines
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Purchase order lines: allow delete for authenticated users
CREATE POLICY "Purchase order lines: delete for authenticated" ON purchase_order_lines
  FOR DELETE USING (auth.role() = 'authenticated');

-- Purchase order payments: allow insert for authenticated users
CREATE POLICY "Purchase order payments: insert for authenticated" ON purchase_order_payments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Purchase order payments: allow update for authenticated users
CREATE POLICY "Purchase order payments: update for authenticated" ON purchase_order_payments
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Purchase order payments: allow delete for authenticated users
CREATE POLICY "Purchase order payments: delete for authenticated" ON purchase_order_payments
  FOR DELETE USING (auth.role() = 'authenticated');
