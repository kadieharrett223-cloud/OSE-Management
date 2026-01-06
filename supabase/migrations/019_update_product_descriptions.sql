-- Update product descriptions to match detailed specifications
-- Also update weight information where available

-- Update 2PBP-8
UPDATE price_list_items
SET 
  description = 'Silver series 2 post base plate, 8,000 lb capacity, open carriage, dual point lock release, secondary lock, 110" post, 2 stage arms, 2 stage adjustable foot, 3.5" truck adapter set, All pullies, cables, and hoses to be factory installed, 110v 60hz 2.2kw, palletize power unit seperately',
  weight_lbs = 1200
WHERE item_no = '2PBP-8';

-- Update 2PBP-10
UPDATE price_list_items
SET 
  description = 'Silver series 2 post base plate, 8,000 lb capacity, open carriage, dual point lock release, secondary lock, 110" post, 2 stage arms, 2 stage adjustable foot, 3.5" truck adapter set, All pullies, cables, and hoses to be factory installed, 110v 60hz 2.2kw power unit, palletize power unit seperately',
  weight_lbs = 1380
WHERE item_no = '2PBP-10';

-- Insert/Update 2PBPXW-10 (Gold series)
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '2-POST LIFTS'),
  '2PBPXW-10',
  'Gold series 2 post base plate, 10,000 lb capacity, open carriage, single lock release, secondary lock, 110" H X 137" W, pullies, cables, and hoses to be factory installed, 3 stage arms, 3 stage adjustible foot, 3.5" truck adapter set, 110v 60hz 2.2kw power unit, palletize power unit seperately',
  NULL,
  1191.75,
  1380,
  82.00,
  41.00,
  125.00,
  1.85
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '2PBPXW-10' AND version_tag = '2025-04-25'
)
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert/Update 2PBP-12
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '2-POST LIFTS'),
  '2PBP-12',
  'Gold series 2 post base plate, 12,000 lb capacity, 115" H X 153" W, open carriage, single lock release, secondary lock, 115" x 156", pullies, cables, and hoses to be factory installed, 3 stage arms, 3 stage adjustible foot, 3.5" truck adapter set, 110v 60hz 2.2kw power unit, palletize power unit seperately',
  NULL,
  1341.75,
  1830,
  82.00,
  41.00,
  125.00,
  1.85
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '2PBP-12' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert/Update 2PCF-9
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '2-POST LIFTS'),
  '2PCF-9',
  'Silver Series 2 post clear floor, 9,000 lb capacity, 142" H X 129" W post, 2 stage arms, 2 stage foot, 2 lock release, open carriage, All pullies, cables, and hoses to be factory installed, secondary lock, 3.5" truck adapter set, 110v 60hz 3kw, Palletize power unit seperately',
  NULL,
  1102.50,
  1400,
  82.00,
  41.00,
  125.00,
  1.85
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '2PCF-9' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert/Update 2PCFXL-10
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '2-POST LIFTS'),
  '2PCFXL-10',
  'Gold Series 2 post clear floor, 10,000 lb capacity 153" H X 135" W, chain drive, 3 stage arms, 3 stage foot, single lock release, secondary lock, pullies, cables, and hoses to be factory installed, open carriage, 3.5" truck adapter set, 110v 60hz 2.2 kw, Palletize power unit seperately',
  NULL,
  1191.75,
  1595,
  82.00,
  41.00,
  125.00,
  1.85
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '2PCFXL-10' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert/Update 2PDDA-10
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '2-POST LIFTS'),
  '2PDDA-10',
  'Gold Series 2 post clear floor symmetric / asymmetric post 10,000 lb. capacity, 153" H X 145" W, direct drive, open carriage, 3 stage arms, 3 stage foot, single lock release, scondary lock, 3.5" truck- pullies, cables, and hoses to be factory installed, 3" truck adapter set, 110v 60hz 2.2 kw, palletize power unit seperately',
  NULL,
  1191.75,
  1565,
  82.00,
  41.00,
  125.00,
  1.85
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '2PDDA-10' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert/Update 2PCFHD-12
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '2-POST LIFTS'),
  '2PCFHD-12',
  'Gold Series 2 post clear floor car lift, 12,000 lb capacity, 174" x 156", open carriage, 3 stage arms, 3 stage foot, single lock release, 3 stage foot, single lock release, scondary lock, 3.5" truck- pullies, cables, and hoses to be factory installed, 3" truck adapter set, 110v 60hz 2.2 kw, palletize power unit seperately',
  NULL,
  1341.75,
  2085,
  82.00,
  41.00,
  125.00,
  1.85
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '2PCFHD-12' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert/Update 2PCFHD-15
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '2-POST LIFTS'),
  '2PCFHD-15',
  'Gold Series 2 post clear floor car lift, 12,000 lb capacity, 174" x 156", open carriage, 3 stage arms, 3 stage foot, single lock release, 3 stage foot, single lock release, scondary lock, 3.5" truck- pullies, cables, and hoses to be factory installed, 3" truck adapter set, 110v 60hz 3kw, palletize power unit seperately',
  NULL,
  1500.00,
  2550,
  82.00,
  41.00,
  125.00,
  1.85
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '2PCFHD-15' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Update 4PML-9 (was 4PO-9 in database)
UPDATE price_list_items
SET 
  description = 'Gold Series 4-post car storage lift 9,000 lb. capacity 108" W X 198" L, include tool tray, 3 drip trays, caster arms, drive through design, factory installed pullies, cables, and hoses, 110v 60hz 2.2kw, palletize tool tray and power unit seperately',
  weight_lbs = 1905
