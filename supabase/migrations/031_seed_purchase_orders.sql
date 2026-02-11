-- Wipe existing purchase orders (test data)
DELETE FROM purchase_orders;

-- Seed purchase orders from container list
INSERT INTO purchase_orders (po_number, vendor_name, order_date, expected_delivery, status, total_amount)
VALUES
  ('C-195', 'FB', '2025-12-16', '2026-03-14', 'TO_BE_PAID', 0),
  ('C-197', 'HIKER', '2025-11-11', '2026-02-23', 'TO_BE_PAID', 0),
  ('C-198', 'HL', '2025-11-20', '2026-03-16', 'TO_BE_PAID', 0),
  ('C-199', 'HL', '2025-11-19', '2026-02-24', 'TO_BE_PAID', 0),
  ('C-201', 'HL', '2025-11-29', NULL, 'TO_BE_PAID', 0),
  ('C-202', 'HL', '2025-11-30', '2026-02-21', 'TO_BE_PAID', 0),
  ('C-203', 'HL', '2025-11-30', '2026-03-03', 'TO_BE_PAID', 0),
  ('C-205', 'FB', '2025-12-17', '2026-03-14', 'TO_BE_PAID', 0),
  ('C-206', 'HL', '2025-12-05', NULL, 'TO_BE_PAID', 0),
  ('C-207', 'HL', '2025-12-05', '2026-02-23', 'TO_BE_PAID', 0),
  ('C-208', 'HIKER', '2025-12-05', NULL, 'TO_BE_PAID', 0),
  ('C-209', 'HIKER', '2025-12-05', NULL, 'TO_BE_PAID', 0),
  ('C-210', 'HIKER', '2025-12-05', NULL, 'TO_BE_PAID', 0),
  ('C-211', 'YIZ', '2025-12-15', '2026-03-02', 'TO_BE_PAID', 0),
  ('C-212', 'HL', '2025-12-20', NULL, 'TO_BE_PAID', 0),
  ('C-213', 'HL', '2025-12-20', NULL, 'TO_BE_PAID', 0),
  ('C-214', 'HL', '2025-12-23', NULL, 'TO_BE_PAID', 0),
  ('C-215', 'HL', '2025-12-25', NULL, 'TO_BE_PAID', 0),
  ('C-216', 'YIZ', '2025-12-26', NULL, 'TO_BE_PAID', 0),
  ('C-217', 'HL', '2026-01-07', NULL, 'TO_BE_PAID', 0),
  ('C-218', 'YIZ', '2026-01-06', NULL, 'TO_BE_PAID', 0),
  ('C-219', 'HL', '2026-01-13', NULL, 'TO_BE_PAID', 0),
  ('C-220', 'YIZ', '2026-01-13', NULL, 'TO_BE_PAID', 0),
  ('C-221', 'HL', '2026-01-30', NULL, 'TO_BE_PAID', 0);

