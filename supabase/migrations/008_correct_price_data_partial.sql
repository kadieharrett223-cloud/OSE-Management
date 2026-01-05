-- Complete corrected price list data from Excel
-- Deletes all wrong data and inserts correct pricing with all categories

DO $$
DECLARE
  cat_2post UUID;
  cat_2post_acc UUID;
  cat_4post UUID;
  cat_4post_acc UUID;
  cat_scissor UUID;
  cat_tire UUID;
  cat_tire_acc UUID;
  cat_balancer UUID;
  cat_alignment UUID;
  cat_shop UUID;
  cat_shop_acc UUID;
  cat_motorcycle UUID;
  cat_motorcycle_acc UUID;
  cat_accessories UUID;
BEGIN
  -- Clear all existing items
  DELETE FROM price_list_items;
  
  -- Get category IDs (create missing ones)
  SELECT id INTO cat_2post FROM price_list_categories WHERE category_name = '2-POST LIFTS';
  SELECT id INTO cat_2post_acc FROM price_list_categories WHERE category_name = '2 Post Accessories';
  SELECT id INTO cat_4post FROM price_list_categories WHERE category_name = '4-POST LIFTS';
  
  -- Create 4 Post Accessories category if missing
  INSERT INTO price_list_categories (category_name, display_order)
  VALUES ('4 Post Accessories', 4)
  ON CONFLICT (category_name) DO NOTHING
  RETURNING id INTO cat_4post_acc;
  IF cat_4post_acc IS NULL THEN
    SELECT id INTO cat_4post_acc FROM price_list_categories WHERE category_name = '4 Post Accessories';
  END IF;
  
  SELECT id INTO cat_scissor FROM price_list_categories WHERE category_name = 'Scissor Lifts';
  SELECT id INTO cat_tire FROM price_list_categories WHERE category_name = 'Tire Machines';
  
  -- Tire Accessories
  INSERT INTO price_list_categories (category_name, display_order)
  VALUES ('Tire Accessories', 6)
  ON CONFLICT (category_name) DO NOTHING
  RETURNING id INTO cat_tire_acc;
  IF cat_tire_acc IS NULL THEN
    SELECT id INTO cat_tire_acc FROM price_list_categories WHERE category_name = 'Tire Accessories';
  END IF;
  
  SELECT id INTO cat_balancer FROM price_list_categories WHERE category_name = 'Wheel Balancers';
  SELECT id INTO cat_alignment FROM price_list_categories WHERE category_name = 'Alignment Machines';
  SELECT id INTO cat_shop FROM price_list_categories WHERE category_name = 'Shop Equipment';
  
  -- Shop Accessories
  INSERT INTO price_list_categories (category_name, display_order)
  VALUES ('Shop Accessories', 9)
  ON CONFLICT (category_name) DO NOTHING
  RETURNING id INTO cat_shop_acc;
  IF cat_shop_acc IS NULL THEN
    SELECT id INTO cat_shop_acc FROM price_list_categories WHERE category_name = 'Shop Accessories';
  END IF;
  
  SELECT id INTO cat_motorcycle FROM price_list_categories WHERE category_name = 'Motorcycle Lifts';
  
  -- Motorcycle Accessories
  INSERT INTO price_list_categories (category_name, display_order)
  VALUES ('Motorcycle Accessories', 10)
  ON CONFLICT (category_name) DO NOTHING
  RETURNING id INTO cat_motorcycle_acc;
  IF cat_motorcycle_acc IS NULL THEN
    SELECT id INTO cat_motorcycle_acc FROM price_list_categories WHERE category_name = 'Motorcycle Accessories';
  END IF;
  
  SELECT id INTO cat_accessories FROM price_list_categories WHERE category_name = 'Accessories';
  
  -- 2-POST LIFTS (9 items) - Order: 2PBP-8, 2PBP-12, 2PBP-10, 2PBPXW-10, 2PCF-9, 2PCFHD-12, 2PCFHD-15, 2PCFXL-10, 2PDDA-10
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_2post, '2PBP-8', '8,000 lb. 2 Post base plate', 'HL', 780.00, 30, 100.00, 70.00, 415.00, 1.35),
  ('2025-04-25', cat_2post, '2PBP-12', '12,000 lb. 2 Post Gold Series base plate', 'HL', 1154.00, 24, 125.00, 87.50, 555.00, 1.6242),
  ('2025-04-25', cat_2post, '2PBP-10', '10,000 lb. 2 Post base plate', 'HL', 820.00, 30, 100.00, 70.00, 500.00, 1.4265),
  ('2025-04-25', cat_2post, '2PBPXW-10', '10,000 lb. 2 Post Gold Series base plate', 'HL', 888.00, 30, 100.00, 70.00, 495.00, 1.4728),
  ('2025-04-25', cat_2post, '2PCF-9', '9,000 lb. 2 Post silver series clear floor', 'HL', 845.00, 24, 125.00, 87.50, 445.00, 1.404),
  ('2025-04-25', cat_2post, '2PCFHD-12', '12,000 lb. 2 Post Gold Series clear floor', 'HL', 1270.00, 21, 142.86, 100.00, 600.00, 1.6836),
  ('2025-04-25', cat_2post, '2PCFHD-15', '15,000 lb. 2 Post Gold Series clear floor', 'HL', 1845.00, 20, 150.00, 105.00, 710.00, 1.61),
  ('2025-04-25', cat_2post, '2PCFXL-10', '10,000 lb. 2 Post Gold Series clear floor', 'HL', 990.00, 27, 111.11, 77.78, 440.00, 1.723),
  ('2025-04-25', cat_2post, '2PDDA-10', '10,000 lb 2 Post Gold Series DD clear floor', 'HL', 1100.00, 27, 111.11, 77.78, 440.00, 1.6951);
  
  -- 2 Post Accessories (5 items) - Order: 2PFC, 4PTA-3, 4PTA-4.5, 4PTA-6, 8PTA
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_2post_acc, '2PFC', 'Frame cradle (4 piece set)', 'YZ', 32.00, 999, 3.00, 2.10, 20.00, 4),
  ('2025-04-25', cat_2post_acc, '4PTA-3', '3.5" Truck adapter set (4 piece set)', 'HHL YZ', 20.00, 999, 3.00, 2.10, 20.00, 2.5),
  ('2025-04-25', cat_2post_acc, '4PTA-4.5', '4.5" Truck adapter set for 2 post lifts (4 piece set)', 'YZ', 22.00, 999, 3.00, 2.10, 20.00, 3),
  ('2025-04-25', cat_2post_acc, '4PTA-6', '6" Truck adapter set for 2 post lifts (4 piece set)', 'HL / Yizan', 22.00, 999, 3.00, 2.10, 20.00, 3.5),
  ('2025-04-25', cat_2post_acc, '8PTA', '3.5" & 6" Truck adapter set (8 piece set)', 'Yz', 40.00, 999, 3.00, 2.10, 20.00, 3.5);
  
  -- 4-POST LIFTS (17 items)
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_4post, '4PML-9', '9,000 lb. 4 post Gold portable', 'HL', 1058.00, 23, 130.43, 91.30, 569.00, 1.339),
  ('2025-04-25', cat_4post, 'HDMBL-9', '9,000 lb. 4 post Gold portable', 'HL', 1470.00, 23, 130.43, 91.30, 569.00, 1.267),
  ('2025-04-25', cat_4post, '4PHR-9x', '9,000 lb. 4 post Gold portable', 'HL / YZ/ FB', 1190.00, 24, 125.00, 87.50, 537.00, 1.5962),
  ('2025-04-25', cat_4post, 'HDMBL-10', '10,000 lb. 4 post Gold portable', 'YZ', 1780.00, 23, 130.43, 91.30, 537.00, 1.5271),
  ('2025-04-25', cat_4post, '4PXL-10', '10,000 lb. 4 post Gold The Dually High-Rise Portable', 'YZ', 1590.00, 23, 130.43, 91.30, 537.00, 1.5221),
  ('2025-04-25', cat_4post, '4PXW-10', '10,000 lb. 4 post Gold double wide', 'FB / YZ', 2584.00, 14, 214.29, 150.00, 640.00, 1.4411),
  ('2025-04-25', cat_4post, '4PHDXLA-11', '11,000 lb. 4 post Gold Open Front Alignment', 'YZ', 3710.00, 13, 230.77, 161.54, 870.00, 1.4967),
  ('2025-04-25', cat_4post, '4PHDXL-12', '12,000 lb. 4 post Gold Maintenance', 'HL', 1990.00, 11, 272.73, 190.91, 870.00, 1.22233),
  ('2025-04-25', cat_4post, '4PHDXLA-14', '14,000 lb. 4 post Gold Series Alignment', 'HL', 2800.00, 11, 272.73, 190.91, 824.00, 1.3496),
  ('2025-04-25', cat_4post, '4PHDXLA-15', '15,000 lb. 4 post Gold Open Front Alignment', 'YZ', 4411.00, 10, 300.00, 210.00, 816.00, 1.4284),
  ('2025-04-25', cat_4post, '4032XL', '16,000 lb 3-car stacking storage lift', 'Blursea', 3690.00, 8, 375.00, 262.50, 1250.00, 1.8),
  ('2025-04-25', cat_4post, '4PHDXL-22', '22,000 lb. 4 post Gold Series', 'Sun', 5490.00, 5, 600.00, 420.00, 0.00, 2.0161),
  ('2025-04-25', cat_4post, '4PHDXLA-22', '22,000 lb. 4 post Gold Series Alignment', 'Sun', 6590.00, 5, 600.00, 420.00, 0.00, 1.9509),
  ('2025-04-25', cat_4post, '4PHDXL-27', '27,000 lb. 4 post Gold Series', 'Sun', 5990.00, 5, 600.00, 420.00, 0.00, 2.0909),
  ('2025-04-25', cat_4post, '4PHDXLA-27', '27,000 lb. 4 post Gold Series Alignment', 'Sun', 6990.00, 4, 750.00, 525.00, 0.00, 1.9695),
  ('2025-04-25', cat_4post, '4PHDXL-33', '33,000 lb. 4 post Gold Series', 'Sun', 7500.00, 4, 750.00, 525.00, 0.00, 1.9814),
  ('2025-04-25', cat_4post, '4PHDXLA-33', '33,000 lb. 4 post Gold Series Alignment', 'Sun', 8500.00, 4, 750.00, 525.00, 0.00, 1.9019);
  
  -- 4 Post Accessories (20 items)
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_4post_acc, 'HLCJ-6', '4PML-8A, 4PHDXL-12, 6,000 lb rolling center jack', 'HL / YZ', 360.00, 200, 15.00, 10.50, NULL, 1.811),
  ('2025-04-25', cat_4post_acc, 'FBCJ-6', '4PHR-9, 4PHR-9X, 4PXW-10, 6,000 lb sliding center jack for 4', 'FB / YZ', 310.00, 200, 15.00, 10.50, NULL, 2.09),
  ('2025-04-25', cat_4post_acc, 'HLCJ-14/ YZRCJ-7', '7,000 lb rolling center jack for 14,000 alignment lift', 'HL', 415.00, 200, 15.00, 10.50, NULL, 2.045),
  ('2025-04-25', cat_4post_acc, 'HR-10', 'Hitch rest for 4PXL-10, HDMBL-10', 'YZ', 31.00, 200, 15.00, 10.50, NULL, 4),
  ('2025-04-25', cat_4post_acc, '4PRJ-9', '4PHDXL-22, 27, & 33 9,000 lb rolling center jack', 'Sun', 499.00, 200, 15.00, 10.50, NULL, 2.438),
  ('2025-04-25', cat_4post_acc, '4PHDA-RJ', '4PHDXLA-11 & 4PHDXLA-15 7,000 lb. sliding center jack', 'YZ', 560.00, 200, 15.00, 10.50, NULL, 1.916),
  ('2025-04-25', cat_4post_acc, '4PTT', 'All 4 post except HDMBL-8 & 4PHDXL-22, 27, & 33', 'YZ', 24.00, 200, 15.00, 10.50, NULL, 2.03),
  ('2025-04-25', cat_4post_acc, '4PJT', 'All 4 post except HDMBL-8 & 4PHDXL-22, 27, & 33', 'YZ', 90.00, 200, 15.00, 10.50, NULL, 1.923),
  ('2025-04-25', cat_4post_acc, 'FBAR-2', 'All 4Post except alignment lifts and 4PHDXL-12. Aluminum ramp set', 'YZ', 200.00, 500, 6.00, 4.20, NULL, 1.705),
  ('2025-04-25', cat_4post_acc, 'YZXL-10RJT', 'Rolling jack tray 4500 lb capacity', 'YZ', 105.00, 250, 12.00, 8.40, NULL, 1.993),
  ('2025-04-25', cat_4post_acc, 'ALT-11-15', 'All Alignment lift turn tables (pair)', NULL, 310.00, 200, 15.00, 10.50, NULL, 2.09),
  ('2025-04-25', cat_4post_acc, 'SSALT-11-15', 'All alignment lifts Stainless steel turn tabbles (pair)', NULL, 310.00, 200, 15.00, 10.50, NULL, 2.09),
  ('2025-04-25', cat_4post_acc, '4PDT', 'All 4Post except alignment lifts. Drip Trays', NULL, 310.00, 200, 15.00, 10.50, NULL, 2.09),
  ('2025-04-25', cat_4post_acc, 'ML-8APLFM', 'Aluminum platform set, 4 pcs 4.72" x 36.93" x 37.5"', NULL, 100.00, 500, 6.00, 4.20, NULL, 1.429),
  ('2025-04-25', cat_4post_acc, 'FB-9PLFM', 'Aluminum platform set, 4 pcs', 'FB', 100.00, 500, 6.00, 4.20, NULL, 1.429),
  ('2025-04-25', cat_4post_acc, 'HR-10PLFM', 'Aluminum platform set, 5 pcs 4.72" x 36.41" x 37.4"', NULL, 100.00, 500, 6.00, 4.20, NULL, 1.429),
  ('2025-04-25', cat_4post_acc, 'XW-10PLFM', 'Aluminum platform set, 8 pcs', NULL, 100.00, 500, 6.00, 4.20, NULL, 1.429),
  ('2025-04-25', cat_4post_acc, '4032PLFM', 'Aluminum platform set, 11 pcs', NULL, 125.00, 500, 6.00, 4.20, NULL, 1.54),
  ('2025-04-25', cat_4post_acc, '4PCA', 'Caster Arm Set (4 pieces)', NULL, 75.00, 500, 6.00, 4.20, NULL, 2.5);
  
  -- SCISSOR LIFTS (3 items)
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_scissor, 'MRSL-6', '6,000 lb. portable mid-rise scissor lift 220V', 'HL', 730.00, 43, 69.77, 48.84, 438.00, 1.337),
  ('2025-04-25', cat_scissor, 'MRSL-75', '7,500 lb. Portable mid-rise scissor lift 220V', 'HL', 870.00, 24, 125.00, 88.00, 546.00, 1.4786),
  ('2025-04-25', cat_scissor, 'FRSL-78', '7,800 lb. ultra thin full-rise scissor lift 220V', 'HL', 1460.00, 33, 90.91, 64.00, 370.00, 1.45);
  
  -- Tire Machines (3 items)
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_tire, 'T999-E', 'Tire machine, tillt column with double assist arms', 'FB', 1950.00, 48, 62.50, 43.75, 242.00, 1.3171),
  ('2025-04-25', cat_tire, 'T650', 'Tire machine, tillt column with double assist arms', 'FB', 1060.00, 50, 60.00, 42.00, 205.00, 1.5225),
  ('2025-04-25', cat_tire, 'T620', 'Tire machine, Semi-automatic side swing arm', 'FB', 488.00, 100, 30.00, 21.00, 205.00, 1.619);
  
  -- Tire Accessories (1 item)
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_tire_acc, 'MCA-1', 'All tire machines. Motorcycle adapter', 'Market', NULL, NULL, NULL, NULL, NULL, NULL);
  
  -- Wheel Balancers (3 items)
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_balancer, 'W820', 'Wheel balancer, Laser. automatic distance & wheel dia measuring', 'FB', 851.00, 110, 27.27, 19.09, 295.00, 1.5),
  ('2025-04-25', cat_balancer, 'w810', 'Wheel balancer, automatic distance & wheel diameter measuring', 'FB', 432.00, 110, 27.27, 19.09, 275.00, 1.5),
  ('2025-04-25', cat_balancer, 'W690', 'Truck Wheel balancer, automatic', 'FB', 780.00, 110, 27.27, 19.09, 280.00, 1.5);
  
  -- Alignment Machines (3 items)
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_alignment, 'AS800', 'Alignment machine, luxury cabinet, includes calibration bar', 'Lawrence', 5159.00, 40, 75.00, 52.50, 306.00, 1.3007),
  ('2025-04-25', cat_alignment, 'A9800', 'Alignment machine, touchless 3D, smart window, calibration bar', 'Lawrence', 4046.00, 45, 66.67, 46.67, 293.00, 1.4115),
  ('2025-04-25', cat_alignment, 'ACB-1', 'AS800 & A9800 Alignment calibration Tool', 'Lawrence', 542.00, 200, 15.00, 10.50, 250.00, 1.835);
  
  -- SHOP EQUIPMENT (2 items)
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_shop, 'R-45', '4,500 lb. Gold HDXL portable hydraulic auto shop rotisserie', 'YZ', 460.00, 50, 60.00, 42.00, 300.00, 1.55),
  ('2025-04-25', cat_shop, 'R-30', '3000 lb. Silver Series portable rotisserie', 'YZ', 430.00, 50, 60.00, 42.00, 285.00, 1.44);
  
  -- Shop Accessories (1 item)
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_shop_acc, 'RT-1', 'R-30 and R-45 Rotisserie transmission fits R-45 and R-30', 'YZ', 80.00, 500, 6.00, 4.20, 50.00, 1.812);
  
  -- MOTORCYLE LIFTS (1 item)
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_motorcycle, 'HDML-15', '1,550 lb. Gold Series HDXL full-rise M/C ATV lift 220V', 'YZ', 506.00, 50, 60.00, 42.00, 220.00, 1.42);
  
  -- Motorcycle Accessories (skipped - no valid data)
  
  -- ACCESSORIES (14 items)
  INSERT INTO price_list_items (version_tag, category_id, item_no, description, supplier, fob_cost, quantity, ocean_frt, importing, zone5_shipping, multiplier) VALUES
  ('2025-04-25', cat_accessories, 'APU-1', 'Air-Power Utility Station (for 2 & 4 post lifts)', 'YZ', 100.00, 500, 6.00, 4.20, NULL, 2.232),
  ('2025-04-25', cat_accessories, 'UHS-5075', 'Under Hoist jack stand (for 2 & 4 post lifts)', 'YZ', 23.68, 500, 6.00, 4.20, NULL, 2.59),
  ('2025-04-25', cat_accessories, 'UHJS-750', 'Under Hoist Jiggle stand (for 2 & 4 post lifts)', NULL, 30.00, 500, 6.00, 4.20, NULL, 2.41),
  ('2025-04-25', cat_accessories, 'OD-A30', 'Waste oil drain 8 gallon capacity (for 2 & 4 post lifts)', 'FB', 24.00, 250, 12.00, 8.40, NULL, 1.8),
  ('2025-04-25', cat_accessories, 'OD-7170', 'Waste oil drain 20 gallon capacity (for 2 & 4 post lifts)', NULL, 35.00, 250, 12.00, 8.40, NULL, 2.535),
  ('2025-04-25', cat_accessories, 'OD-3198', 'Pressurized waste oil drain 20 gallon capacity (for 2 & 4 post lifts)', 'FB', 75.00, 250, 12.00, 8.40, NULL, 1.051),
  ('2025-04-25', cat_accessories, 'TJ-1102 / TJ-707', 'Transmission Jack Deluxe 2-stage 1100 lb (for 2 & 4 post lifts)', 'FB', 146.00, 250, 12.00, 8.40, NULL, 1.335),
  ('2025-04-25', cat_accessories, 'TJ-1101A / TJ2718', 'Transmission Jack single stage 1100 lb (for 2 & 4 post lifts)', 'FB', 88.00, 250, 12.00, 8.40, NULL, 1.395),
  ('2025-04-25', cat_accessories, 'Hi Strength Epoxy', 'Anchoring epoxy cartrige (254ml) (for 2 & 4 post lifts)', NULL, 15.00, 1000, 3.00, 2.10, NULL, 1.22),
  ('2025-04-25', cat_accessories, 'HPU220-4', '220V 4hp 60Hz 1-phase power unit (2 & 4 post', 'HL', 160.00, 750, 4.00, 2.80, NULL, 1.374),
  ('2025-04-25', cat_accessories, 'HPU220', '220V 3hp 60Hz 1-phase power unit (2 & 4 post', 'HL', 150.00, 750, 4.00, 2.80, NULL, 1.301),
  ('2025-04-25', cat_accessories, 'HPU110', '110V 3hp 60Hz 1-phase power unit (2 & 4 pos', 'HL', 150.00, 750, 4.00, 2.80, NULL, 1.236);
  
END $$;
