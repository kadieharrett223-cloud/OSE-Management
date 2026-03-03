-- Move 4PML-95 to KATOOL/TARIFF EXEMPT category
-- First get the category ID for KATOOL/TARIFF EXEMPT
UPDATE price_list_items
SET category_id = (
  SELECT id FROM price_list_categories 
  WHERE category_name = 'KATOOL/TARIFF EXEMPT'
)
WHERE item_no = '4PML-95' 
  AND version_tag = 'v1'
  AND category_id != (SELECT id FROM price_list_categories WHERE category_name = 'KATOOL/TARIFF EXEMPT');
