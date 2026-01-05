-- Temporary: Allow anonymous reads for testing
-- This allows the price list page to work before authentication is set up
-- Remove or restrict these policies once authentication is implemented

-- Allow anonymous reads on categories
CREATE POLICY "Categories: Allow anonymous reads" ON price_list_categories
  FOR SELECT USING (true);

-- Allow anonymous reads on price list items
CREATE POLICY "Price List: Allow anonymous reads" ON price_list_items
  FOR SELECT USING (true);

-- Note: Admin write operations still require authentication
-- This only enables read access for testing the UI
