-- Add tariff_exempt flag to price_list_categories
ALTER TABLE price_list_categories
ADD COLUMN IF NOT EXISTS tariff_exempt BOOLEAN NOT NULL DEFAULT FALSE;

-- Create the new "KATOOL/TARIFF EXEMPT" category
-- First, get the display_order after "4-POST LIFTS"
INSERT INTO price_list_categories (category_name, display_order, tariff_exempt)
SELECT 'KATOOL/TARIFF EXEMPT', COALESCE(MAX(display_order), 0) + 1, TRUE
FROM price_list_categories
WHERE category_name = '4-POST LIFTS'
ON CONFLICT (category_name) DO NOTHING;
