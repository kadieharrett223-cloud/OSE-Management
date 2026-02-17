-- Add "note" product to price list
-- This is a special product for adding notes to purchase orders

INSERT INTO price_list_items (
  version_tag,
  category_id,
  item_no,
  description,
  supplier,
  fob_cost,
  quantity,
  ocean_frt,
  importing,
  zone5_shipping,
  multiplier,
  tariff_105,
  per_unit,
  cost_with_shipping,
  sell_price,
  rounded_normal_price,
  list_price,
  black_friday_price,
  rounded_sale_price
)
SELECT
  '2025-04-25',
  NULL,
  'note',
  'Sales Note',
  NULL,
  0,
  NULL,
  0,
  0,
  0,
  1.0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0
WHERE NOT EXISTS (SELECT 1 FROM price_list_items WHERE item_no = 'note')
ON CONFLICT DO NOTHING;
