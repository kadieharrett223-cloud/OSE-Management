-- Update price list margins from multiplier to true margin % (decimal format)
-- Run this migration after deploying the margin column changes

-- 2-POST LIFTS
UPDATE price_list_items SET margin = 0.2248 WHERE item_no = '2PBP-8';
UPDATE price_list_items SET margin = 0.2877 WHERE item_no = '2PCF-9';
UPDATE price_list_items SET margin = 0.2990 WHERE item_no = '2PBP-10';
UPDATE price_list_items SET margin = 0.3210 WHERE item_no = '2PBPXW-10';
UPDATE price_list_items SET margin = 0.4196 WHERE item_no = '2PCFXL-10';
UPDATE price_list_items SET margin = 0.4101 WHERE item_no = '2PDDA-10';
UPDATE price_list_items SET margin = 0.3843 WHERE item_no = '2PBP-12';
UPDATE price_list_items SET margin = 0.4060 WHERE item_no = '2PCFHD-12';
UPDATE price_list_items SET margin = 0.3789 WHERE item_no = '2PCFHD-15';

-- 2 Post Accessories
UPDATE price_list_items SET margin = 0.6000 WHERE item_no = '4PTA-3';
UPDATE price_list_items SET margin = 0.7143 WHERE item_no = '4PTA-6';
UPDATE price_list_items SET margin = 0.6667 WHERE item_no = '4PTA-4.5';
UPDATE price_list_items SET margin = 0.7143 WHERE item_no = '8PTA';
UPDATE price_list_items SET margin = 0.7500 WHERE item_no = '2PFC';

-- 4-POST LIFTS
UPDATE price_list_items SET margin = 0.2296 WHERE item_no = '4PML-9' OR description ILIKE '%Compact%';
UPDATE price_list_items SET margin = 0.2532 WHERE item_no = '4PML-9';
UPDATE price_list_items SET margin = 0.3815 WHERE item_no = 'HDMBL-9';
UPDATE price_list_items SET margin = 0.3735 WHERE item_no = '4PHR-9x';
UPDATE price_list_items SET margin = 0.3351 WHERE item_no = 'HDMBL-10';
UPDATE price_list_items SET margin = 0.5000 WHERE item_no = '4PHR-10x';
UPDATE price_list_items SET margin = 0.3430 WHERE item_no = '4PXL-10';
UPDATE price_list_items SET margin = 0.3085 WHERE item_no = '4PXL-10B';
UPDATE price_list_items SET margin = 0.3061 WHERE item_no = '4PXW-10';
UPDATE price_list_items SET margin = 0.2759 WHERE item_no = '4PHDXLA-11';
UPDATE price_list_items SET margin = 0.1865 WHERE item_no = '4PHDXL-12';
UPDATE price_list_items SET margin = 0.3685 WHERE item_no = '4PHDXLA-12';
UPDATE price_list_items SET margin = 0.2590 WHERE item_no = '4PHDXLA-14';
UPDATE price_list_items SET margin = 0.1943 WHERE item_no = '4PHDXLA-15';
UPDATE price_list_items SET margin = 0.4444 WHERE item_no = '4032XL';
UPDATE price_list_items SET margin = 0.3557 WHERE item_no = '4032-6';
UPDATE price_list_items SET margin = 0.4875 WHERE item_no = '4032S';
UPDATE price_list_items SET margin = 0.5040 WHERE item_no = '4PHDXL-22';
UPDATE price_list_items SET margin = 0.4874 WHERE item_no = '4PHDXLA-22';
UPDATE price_list_items SET margin = 0.5217 WHERE item_no = '4PHDXL-27';
UPDATE price_list_items SET margin = 0.4923 WHERE item_no = '4PHDXLA-27';
UPDATE price_list_items SET margin = 0.4953 WHERE item_no = '4PHDXL-33';
UPDATE price_list_items SET margin = 0.4742 WHERE item_no = '4PHDXLA-33';

