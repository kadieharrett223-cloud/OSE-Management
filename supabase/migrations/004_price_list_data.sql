-- Price List Data Import
-- OLYMPIC EQUIPMENT REVISED PRICELIST (4-25)
-- Run this after 003_enhanced_price_list.sql

-- Get category IDs for reference
DO $$
DECLARE
  cat_2post UUID;
  cat_2post_acc UUID;
  cat_4post UUID;
  cat_scissor UUID;
  cat_tire UUID;
  cat_balancer UUID;
  cat_alignment UUID;
  cat_shop UUID;
  cat_motorcycle UUID;
  cat_bundles UUID;
  cat_accessories UUID;
BEGIN
  SELECT id INTO cat_2post FROM price_list_categories WHERE category_name = '2-POST LIFTS';
  SELECT id INTO cat_2post_acc FROM price_list_categories WHERE category_name = '2 Post Accessories';
  SELECT id INTO cat_4post FROM price_list_categories WHERE category_name = '4-POST LIFTS';
  SELECT id INTO cat_scissor FROM price_list_categories WHERE category_name = 'Scissor Lifts';
  SELECT id INTO cat_tire FROM price_list_categories WHERE category_name = 'Tire Machines';
  SELECT id INTO cat_balancer FROM price_list_categories WHERE category_name = 'Wheel Balancers';
  SELECT id INTO cat_alignment FROM price_list_categories WHERE category_name = 'Alignment Machines';
  SELECT id INTO cat_shop FROM price_list_categories WHERE category_name = 'Shop Equipment';
  SELECT id INTO cat_motorcycle FROM price_list_categories WHERE category_name = 'Motorcycle Lifts';
  SELECT id INTO cat_bundles FROM price_list_categories WHERE category_name = 'Bundles';
  SELECT id INTO cat_accessories FROM price_list_categories WHERE category_name = 'Accessories';

  -- 2-POST LIFTS
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_2post, '2PBP-8', '8,000 lb 2 Post lift plate', NULL, 1054.75, NULL, 82.00, 41.00, 125.00, 1.85),
  ('2025-04-25', cat_2post, '2PBP-9', '9,000 lb 2 Post lift plate', NULL, 1102.50, NULL, 82.00, 41.00, 125.00, 1.85),
  ('2025-04-25', cat_2post, '2PBP-10', '10,000 lb 2 Post clear floor plate', NULL, 1191.75, NULL, 82.00, 41.00, 125.00, 1.85),
  ('2025-04-25', cat_2post, '2PBS-9', '9,000 lb 2 Post Symmetric lift plate', NULL, 1102.50, NULL, 82.00, 41.00, 125.00, 1.85),
  ('2025-04-25', cat_2post, '2PBS-10', '10,000 lb 2 Post Symmetric lift plate', NULL, 1191.75, NULL, 82.00, 41.00, 125.00, 1.85),
  ('2025-04-25', cat_2post, '2PBS-11', '11,000 lb 2 Post Symmetric lift plate', NULL, 1282.50, NULL, 82.00, 41.00, 125.00, 1.85),
  ('2025-04-25', cat_2post, '2PBS-12', '12,000 lb 2 Post Symmetric lift plate', NULL, 1341.75, NULL, 82.00, 41.00, 125.00, 1.85);

  -- 2Post Accessories
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_2post_acc, 'OPT-1', '18" adapter set (4 piece set)', NULL, 145.00, NULL, 50.00, 25.00, 20.00, 2.0),
  ('2025-04-25', cat_2post_acc, 'OPT-2', '24" adapter set (4 piece set)', NULL, 170.00, NULL, 50.00, 25.00, 20.00, 2.0),
  ('2025-04-25', cat_2post_acc, 'OPT-3', '2 P.C. Truck Adapter set (2 piece set)', NULL, 265.00, NULL, 50.00, 25.00, 20.00, 2.0),
  ('2025-04-25', cat_2post_acc, 'OPT-4', '3 P.C. Truck Adapter set (3 piece set)', NULL, 365.00, NULL, 50.00, 25.00, 20.00, 2.0);

  -- 4-POST LIFTS
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_4post, '4PO-8-HD', '8,000 lb 4 post w/casters', NULL, 1431.75, NULL, 115.00, 57.50, 150.00, 1.8),
  ('2025-04-25', cat_4post, '4PO-9', '9,000 lb 4 post w/casters', NULL, 1504.00, NULL, 115.00, 57.50, 150.00, 1.8),
  ('2025-04-25', cat_4post, '4PO-11', '11,000 lb 4 post', NULL, 1641.50, NULL, 115.00, 57.50, 150.00, 1.8),
  ('2025-04-25', cat_4post, '4PO-14', '14,000 lb 4 post', NULL, 1811.00, NULL, 115.00, 57.50, 150.00, 1.8),
  ('2025-04-25', cat_4post, '4POED-14', '14,000 lb Extra Long (New!)', NULL, 1982.00, NULL, 115.00, 57.50, 150.00, 1.8),
  ('2025-04-25', cat_4post, '4POA-14', '14,000 lb 4 post 100" longer Open Front (Alignment)', NULL, 2079.00, NULL, 115.00, 57.50, 150.00, 1.8),
  ('2025-04-25', cat_4post, '4POAL-14', '14,000 lb 4 post 100" longer Open Front Close (Alignment)', NULL, 2095.00, NULL, 115.00, 57.50, 150.00, 1.8),
  ('2025-04-25', cat_4post, '4PO-17', '17,000 lb 4 post', NULL, 2104.50, NULL, 115.00, 57.50, 150.00, 1.8),
  ('2025-04-25', cat_4post, '4PODJ-14', '14,000 lb 4 post Deluxe jack', NULL, 1910.00, NULL, 115.00, 57.50, 150.00, 1.8),
  ('2025-04-25', cat_4post, '4PSTDA-8', '8000LB 4 POST STORAGE LIFT', NULL, 970.00, NULL, 85.00, 42.50, 125.00, 1.8),
  ('2025-04-25', cat_4post, '4PSTD-7', '7,000 lb 4 post storage lift', NULL, 904.00, NULL, 85.00, 42.50, 125.00, 1.8),
  ('2025-04-25', cat_4post, '4PSTD-8', '8,000 lb 4 post storage lift', NULL, 970.00, NULL, 85.00, 42.50, 125.00, 1.8),
  ('2025-04-25', cat_4post, '4PSTD-9', '9,000 lb 4 post storage lift', NULL, 1023.00, NULL, 85.00, 42.50, 125.00, 1.8),
  ('2025-04-25', cat_4post, '4PSTDW-9', '9,000 lb 4 post storage wide', NULL, 1089.00, NULL, 85.00, 42.50, 125.00, 1.8),
  ('2025-04-25', cat_4post, '4PODJ-17', '17,000 lb 4 post Deluxe jack', NULL, 2260.00, NULL, 115.00, 57.50, 150.00, 1.8),
  ('2025-04-25', cat_4post, '4POED-17', '17,000 lb 4 post Extra Long', NULL, 2260.00, NULL, 115.00, 57.50, 150.00, 1.8);

  -- 4Post Accessories
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_4post, '4POJ-5', 'ROLL BL ADAPTER - 16" ROLLING CENTER LIFT', NULL, 1200.00, NULL, 85.00, 42.50, 125.00, 1.8),
  ('2025-04-25', cat_4post, '4POJ-6', 'Center LIft jacking Capacity 6,600 lbs', NULL, 850.00, NULL, 85.00, 42.50, 125.00, 1.8),
  ('2025-04-25', cat_4post, '4POJ-8', 'CENTER LIFT FOR 4 POST LIFT 8,000 lbs', NULL, 975.00, NULL, 85.00, 42.50, 125.00, 1.8);

  -- Scissor Lifts
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_scissor, 'SCM-6-AS', 'MR. 6,000 lb single scissor lift w/cab kit', NULL, 1390.00, NULL, 100.00, 50.00, 125.00, 1.8),
  ('2025-04-25', cat_scissor, 'SCM-6-AL', 'MR. 6,000 lb single scissor lift w/cab kit long', NULL, 1475.00, NULL, 100.00, 50.00, 125.00, 1.8),
  ('2025-04-25', cat_scissor, 'SCM-6-AS-DKWON', 'MR. 6,000 lb extended w/ MOBILE JACK 3 TON', NULL, 1625.00, NULL, 100.00, 50.00, 125.00, 1.8),
  ('2025-04-25', cat_scissor, 'SCE-6-AS', '6,000 lb Economy package (includes cab jacks)', NULL, 1279.00, NULL, 100.00, 50.00, 125.00, 1.8),
  ('2025-04-25', cat_scissor, 'SCMW-7-AE', 'Mobile electric scissor lift 7,000 lb', NULL, 1690.00, NULL, 100.00, 50.00, 125.00, 1.8),
  ('2025-04-25', cat_scissor, 'SCMW-7-AS', 'Mobile scissor lift 7,000 lb', NULL, 1390.00, NULL, 100.00, 50.00, 125.00, 1.8);

  -- Tire Machines
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_tire, 'TM900-24-26', 'Tire Machine 900, dual assist arm', NULL, 995.00, NULL, 85.00, 42.50, 75.00, 2.0),
  ('2025-04-25', cat_tire, 'TM1000-26', 'Tire Machine 1000, dual assist arm 26" assist', NULL, 1150.00, NULL, 85.00, 42.50, 75.00, 2.0),
  ('2025-04-25', cat_tire, 'TM-LT24', 'Lever-Less Tire machine', NULL, 1275.00, NULL, 85.00, 42.50, 75.00, 2.0);

  -- Wheel Balancers
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_balancer, 'WB-200', 'Auto digital balancer 24" wheel', NULL, 685.00, NULL, 60.00, 30.00, 65.00, 2.0),
  ('2025-04-25', cat_balancer, 'WB-250', 'Manual digital balancer 24" wheel', NULL, 595.00, NULL, 60.00, 30.00, 65.00, 2.0),
  ('2025-04-25', cat_balancer, 'WB-255-LT', '255 Balancer w/out laser w/plastic bonnet 28" truck wheel manual', NULL, 625.00, NULL, 60.00, 30.00, 65.00, 2.0),
  ('2025-04-25', cat_balancer, 'WB-255-L', 'Balancer with laser w/ METAL cover 28" wheel manual', NULL, 725.00, NULL, 60.00, 30.00, 65.00, 2.0);

  -- Alignment Machines
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_alignment, 'AL3D-AC', '3D Alignment machine (Dual Camera) (wireless/bluetooth connectivity) w/ HD Camera NEW', NULL, 10450.00, NULL, 250.00, 125.00, 125.00, 1.75),
  ('2025-04-25', cat_alignment, 'AL3D-8C', '3D Alignment machine (8 Camera) (wireless/bluetooth connectivity) w/ HD Camera NEW', NULL, 11450.00, NULL, 250.00, 125.00, 125.00, 1.75),
  ('2025-04-25', cat_alignment, 'AL3D-A-12-HD', 'Alignment package w/14000 LB 4 POST LIFT*1-12', NULL, 12300.00, NULL, 365.00, 182.50, 275.00, 1.75),
  ('2025-04-25', cat_alignment, 'AL3D-8-12-HD', 'Alignment package (w/14000 LB 4 POST LIFT) (8 Camera) *1-12', NULL, 13300.00, NULL, 365.00, 182.50, 275.00, 1.75);

  -- Shop Equipment
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_shop, 'AC-134A', '134a Automatic A/C machine NEW', NULL, 1795.00, NULL, 85.00, 42.50, 75.00, 1.8),
  ('2025-04-25', cat_shop, 'AC-1234', '1234YF Semi-auto with Database', NULL, 4450.00, NULL, 150.00, 75.00, 100.00, 1.7),
  ('2025-04-25', cat_shop, 'AC-1234-HD', '1234YF Automatic w/Database & Premium Printer', NULL, 4950.00, NULL, 150.00, 75.00, 100.00, 1.7),
  ('2025-04-25', cat_shop, 'BP-120', '120 Ton Shop Press', NULL, 725.00, NULL, 75.00, 37.50, 100.00, 1.8),
  ('2025-04-25', cat_shop, 'BP-55E', '55 Ton Electric/Hydraulic shop press', NULL, 1395.00, NULL, 85.00, 42.50, 100.00, 1.8),
  ('2025-04-25', cat_shop, 'CART-3', 'Heavy duty Creeper 40" padded', NULL, 40.00, NULL, 10.00, 5.00, 20.00, 2.5),
  ('2025-04-25', cat_shop, 'CART-6', '3 drawer Cart/tool box/creeper 3 in 1', NULL, 79.00, NULL, 15.00, 7.50, 25.00, 2.3),
  ('2025-04-25', cat_shop, 'FJ-3', '3 Ton floor jack', NULL, 105.00, NULL, 20.00, 10.00, 35.00, 2.2),
  ('2025-04-25', cat_shop, 'JS-3-ALU', '3 TON ALUMINUM Racing Jack', NULL, 190.00, NULL, 25.00, 12.50, 40.00, 2.0),
  ('2025-04-25', cat_shop, 'JS-3-HD', '3 TON HD racing jack EXTENDED', NULL, 145.00, NULL, 22.00, 11.00, 35.00, 2.2),
  ('2025-04-25', cat_shop, 'JS-22', '22 Ton air / hydraulic jack', NULL, 360.00, NULL, 35.00, 17.50, 50.00, 2.0),
  ('2025-04-25', cat_shop, 'OH-1-6HD', 'Oil evacuator (tank) 27 gallon', NULL, 260.00, NULL, 30.00, 15.00, 45.00, 2.0),
  ('2025-04-25', cat_shop, 'OH-1-165', 'Waste oil tank 16.9 gallon 65 liters', NULL, 155.00, NULL, 25.00, 12.50, 40.00, 2.1),
  ('2025-04-25', cat_shop, 'OHC-1-225EL', 'Oil Combo w/tilt 6 gal & waste oil tank 65 liter electric', NULL, 475.00, NULL, 45.00, 22.50, 60.00, 1.9),
  ('2025-04-25', cat_shop, 'OHD-1-6GAL', 'Oil Drainer (w/probe) tank 6 gallon pneumatic lift', NULL, 175.00, NULL, 25.00, 12.50, 40.00, 2.1),
  ('2025-04-25', cat_shop, 'OHD-1-20GAL', 'Oil Drainer (w/probe) tank 20 gallon pneumatic lift', NULL, 225.00, NULL, 30.00, 15.00, 45.00, 2.0),
  ('2025-04-25', cat_shop, 'TL-12', '12 Ton shop crane w/ Engine Hoist', NULL, 595.00, NULL, 60.00, 30.00, 75.00, 1.9),
  ('2025-04-25', cat_shop, 'TP-200', 'Transmission jack 1/2 Ton (1,000 lb)', NULL, 195.00, NULL, 25.00, 12.50, 45.00, 2.1),
  ('2025-04-25', cat_shop, 'TP-400', 'Transmission jack 1 Ton (2,000 lb)', NULL, 425.00, NULL, 40.00, 20.00, 60.00, 1.9);

  -- Motorcycle Lifts
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_motorcycle, 'MC-1000', 'Motorcycle Lift w/ ext. 1,000 lb. cap. 36"x82.6" pneumatic lift', NULL, 595.00, NULL, 60.00, 30.00, 75.00, 2.0),
  ('2025-04-25', cat_motorcycle, 'MC-1500E', 'Motorcycle Lift 1,500 lb cap 42" x 92" ELECTRIC', NULL, 975.00, NULL, 75.00, 37.50, 100.00, 1.9),
  ('2025-04-25', cat_motorcycle, 'MC-1500-HD', 'Motorcycle Lift 1,500 lb cap 42" x 92" Heavy Duty pneumatic lift', NULL, 825.00, NULL, 70.00, 35.00, 90.00, 1.9),
  ('2025-04-25', cat_motorcycle, 'MCRA-1000', 'Ramp for MC-1000 (Not compatible w/ MC-1500)', NULL, 125.00, NULL, 15.00, 7.50, 25.00, 2.2);

  -- Bundles
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_bundles, 'BUNDLE-2PBP-10-MC', '2PBP-10, MC-1500HD, TM900-24-26, WB-200 Bundle', NULL, 4695.00, NULL, NULL, NULL, NULL, NULL),
  ('2025-04-25', cat_bundles, 'BUNDLE-4PO-14-MC', '4PO-14, MC-1500HD, TM900-24-26, WB-200 Bundle', NULL, 5695.00, NULL, NULL, NULL, NULL, NULL);

  -- Accessories
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_accessories, 'ACCS-DRIPTRAYS', 'Aluminum drip trays (2 piece) for 4 post and 2 post lifts', NULL, 155.00, NULL, 20.00, 10.00, 30.00, 2.0),
  ('2025-04-25', cat_accessories, 'ACCS-JS3-SET', '3 TON JACK and Jack Stand Set (3 TON stands)', NULL, 170.00, NULL, 22.00, 11.00, 40.00, 2.0),
  ('2025-04-25', cat_accessories, 'ACCS-JACK3T', 'Jack stands (pair) 3 ton each', NULL, 30.00, NULL, 8.00, 4.00, 15.00, 2.5),
  ('2025-04-25', cat_accessories, 'ACCS-JACK6T', 'Jack stands (pair) 6 ton each', NULL, 45.00, NULL, 10.00, 5.00, 20.00, 2.3),
  ('2025-04-25', cat_accessories, 'ACCS-JACK12T', 'Jack stands (pair) 12 ton each (22" - 38")', NULL, 120.00, NULL, 18.00, 9.00, 30.00, 2.0),
  ('2025-04-25', cat_accessories, 'TOOL-FD217', 'Pneumatic gear (tools) 28 pc. (3/8" drive) (INPAK, 1WPA, 3WPA, 6PD', NULL, 165.00, NULL, 22.00, 11.00, 35.00, 2.0),
  ('2025-04-25', cat_accessories, 'TOOL-FD242', 'Pneumatic gear (tools) 43 pc. (1/2" drive) (INPAK, 1WPA, 3WPA, 6PD', NULL, 185.00, NULL, 24.00, 12.00, 40.00, 2.0),
  ('2025-04-25', cat_accessories, 'TOOL-MINI-SET', 'Mini tool box 89 pc. 3dr cart 24.8"x13.8"x37.6"', NULL, 285.00, NULL, 35.00, 17.50, 50.00, 1.9);

END $$;
