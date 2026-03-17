-- Global tariff percent setting with automatic recalculation support

CREATE TABLE IF NOT EXISTS pricing_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  global_tariff_percent NUMERIC(8, 4) NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pricing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role full access to pricing_settings" ON pricing_settings;
CREATE POLICY "Allow service role full access to pricing_settings"
  ON pricing_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO pricing_settings (id, global_tariff_percent)
VALUES ('00000000-0000-0000-0000-000000000002', 100)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'price_list_items') THEN
    DROP TRIGGER IF EXISTS compute_price_list_fields_trigger ON price_list_items;
    DROP FUNCTION IF EXISTS compute_price_list_derived_fields();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION compute_price_list_derived_fields()
RETURNS TRIGGER AS $$
DECLARE
  is_katool BOOLEAN;
  tariff_percent NUMERIC(8, 4) := 100;
  tariff_multiplier NUMERIC(10, 6) := 2;
BEGIN
  -- Check if supplier contains KATOOL or KATA (case-insensitive)
  is_katool := (UPPER(COALESCE(NEW.supplier, '')) LIKE '%KATOOL%' OR UPPER(COALESCE(NEW.supplier, '')) LIKE '%KATA%');

  SELECT COALESCE(ps.global_tariff_percent, 100)
  INTO tariff_percent
  FROM pricing_settings ps
  ORDER BY ps.updated_at DESC
  LIMIT 1;

  tariff_multiplier := 1 + (tariff_percent / 100);

  -- If manual_pricing_override is FALSE, auto-calculate based on supplier type
  IF NOT COALESCE(NEW.manual_pricing_override, FALSE) THEN
    IF is_katool THEN
      -- KATOOL/Tariff-Exempt Pricing (simplified, no tariffs)
      NEW.tariff_105 := 0;
      NEW.ocean_frt := 0;
      NEW.importing := 0;
      NEW.per_unit := COALESCE(NEW.fob_cost, 0);
      NEW.cost_with_shipping := COALESCE(NEW.fob_cost, 0) + COALESCE(NEW.zone5_shipping, 0);
    ELSE
      -- Normal Pricing (with configurable global tariff)
      NEW.tariff_105 := COALESCE(NEW.fob_cost, 0) * tariff_multiplier;

      IF COALESCE(NEW.quantity, 0) > 0 THEN
        NEW.ocean_frt := 3000 / NEW.quantity;
        NEW.importing := 2100 / NEW.quantity;
      ELSE
        NEW.ocean_frt := COALESCE(NEW.ocean_frt, 0);
        NEW.importing := COALESCE(NEW.importing, 0);
      END IF;

      NEW.per_unit := NEW.tariff_105 + COALESCE(NEW.ocean_frt, 0) + COALESCE(NEW.importing, 0);
      NEW.cost_with_shipping := NEW.per_unit + COALESCE(NEW.zone5_shipping, 0);
    END IF;
  END IF;

  -- Calculate sell price based on margin (applies to all cases)
  IF COALESCE(NEW.margin, 0) > 0 AND COALESCE(NEW.margin, 0) < 1 THEN
    NEW.sell_price := NEW.cost_with_shipping / (1 - NEW.margin);
  ELSE
    NEW.sell_price := NEW.cost_with_shipping;
  END IF;

  -- Common calculations for all items
  NEW.profit := NEW.sell_price - NEW.cost_with_shipping;
  NEW.rounded_normal_price := FLOOR(NEW.sell_price / 5) * 5;

  -- List price: Only calculate if NULL (preserve manual values)
  IF NEW.list_price IS NULL THEN
    NEW.list_price := NEW.sell_price * 1.25;
  END IF;

  NEW.black_friday_price := NEW.list_price * 0.75;
  NEW.rounded_sale_price := FLOOR(NEW.black_friday_price / 100) * 100 - 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'price_list_items') THEN
    CREATE TRIGGER compute_price_list_fields_trigger
      BEFORE INSERT OR UPDATE ON price_list_items
      FOR EACH ROW
      EXECUTE FUNCTION compute_price_list_derived_fields();

    -- Recalculate all products except manual overrides using the latest global tariff setting
    UPDATE price_list_items
    SET updated_at = NOW()
    WHERE COALESCE(manual_pricing_override, FALSE) = FALSE;
  END IF;
END $$;
