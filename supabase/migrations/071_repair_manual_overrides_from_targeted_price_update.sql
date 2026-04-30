-- Repair rows accidentally forced into manual override with margin=0
-- This returns affected SKUs to formula-driven pricing and restores margin
-- derived from current sell price and corrected final-cost formula.

WITH tariff_setting AS (
  SELECT COALESCE(global_tariff_percent, 80)::numeric AS tariff_percent
  FROM pricing_settings
  WHERE id = '00000000-0000-0000-0000-000000000002'
  LIMIT 1
), target_rows AS (
  SELECT
    p.id,
    p.item_no,
    COALESCE(p.sell_price, 0)::numeric AS sell_price,
    COALESCE(p.fob_cost, 0)::numeric AS fob_cost,
    COALESCE(p.zone5_shipping, 0)::numeric AS zone5_shipping,
    COALESCE(p.quantity, 0)::numeric AS quantity,
    COALESCE(p.ocean_frt, 0)::numeric AS ocean_frt,
    COALESCE(p.importing, 0)::numeric AS importing,
    COALESCE(p.tariff_exempt, false) AS tariff_exempt,
    COALESCE(p.supplier, '') AS supplier,
    ts.tariff_percent,
    CASE
      WHEN COALESCE(p.tariff_exempt, false)
        OR UPPER(COALESCE(p.supplier, '')) LIKE '%KATOOL%'
        OR UPPER(COALESCE(p.supplier, '')) LIKE '%KATA%'
      THEN COALESCE(p.fob_cost, 0) + COALESCE(p.zone5_shipping, 0)
      ELSE
        (COALESCE(p.fob_cost, 0) * (1 + (ts.tariff_percent / 100)))
        + (CASE WHEN COALESCE(p.quantity, 0) > 0 THEN 3000 / p.quantity ELSE COALESCE(p.ocean_frt, 0) END)
        + (CASE WHEN COALESCE(p.quantity, 0) > 0 THEN 2100 / p.quantity ELSE COALESCE(p.importing, 0) END)
        + COALESCE(p.zone5_shipping, 0)
    END AS final_cost
  FROM price_list_items p
  CROSS JOIN tariff_setting ts
  WHERE p.is_active = TRUE
    AND p.manual_pricing_override = TRUE
    AND p.item_no IN (
      '2PCFHD-15', '2PCFHD-12', '2PBP-12', '2PDDA-10', '2PCFXL-10',
      '2PBPXW-10', '2PBBXW-10', '2PBP-10', '2PCF-9', '2PBP-8',
      'HDMBL-10', '4PHDXLA-11', '4PHDXL-12', '4PXW-10', '4PXL-10',
      '4PHR-9X', '4PHR-9x', 'HDMBL-9', '4PML-9'
    )
)
UPDATE price_list_items p
SET
  manual_pricing_override = FALSE,
  margin = CASE
    WHEN t.sell_price > 0 AND t.sell_price > t.final_cost
      THEN LEAST(0.95, GREATEST(0, 1 - (t.final_cost / t.sell_price)))
    ELSE COALESCE(p.margin, 0)
  END,
  updated_at = NOW()
FROM target_rows t
WHERE p.id = t.id;

-- Trigger recomputes sell/profit/derived values on update.
NOTIFY pgrst, 'reload schema';
