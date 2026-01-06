-- Remove all role-based restrictions and make everything accessible to authenticated users

-- Drop existing policies that check for admin role
DROP POLICY IF EXISTS "price_list_items: read" ON price_list_items;
DROP POLICY IF EXISTS "price_list_items: insert" ON price_list_items;
DROP POLICY IF EXISTS "price_list_items: update" ON price_list_items;
DROP POLICY IF EXISTS "price_list_items: delete" ON price_list_items;

DROP POLICY IF EXISTS "invoices: read" ON invoices;
DROP POLICY IF EXISTS "invoices: insert" ON invoices;
DROP POLICY IF EXISTS "invoices: update" ON invoices;
DROP POLICY IF EXISTS "invoices: delete" ON invoices;

DROP POLICY IF EXISTS "invoice_lines: read" ON invoice_lines;
DROP POLICY IF EXISTS "invoice_lines: insert" ON invoice_lines;
DROP POLICY IF EXISTS "invoice_lines: update" ON invoice_lines;
DROP POLICY IF EXISTS "invoice_lines: delete" ON invoice_lines;

DROP POLICY IF EXISTS "commission_snapshots: read" ON commission_snapshots;
DROP POLICY IF EXISTS "commission_snapshots: insert" ON commission_snapshots;
DROP POLICY IF EXISTS "commission_snapshots: update" ON commission_snapshots;
DROP POLICY IF EXISTS "commission_snapshots: delete" ON commission_snapshots;

-- Create simple authenticated-only policies for all tables

-- price_list_items
CREATE POLICY "price_list_items: all for authenticated" ON price_list_items
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- price_list_categories
CREATE POLICY "price_list_categories: all for authenticated" ON price_list_categories
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- invoices
CREATE POLICY "invoices: all for authenticated" ON invoices
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- invoice_lines
CREATE POLICY "invoice_lines: all for authenticated" ON invoice_lines
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- commission_snapshots
CREATE POLICY "commission_snapshots: all for authenticated" ON commission_snapshots
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- wholesalers
DROP POLICY IF EXISTS "wholesalers: read for authenticated" ON wholesalers;
DROP POLICY IF EXISTS "wholesalers: insert for authenticated" ON wholesalers;
DROP POLICY IF EXISTS "wholesalers: update for authenticated" ON wholesalers;
DROP POLICY IF EXISTS "wholesalers: delete for authenticated" ON wholesalers;

CREATE POLICY "wholesalers: all for authenticated" ON wholesalers
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