-- 4 Post Accessories
UPDATE price_list_items SET margin = 0.4478 WHERE item_no = 'HLCJ-6';
UPDATE price_list_items SET margin = 0.5215 WHERE item_no = 'FBCJ-6';
-- JVCJ-6 — skip (DIV/0)
UPDATE price_list_items SET margin = 0.5110 WHERE item_no = 'HLCJ-14' OR item_no = 'YZRCJ-7';
UPDATE price_list_items SET margin = 0.7500 WHERE item_no = 'HR-10';
UPDATE price_list_items SET margin = 0.4751 WHERE item_no = '4PRJ-9';
UPDATE price_list_items SET margin = 0.4781 WHERE item_no = '4PHDA-RJ';
UPDATE price_list_items SET margin = 0.5074 WHERE item_no = '4PTT';
UPDATE price_list_items SET margin = 0.4800 WHERE item_no = '4PJT';
UPDATE price_list_items SET margin = 0.4135 WHERE item_no = 'FBAR-2';
UPDATE price_list_items SET margin = 0.4982 WHERE item_no = 'YZXL-10RJT';
UPDATE price_list_items SET margin = 0.5215 WHERE item_no = 'ALT-11-15';
UPDATE price_list_items SET margin = 0.5215 WHERE item_no = 'SSALT-11-15';
UPDATE price_list_items SET margin = 0.5215 WHERE item_no = '4PDT';
UPDATE price_list_items SET margin = 0.3002 WHERE item_no = 'ML-8APLFM';
UPDATE price_list_items SET margin = 0.3002 WHERE item_no = 'FB-9PLFM';
UPDATE price_list_items SET margin = 0.3002 WHERE item_no = 'HR-10PLFM';
UPDATE price_list_items SET margin = 0.3002 WHERE item_no = 'XW-10PLFM';
UPDATE price_list_items SET margin = 0.3506 WHERE item_no = '4032PLFM';
UPDATE price_list_items SET margin = 0.3506 WHERE item_no = '4PCA';
UPDATE price_list_items SET margin = 0.5000 WHERE item_no = 'HK-4PCA';

-- SCISSOR LIFTS
UPDATE price_list_items SET margin = 0.2521 WHERE item_no = 'MRSL-6';
UPDATE price_list_items SET margin = 0.3237 WHERE item_no = 'MRSL-75';
UPDATE price_list_items SET margin = 0.3103 WHERE item_no = 'FRSL-78';

-- Tire Machines
UPDATE price_list_items SET margin = 0.2408 WHERE item_no = 'T999-E';
UPDATE price_list_items SET margin = 0.3432 WHERE item_no = 'T650';
UPDATE price_list_items SET margin = 0.3823 WHERE item_no = 'T620';

-- Wheel Balancers
UPDATE price_list_items SET margin = 0.3333 WHERE item_no = 'W820';
UPDATE price_list_items SET margin = 0.3333 WHERE item_no = 'w810';
UPDATE price_list_items SET margin = 0.3333 WHERE item_no = 'W690';

-- Alignment Machines
UPDATE price_list_items SET margin = 0.2312 WHERE item_no = 'AS800';
UPDATE price_list_items SET margin = 0.2915 WHERE item_no = 'A9800';
UPDATE price_list_items SET margin = 0.4550 WHERE item_no = 'ACB-1';

-- Shop Equipment
UPDATE price_list_items SET margin = 0.3548 WHERE item_no = 'R-45';
UPDATE price_list_items SET margin = 0.3056 WHERE item_no = 'R-30';
UPDATE price_list_items SET margin = 0.4481 WHERE item_no = 'RT-1';

-- Motorcycle Lifts
UPDATE price_list_items SET margin = 0.2958 WHERE item_no = 'HDML-15';

-- Accessories
UPDATE price_list_items SET margin = 0.5520 WHERE item_no = 'APU-1';
UPDATE price_list_items SET margin = 0.6139 WHERE item_no = 'UHS-5075';
UPDATE price_list_items SET margin = 0.5851 WHERE item_no = 'UHJS-750';
UPDATE price_list_items SET margin = 0.4444 WHERE item_no = 'OD-A30';
UPDATE price_list_items SET margin = 0.6055 WHERE item_no = 'OD-7170';
UPDATE price_list_items SET margin = 0.0485 WHERE item_no = 'OD-3198A';
UPDATE price_list_items SET margin = 0.0485 WHERE item_no = 'OD-3198';
UPDATE price_list_items SET margin = 0.2509 WHERE item_no = 'TJ-1102' OR item_no = 'TJ-707';
UPDATE price_list_items SET margin = 0.2832 WHERE item_no = 'TJ-1101A' OR item_no = 'TJ2718';
UPDATE price_list_items SET margin = 0.1803 WHERE description ILIKE '%Hi Strength Epoxy%';
UPDATE price_list_items SET margin = 0.2722 WHERE item_no = 'HPU220-4';
UPDATE price_list_items SET margin = 0.2314 WHERE item_no = 'HPU220';
UPDATE price_list_items SET margin = 0.1909 WHERE item_no = 'HPU110';