-- Line items per container
INSERT INTO purchase_order_lines (purchase_order_id, line_number, sku, description, quantity, unit_price, line_total)
VALUES
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-195'), 1, 'FB-4PHR-9X', 'FB-4PHR-9X', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-195'), 2, 'FB-4PXW-10', 'FB-4PXW-10', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-195'), 3, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-195'), 4, 'FBCJ-6', 'Sliding Manual Center Jack', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-195'), 5, 'HLCJ-6', 'Rolling Air/Hydraulic Center Jack', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-197'), 1, 'HL-2PBP-8', 'Base Plate 8K', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-197'), 2, 'HL-2PBP-10', '2 Post 10K Base Plate', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-197'), 3, 'HL-4PML-9', 'HL-4PML-9', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-197'), 4, 'FB-4PHR-9X', 'FB-4PHR-9X', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-197'), 5, 'HPU2204', 'Motor 220v 4hp', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-197'), 6, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-198'), 1, 'HL-2PBP-10', '2 Post 10K Base Plate', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-198'), 2, 'HL-2PCFHD-12', 'Clear Floor', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-198'), 3, 'HL-MRSL-75', 'HL-MRSL-75', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-198'), 4, 'HL-FRSL-78', 'HL-FRSL-78', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-198'), 5, 'HPU2204', 'Motor 220v 4hp', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-198'), 6, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-199'), 1, 'HL-2PBPXW-10', 'HL-2PBPXW-10', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-199'), 2, 'HL-4PML-9', 'HL-4PML-9', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-199'), 3, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-201'), 1, 'HL-2PCFXL-10', 'Clear Floor', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-201'), 2, 'HL-2PDDA-10', 'Direct Drive', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-201'), 3, 'HPU1103', 'Motor 110v 3hp', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-201'), 4, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-202'), 1, 'HL-2PCF-9', 'Clear Floor', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-202'), 2, 'HL-4PML-9', 'HL-4PML-9', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-202'), 3, 'HPU2204', 'Motor 220v 4hp', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-202'), 4, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-203'), 1, 'HL-2PBPXW-10', 'HL-2PBPXW-10', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-203'), 2, 'HL-4PML-9', 'HL-4PML-9', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-203'), 3, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-205'), 1, 'FB-4PHR-9X', 'FB-4PHR-9X', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-205'), 2, 'FB-4PXW-10', 'FB-4PXW-10', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-205'), 3, 'FBCJ-6', 'Center Jack', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-205'), 4, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-206'), 1, 'HL-2PCFXL-10', 'HL-2PCFXL-10', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-206'), 2, 'HL-4PHDXL-12', 'HL-4PHDXL-12', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-206'), 3, 'SPARE HPU2204', 'Motor 220v 4hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-207'), 1, 'HL-2PCF-9', 'HL-2PCF-9', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-207'), 2, 'HL-4PHDXLA-12', 'HL-4PHDXLA-12', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-207'), 3, 'YZ-XL-10HR', 'Hitch Rest', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-207'), 4, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-208'), 1, 'HL-2PCF-9', 'HL-2PCF-9', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-208'), 2, 'HL-4PHDXL-12', 'HL-4PHDXL-12', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-208'), 3, 'YZXL-10', 'RJT Rolling Jack Tray', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-208'), 4, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-209'), 1, 'HL-2PDDA-10', 'HL-2PDDA-10', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-209'), 2, 'HL-4PHDXLA-12', 'HL-4PHDXLA-12', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-209'), 3, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-210'), 1, 'HL-2PDDA-10', 'HL-2PDDA-10', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-210'), 2, 'HL-4PHDXLA-12', 'HL-4PHDXLA-12', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-210'), 3, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-211'), 1, 'YZ-4PXL-10 / HDMBL-10', 'YZ-4PXL-10 / HDMBL-10', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-211'), 2, 'YZ-XL-10HR', 'Hitch Rest', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-211'), 3, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-212'), 1, 'HL-2PCFHD-12', 'HL-2PCFHD-12', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-212'), 2, 'HL-4PHDXL-12', 'HL-4PHDXL-12', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-212'), 3, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-213'), 1, 'HL-2PCFHD-12', 'HL-2PCFHD-12', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-213'), 2, 'HL-4PHDXLA-12', 'HL-4PHDXLA-12', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-213'), 3, 'SPARE HPU2203', 'Motor 220v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-214'), 1, 'HL-2PBP-10', 'HL-2PBP-10', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-214'), 2, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-215'), 1, 'HL-2PBP-10', 'HL-2PBP-10', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-215'), 2, 'HL-4PML-9', 'HL-4PML-9', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-215'), 3, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-216'), 1, 'YZ-4PXL-10', 'YZ-4PXL-10', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-216'), 2, 'YZ-4PXW-10B', 'YZ-4PXW-10B', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-216'), 3, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-217'), 1, 'HL-2PCFHD-15', 'HL-2PCFHD-15', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-217'), 2, 'HL-4PHDXLA-12', 'HL-4PHDXLA-12', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-217'), 3, 'SPARE HPU2204', 'Motor 220v 4hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-218'), 1, 'YZ-4PXL-10', 'YZ-4PXL-10', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-218'), 2, 'YZ-XL-10HR', 'Hitch Rest', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-218'), 3, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-219'), 1, 'HL-2PBPXW-10', 'HL-2PBPXW-10', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-219'), 2, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-220'), 1, 'YZ-4PXL-10', 'YZ-4PXL-10', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-220'), 2, 'YZXL-10', 'RJT Rolling Jack Tray', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-220'), 3, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0),

  ((SELECT id FROM purchase_orders WHERE po_number = 'C-221'), 1, 'HL-2PBPXW-10', 'HL-2PBPXW-10', 1, 0, 0),
  ((SELECT id FROM purchase_orders WHERE po_number = 'C-221'), 2, 'SPARE HPU1103', 'Motor 110v 3hp', 1, 0, 0);
