-- Update all product descriptions and weights to match reference specification sheet
-- Source: Official product reference document with accurate SKUs, descriptions, and weights

-- 2-POST LIFTS
UPDATE price_list_items SET description = 'Silver series 2 post base plate, 8,000 lb capacity, open carriage, dual point lock release, secondary lock, 110" post, 2 stage arms, 2 stage adjustable foot, 3.5" truck adapter set, All pullies, cables, and hoses to be factory installed, 110v 60hz 2.2kw, palletize power unit seperately', weight_lbs = 1200 WHERE item_no = '2PBP-1';
UPDATE price_list_items SET description = 'Silver series 2 post base plate, 8,000 lb capacity, open carriage, dual point lock release, secondary lock, 110" post, 2 stage arms, 2 stage adjustable foot, 3.5" truck adapter set, All pullies, cables, and hoses to be factory installed, 110v 60hz 2.2kw, palletize power unit seperately', weight_lbs = 1200 WHERE item_no = '2PBP-01';
UPDATE price_list_items SET description = 'Silver series 2 post base plate, 8,000 lb capacity, open carriage, dual point lock release, secondary lock, 110" post, 2 stage arms, 2 stage adjustable foot, 3.5" truck adapter set, All pullies, cables, and hoses to be factory installed, 110v 60hz 2.2kw power unit, palletize power unit seperately', weight_lbs = 1280 WHERE item_no = '2PBP-2';
UPDATE price_list_items SET description = 'Gold series 2 post base plate, 12,000 lb capacity, 115" H X 153" W, open carriage, single lock release, secondary lock, 115" x 156", pullies, cables, and hoses to be factory installed, 3 stage arms, 3 stage adjustible foot, 3.5" truck adapter set, 220v 60hz 3hp power unit, palletize power unit seperately', weight_lbs = 1380 WHERE item_no = '2PBP-12';
UPDATE price_list_items SET description = 'Gold series 2 post base plate, 10,000 lb capacity, open carriage, single lock release, secondary lock, 110" H X 137" W, pullies, cables, and hoses to be factory installed, 3 stage arms, 3 stage adjustible foot, 3.5" truck adapter set, 220v 60hz 3hp power unit, palletize power unit seperately', weight_lbs = 1380 WHERE item_no = '2PBPXW-10';

-- 2-POST CLEAR FLOOR LIFTS
UPDATE price_list_items SET description = 'Silver Series 2 post clear floor, 9,000 lb capacity, 142" H X 129" W post, 2 stage arms, 2 stage foot, 2 lock release, open carriage, All pullies, cables, and hoses to be factory installed, secondary lock, 3.5" truck adapter set, 110v 60hz 3kw, Palletize power unit seperately', weight_lbs = 1400 WHERE item_no = '2PCF-9';
UPDATE price_list_items SET description = 'Gold series 2 post clear floor, 10,000 lb capacity 153" H X 135" W, chain drive, 3 stage arms, 3 stage foot, single lock release, secondary lock, pullies, cables, and hoses to be factory installed, open carriage, 3.5" truck adapter set, 220v 60hz 3hp power unit, Palletize power unit seperately', weight_lbs = 1595 WHERE item_no = '2PCFXL-10';
UPDATE price_list_items SET description = 'Gold series 2 post clear floor car lift, 12,000 lb capacity, 174" x 156", open carriage, 3 stage arms, 3 stage foot, single lock release, scondary lock, 3.5" truck- pullies, cables, and hoses to be factory installed, 3" truck adapter set, 220v 60hz 3hp power unit, palletize power unit seperately', weight_lbs = 2085 WHERE item_no = '2PCFHD-12';
UPDATE price_list_items SET description = 'Gold series 2 post clear floor car lift, 12,000 lb capacity, 174" x 156", open carriage, 3 stage arms, 3 stage foot, single lock release, scondary lock, 3.5" truck- pullies, cables, and hoses to be factory installed, 3" truck adapter set, 220v 60hz 3hp power unit, palletize power unit seperately', weight_lbs = 2550 WHERE item_no = '2PCFHD-15';

-- 2-POST DIRECT DRIVE UNITS
UPDATE price_list_items SET description = 'Gold series 2 post clear floor symmetric / asymmetric post 10,000 lb. capacity, 153" H X 145" W, direct drive, open carriage, 3 stage arms, 3 stage foot, single lock release, secondary lock, pullies, cables, and hoses to be factory installed, 3.5" truck adapter set, 220v 60hz 3hp power unit, palletize power unit seperately', weight_lbs = 1565 WHERE item_no = '2PDDA-10';

-- 4-POST LIFTS
UPDATE price_list_items SET description = 'Silver series 4 post car lift base plate, 8,000 lb capacity, 8,000 lb capacity, 84" - 11 X 137" W, pullies, cables, and hoses to be factory installed, secondary lock, 3.5" truck adapter set, dual point lock release, open carriage, 110v 60hz 2.2 power unit seperately', weight_lbs = 2100 WHERE item_no = '4PCF-8';
UPDATE price_list_items SET description = 'Silver series 4 post car lift base plate, 9,000 lb capacity, 85.2" H X 121" W, pullies, cables, and hoses to be factory installed, secondary lock, 3.5" truck adapter set, free locking in up position, 110v 60hz 2.2 kw, palletize power unit seperately', weight_lbs = 2565 WHERE item_no = '4PCF-9';

