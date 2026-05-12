-- Add labor/overhead component columns to price_list_items.
-- These components are included in cost_with_shipping.

ALTER TABLE price_list_items
  ADD COLUMN IF NOT EXISTS indirect_labor numeric(12,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS direct_labor numeric(12,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overhead_cost numeric(12,4) DEFAULT 0;

UPDATE price_list_items
SET
  indirect_labor = COALESCE(indirect_labor, 0),
  direct_labor = COALESCE(direct_labor, 0),
  overhead_cost = COALESCE(overhead_cost, 0);

CREATE OR REPLACE FUNCTION compute_price_list_derived_fields()
RETURNS TRIGGER AS $$
DECLARE
  is_katool BOOLEAN;
  tariff_exempt_row BOOLEAN;
  tariff_percent NUMERIC(8, 4) := 80;
  tariff_multiplier NUMERIC(10, 6) := 1.8;
  indirect_labor_value NUMERIC(12, 4) := COALESCE(NEW.indirect_labor, 0);
  direct_labor_value NUMERIC(12, 4) := COALESCE(NEW.direct_labor, 0);
  overhead_cost_value NUMERIC(12, 4) := COALESCE(NEW.overhead_cost, 0);
BEGIN
  is_katool := (UPPER(COALESCE(NEW.supplier, '')) LIKE '%KATOOL%' OR UPPER(COALESCE(NEW.supplier, '')) LIKE '%KATA%');
  tariff_exempt_row := COALESCE(NEW.tariff_exempt, FALSE) OR is_katool;

  SELECT COALESCE(ps.global_tariff_percent, 80)
  INTO tariff_percent
  FROM pricing_settings ps
  WHERE ps.id = '00000000-0000-0000-0000-000000000002'
  LIMIT 1;

  tariff_multiplier := 1 + (tariff_percent / 100);

  IF NOT COALESCE(NEW.manual_pricing_override, FALSE) THEN
    IF tariff_exempt_row THEN
      NEW.tariff_105 := 0;
      NEW.ocean_frt := 0;
      NEW.importing := 0;
      NEW.per_unit := COALESCE(NEW.fob_cost, 0);
      NEW.cost_with_shipping := COALESCE(NEW.fob_cost, 0) + COALESCE(NEW.zone5_shipping, 0) + indirect_labor_value + direct_labor_value + overhead_cost_value;
    ELSE
      NEW.tariff_105 := COALESCE(NEW.fob_cost, 0) * tariff_multiplier;

      IF COALESCE(NEW.quantity, 0) > 0 THEN
        NEW.ocean_frt := 3000 / NEW.quantity;
        NEW.importing := 2100 / NEW.quantity;
      ELSE
        NEW.ocean_frt := COALESCE(NEW.ocean_frt, 0);
        NEW.importing := COALESCE(NEW.importing, 0);
      END IF;

      NEW.per_unit := NEW.tariff_105 + COALESCE(NEW.ocean_frt, 0) + COALESCE(NEW.importing, 0);
      NEW.cost_with_shipping := NEW.per_unit + COALESCE(NEW.zone5_shipping, 0) + indirect_labor_value + direct_labor_value + overhead_cost_value;
    END IF;
  END IF;

  -- Use markup semantics used by the UI: sell = cost * (1 + margin)
  NEW.sell_price := COALESCE(NEW.cost_with_shipping, 0) * (1 + COALESCE(NEW.margin, 0));

  NEW.profit := NEW.sell_price - NEW.cost_with_shipping;
  NEW.rounded_normal_price := FLOOR(NEW.sell_price / 5) * 5;

  IF NEW.list_price IS NULL OR NEW.list_price <= 0 THEN
    NEW.list_price := NEW.sell_price / 0.80;
  END IF;

  NEW.black_friday_price := NEW.list_price * 0.75;
  NEW.rounded_sale_price := FLOOR(NEW.black_friday_price / 100) * 100 - 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE price_list_items
SET updated_at = NOW();

NOTIFY pgrst, 'reload schema';