WHERE item_no = '4PO-9';

-- Insert HDMBL-9
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '4-POST LIFTS'),
  'HDMBL-9',
  'Gold Series 4-post car storage lift 9,000 lb. capacity 136.9" W X 198.49" L, sliding hitch rest, 3 drip trays, caster arms, adjustable width- runway, drive through design, factory installed pullies, cables, and hoses. 110v 60hz 2.2kw, palletize tool tray and power unit seperately',
  NULL,
  1504.00,
  1905,
  115.00,
  57.50,
  150.00,
  1.8
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = 'HDMBL-9' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert 4PHR-9X
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '4-POST LIFTS'),
  '4PHR-9X',
  'Gold Series 4 post High Rise Storage lift, 9,000 lb capacity, min 184" runways, min 87,67" drive through, min 78" storage space resting on top lock, tool tray, 3 drip trays, caster arms, pullies cables and hoses factory installed, 110v 60hz 2.2kw power, palletize tool tray and power unit seperately',
  NULL,
  1504.00,
  1716,
  115.00,
  57.50,
  150.00,
  1.8
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '4PHR-9X' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert 4PXW-10
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '4-POST LIFTS'),
  '4PXW-10',
  'Gold Series 4 post High Rise 2-car storage lift, portable, 10,000 lb capacity, 82" lifting height, 78" clearance resting on top lock, 208" W X 224" L, tool tray, 6 drip trays, caster arms, pullies, cables and hoses to be factory installed, 110v 60hz 2.2kw power units, palletize tool tray and power unit seperately',
  NULL,
  2000.00,
  3086,
  115.00,
  57.50,
  150.00,
  1.8
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '4PXW-10' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert 4PXL-10
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '4-POST LIFTS'),
  '4PXL-10',
  'The Dually Gold Series 4 post High Rise Storage lift, portable, 10,000 lb capacity, min 84" Storage on top lock, 112" drive through, 195" runways, tool tray, 4 drip trays, caster arms , 110v 60Hz 2.2kw - power units, Pullies, cables, and hoses factory installed, palletize tool tray and power unit seperately',
  NULL,
  1191.75,
  1760,
  115.00,
  57.50,
  150.00,
  1.8
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '4PXL-10' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert 4032XL
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '4-POST LIFTS'),
  '4032XL',
  'Gold Series 3-car stacking lift, 16,000 lb capacity, column height 174", overall width 113.7", overall length 229.4", lower platform 9,000 lb capacity, upper platform 7,000 lb capacity. Lower platform 82" rise, max lifting height 87.2" runway length 185.35", between the platforms 100". Upper platform max rise 151.4", runway length 199", max lifting height 156.5", distance between the columns 100". concrete anchors, Include concrete anchors, eight drip trays, steel ramps, Pullies, cables, and hoses factory installed, 220V 3KW 60 Hz PU. Include the power unit in the package',
  NULL,
  2500.00,
  3791,
  115.00,
  57.50,
  150.00,
  1.8
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '4032XL' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert 4PHDXL-12
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '4-POST LIFTS'),
  '4PHDXL-12',
  'Gold Series 4 post maintenance lift, 12,000 lb capacity, overall height 87.40", width, 132.40", length 245.47", runway length 196.85", between the posts 114.37", lifting height 70.86", runway width 21.6". Manual lock. Include tool tray, 3 drip trays, 220v 60hz 2.2kw power unit. Pullies, cables, and hoses factory installed, 220V 2.2KW 60 Hz PU. Palletize tool tray and power unit seperately.',
  NULL,
  2600.00,
  4000,
  115.00,
  57.50,
  150.00,
  1.8
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '4PHDXL-12' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert 4PHDXLA-14
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '4-POST LIFTS'),
  '4PHDXLA-14',
  'Gold Series 4 post alignment lift, 14,000 lb capacity, overall height 87.40", width 99.60", length 246.06", between the posts 116.65", drive through 99.60", runway width 21.65", runway length 196.85", air lock release, slip plates, turntables, tool tray. two air/hyddraulic bridge jack (packaged seperately), 220v 60hz 3kw power unit. Pullies, cables, and hoses factory installed. Please pack power unit with package',
  NULL,
  2600.00,
  4000,
  115.00,
  57.50,
  150.00,
  1.8
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '4PHDXLA-14' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert 4PHDXLA-11
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '4-POST LIFTS'),
  '4PHDXLA-11',
  'Gold Series 4 post open front alignment lift, 11,000 lb capacity, overall height 87.40", width 137.8", length 246.06", drive through 99.60" lifting height 70.86" runway length 196.85" runway width 21.65". air lock release, slip plates, turntables, two air/hyddraulic bridge jacks (packaged seperately) 220v 60Hz 2.2KW power unit, pullies- cables, and hoses factory installed. Please pack power unit and accessories with package',
  NULL,
  2200.00,
  3385,
  115.00,
  57.50,
  150.00,
  1.8
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '4PHDXLA-11' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert 4PHDXLA-15
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = '4-POST LIFTS'),
  '4PHDXLA-15',
  'Gold Series 4 post open front alignment lift, 15,000 lb capacity, overall height 87.40", width 137.8", length 246.06", drive through 99.60" lifting height 70.86" runway length 196.85" runway width 21.65". air lock release, slip plates, turntables, two air/hyddraulic bridge- jacks (packaged seperately) 220v 60Hz 3KW, power units, pullies- cables, and hoses factory installed. Please pack power unit and accessories with package',
  NULL,
  2700.00,
  4260,
  115.00,
  57.50,
  150.00,
  1.8
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '4PHDXLA-15' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert FRSL-78
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = 'Scissor Lifts'),
  'FRSL-78',
  'Ultra-thin Portable Full-Rise Scissor Lift 73" rise 7800 lb capacity, Overall width 81.3", length 80", minimum height 4.1", maximum lift height 72.8", 24V safety voltage control system, pneumatic release, 220v 2.2kw 60hz power unit',
  NULL,
  900.00,
  1311,
  100.00,
  50.00,
  125.00,
  1.8
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = 'FRSL-78' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert MRSL-75
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = 'Scissor Lifts'),
  'MRSL-75',
  'Portable Mid-rise scissor lift 30" rise, 7500 lb capacity, maximum height 39", minimum height 3.9", overall width 69.2", length 79.2" table width 33", mechanical lock, dual cylinders, pneumatic/ electric pump release, portable power cart, 110v 2.2kw 60hz power unit',
  NULL,
  1390.00,
  2000,
  100.00,
  50.00,
  125.00,
  1.8
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = 'MRSL-75' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert MRSL-6
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = 'Scissor Lifts'),
  'MRSL-6',
  'Portable Mid-Rise Scissor Lift, 6,000 capacity, overall width 72.3", min height 3.9", max lifting height 48.22", table length 70", table width 42.5", includes truck adapters, 2.2KW, 60Hz, power unit.',
  NULL,
  700.00,
  1000,
  100.00,
  50.00,
  125.00,
  1.8
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = 'MRSL-6' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description,
  weight_lbs = EXCLUDED.weight_lbs;

