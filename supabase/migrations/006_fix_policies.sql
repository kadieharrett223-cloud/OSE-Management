-- Drop all existing policies on price list tables
DROP POLICY IF EXISTS "Categories: Admins can manage all" ON price_list_categories;
DROP POLICY IF EXISTS "Categories: Reps can view all" ON price_list_categories;
DROP POLICY IF EXISTS "Categories: Allow anonymous reads" ON price_list_categories;
DROP POLICY IF EXISTS "Price List: Admins can manage all" ON price_list_items;
DROP POLICY IF EXISTS "Price List: Reps can view all" ON price_list_items;
DROP POLICY IF EXISTS "Price List: Allow anonymous reads" ON price_list_items;

-- Disable RLS temporarily to recreate policies
ALTER TABLE price_list_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE price_list_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;

-- Create simple allow-all policies for testing
CREATE POLICY "Allow all for categories" ON price_list_categories
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for price list" ON price_list_items
  FOR ALL USING (true) WITH CHECK (true);
