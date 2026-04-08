-- Update selected product weights (lbs only) in price list and PO lines

WITH weights(item_no, weight_lbs) AS (
  VALUES
    ('2PBP-8', 1169),
    ('2PBP-10', 1256),
    ('2PCF-9', 1234),
    ('2PBPXW-10', 1322),
    ('2PCFXL-10', 1455),
    ('2PDDA-10', 1565),
    ('2PBP-12', 1719),
    ('2PCFHD-12', 1962),
    ('2PCFHD-15', 2645),
    ('4PML-9', 1675),
    ('HDMBL-9', 1697),
    ('4PHDXLA-14', 4409),
    ('4PHDXL-12', 3218),
    ('4PHDXLA-12', 3306),
    ('MRSL-75', 1100),
    ('MRSL-6', 837),
    ('FRSL-78', 1785)
)
UPDATE price_list_items pli
SET weight_lbs = w.weight_lbs
FROM weights w
WHERE UPPER(TRIM(pli.item_no)) = w.item_no;

WITH weights(item_no, weight_lbs) AS (
  VALUES
    ('2PBP-8', 1169),
    ('2PBP-10', 1256),
    ('2PCF-9', 1234),
    ('2PBPXW-10', 1322),
    ('2PCFXL-10', 1455),
    ('2PDDA-10', 1565),
    ('2PBP-12', 1719),
    ('2PCFHD-12', 1962),
    ('2PCFHD-15', 2645),
    ('4PML-9', 1675),
    ('HDMBL-9', 1697),
    ('4PHDXLA-14', 4409),
    ('4PHDXL-12', 3218),
    ('4PHDXLA-12', 3306),
    ('MRSL-75', 1100),
    ('MRSL-6', 837),
    ('FRSL-78', 1785)
)
UPDATE purchase_order_lines pol
SET weight_lbs = w.weight_lbs
FROM weights w
WHERE UPPER(TRIM(pol.sku)) = w.item_no;