-- Insert HPU220 (power unit)
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = 'Accessories'),
  'HPU220',
  '220v 2.2kw 60hz power unit',
  NULL,
  120.00,
  NULL,
  20.00,
  10.00,
  30.00,
  2.0
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = 'HPU220' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description;

-- Insert HPU4 (power unit)
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = 'Accessories'),
  'HPU4',
  '220v 3kw 60hz power unit',
  NULL,
  115.00,
  NULL,
  20.00,
  10.00,
  30.00,
  2.0
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = 'HPU4' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description;

-- Insert 4PTA6 (truck adapters)
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = 'Accessories'),
  '4PTA6',
  '6" truck adapters, per piece',
  NULL,
  30.00,
  NULL,
  8.00,
  4.00,
  15.00,
  2.5
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = '4PTA6' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description;

-- Insert HLCJ-6 (bridge jack)
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = 'Accessories'),
  'HLCJ-6',
  '6,000 lb hand pump rolling bridge Jack',
  NULL,
  350.00,
  NULL,
  35.00,
  17.50,
  50.00,
  2.0
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = 'HLCJ-6' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description;

-- Insert HLCJ-14 (bridge jack)
INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, weight_lbs, ocean_frt, importing, zone5_shipping, multiplier)
SELECT 
  '2025-04-25',
  (SELECT id FROM price_list_categories WHERE category_name = 'Accessories'),
  'HLCJ-14',
  'Air / hydraulic rolling bridge Jack for 14K alignment lift',
  NULL,
  450.00,
  NULL,
  40.00,
  20.00,
  60.00,
  2.0
WHERE NOT EXISTS (
  SELECT 1 FROM price_list_items WHERE item_no = 'HLCJ-14' AND version_tag = '2025-04-25')
ON CONFLICT (item_no, version_tag) DO UPDATE
SET 
  description = EXCLUDED.description;