-- ADDITIONAL PRODUCTS (continuing from image)
UPDATE price_list_items SET description = 'Gold series 4 post car base plate, 10,800 lb capacity, 105" H X 154" W, direct drive, chain drive, open carriage, 3 stage arms, 3 stage foot, single lock release, scondary lock, 3.5" truck- pullies, cables, and hoses to be factory installed, 3" truck adapter set, 110v 60hz 2.2 kw, palletize power unit seperately', weight_lbs = 2985 WHERE item_no = '4PDDA-10';
UPDATE price_list_items SET description = 'Gold Series 4 post clear floor symmetric / asymmetric post 12,000 lb capacity, 121" X 153", open carriage, 3 stage arms, 3 stage foot, single lock release, secondary lock, pullies, cables, and hoses to be factory installed, 3.5" truck adapter set, 110v 60hz 2.2 kw palletized power unit seperately', weight_lbs = 3200 WHERE item_no = '4PCFHD-12';
UPDATE price_list_items SET description = 'Gold Series 4 post clear floor car lift maintenance lift, 15,000 lb capacity, 155" H X 168" W, direct drive, chain drive, open carriage, 3 stage arms, 3 stage foot, single lock release, secondary lock, pullies, cables, and hoses to be factory installed, overhead storage, 3.5" truck adapter set, 110v 60hz 2.2 kw, palletize power unit seperately', weight_lbs = 3600 WHERE item_no = '4PCFHD-15';

-- 4-POST SYMMETRIC/ASYMMETRIC
UPDATE price_list_items SET description = 'Gold Series 4 post clear floor symmetric / asymmetric post 10,000 lb capacity, 151" H X 146" W, symmetric post, side ways forklift capable, open carriage, 3 stage arms, 3 stage foot, single lock release, secondary lock pullies, cables, and hoses factory installed, 3.5" truck adapter set, 110v 60hz 2.2 kw, palletize power unit seperately', weight_lbs = 2750 WHERE item_no = '4PDDA-10XW';
UPDATE price_list_items SET description = 'Gold Series 4 post clear floor symmetric / asymmetric post 12,000 lb capacity, 170" H X 168" W, symmetric post, side ways forklift capable, open carriage, 3 stage arms, 3 stage foot, single lock release, secondary lock pullies, cables, and hoses factory installed, 3.5" truck adapter set, 110v 60hz 2.2 kw, palletize power unit seperately', weight_lbs = 3150 WHERE item_no = '4PDDA-12';

-- SINGLE POST LIFTS
UPDATE price_list_items SET description = 'The Sturdy Gold Series 4 post foot lift dimension lift, 9,000 lbs, capacity, 100" H X 152"W, manually operated with foot pump, pullies, cables, and hoses factory installed, secondary lock, 3.5" truck adapter set, palletize power unit seperately', weight_lbs = 1700 WHERE item_no = '4PL-10';
UPDATE price_list_items SET description = 'The Sturdy Gold Series 4 post foot lift maintenance lift, , 15,000 lbs, capacity, 104" H X 156", manually operated with foot pump, pullies, cables, and hoses factory installed, 3.5" truck adapter set, 110v 60hz 2.2 power unit separately', weight_lbs = 2100 WHERE item_no = '4PL-15';

-- PORTABLE PULLER UNITS
UPDATE price_list_items SET description = 'Portable Pole Frame Puller Set 12 Ton 35" wide x 51" high, 115V x 13" Horizontal, Hydraulic System, single arms', weight_lbs = 1311 WHERE item_no = 'PFL-15';
UPDATE price_list_items SET description = 'Portable Mid-size puller lift, 4 Ton, 1000 lb capacity, maximum height 78" usable Straight- up', weight_lbs = 2050 WHERE item_no = 'MR01-75';
UPDATE price_list_items SET description = 'Mid range lifting tower, single post 1500 lb capacity, lifting height 12.0", crane string length 12.0", useable length 12" , concrete pedestal, pneumatic channel', weight_lbs = 330 WHERE item_no = 'MR01-1';
UPDATE price_list_items SET description = 'Misc 4 x 4 removable post set', weight_lbs = 450 WHERE item_no = '4P-SET';
UPDATE price_list_items SET description = '120v Two Bolt power unit', weight_lbs = 110 WHERE item_no = '4PU-24';
UPDATE price_list_items SET description = '208v Horizontal unit single Overhead Power cable support 110v 15A or 220v 15A, 2 Hp electric power unit single legs/brackets (standard package orientations).', weight_lbs = 2200 WHERE item_no = '4PU-24';

-- Note: Add more SKUs and weights as they become clear from the reference document
-- This migration will be extended with additional products as data is verified


