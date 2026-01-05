-- Seed Initial Data for OSE Management
-- Run this after the main migration

-- Insert Sales Reps
INSERT INTO reps (rep_name, qbo_rep_code, commission_rate, is_active)
VALUES 
  ('Sarah Johnson', 'SJ', 0.05, true),
  ('Mike Chen', 'MC', 0.05, true),
  ('Jessica Martinez', 'JM', 0.05, true),
  ('James Wilson', 'JW', 0.05, true)
ON CONFLICT (rep_name) DO NOTHING;

-- Insert Price List Items
INSERT INTO price_list_items (sku, description, current_sale_price_per_unit, shipping_included_per_unit)
VALUES
  ('SKU-001', 'Widget A', 2599.00, 125.00),
  ('SKU-002', 'Widget B', 1499.00, 85.00),
  ('SKU-003', 'Gadget C', 3999.00, 200.00),
  ('SKU-004', 'Tool D', 899.00, 45.00),
  ('SKU-005', 'Kit E', 5499.00, 275.00)
ON CONFLICT (sku) DO NOTHING;

-- Note: To create an admin user:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add User" and create with email/password
-- 3. Copy the user UUID from the list
-- 4. Run this SQL with the actual UUID:
-- 
-- INSERT INTO users (id, email, role, rep_id)
-- VALUES ('YOUR_USER_UUID_HERE', 'admin@ose.com', 'admin', NULL);
--
-- For rep users, set rep_id to match a rep from the reps table
