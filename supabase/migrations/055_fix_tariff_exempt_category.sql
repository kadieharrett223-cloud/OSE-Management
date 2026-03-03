-- Fix: Properly insert the KATOOL/TARIFF EXEMPT category
-- First ensure the column exists
ALTER TABLE price_list_categories
ADD COLUMN IF NOT EXISTS tariff_exempt BOOLEAN NOT NULL DEFAULT FALSE;

-- Delete the incorrectly inserted category if it exists (in case partial insert)
DELETE FROM price_list_categories 
WHERE category_name = 'KATOOL/TARIFF EXEMPT';

-- Now insert it properly with explicit display_order
-- Find the max display_order and add 1
INSERT INTO price_list_categories (category_name, display_order, tariff_exempt)
VALUES (
  'KATOOL/TARIFF EXEMPT',
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM price_list_categories),
  TRUE
);
