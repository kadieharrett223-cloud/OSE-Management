-- Update trigger function to compute profit column
-- Profit = sell_price - per_unit (actual profit per unit)

DROP TRIGGER IF EXISTS compute_price_list_fields_trigger ON price_list_items;
DROP FUNCTION IF EXISTS compute_price_list_derived_fields();

CREATE OR REPLACE FUNCTION compute_price_list_derived_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- 1) tariff_105 = fob_cost * 2
  NEW.tariff_105 := COALESCE(NEW.fob_cost, 0) * 2;
  
  -- 2) per_unit = tariff_105 + ocean_frt + importing
  NEW.per_unit := NEW.tariff_105 + COALESCE(NEW.ocean_frt, 0) + COALESCE(NEW.importing, 0);
  
  -- 3) cost_with_shipping = per_unit + zone5_shipping
  NEW.cost_with_shipping := NEW.per_unit + COALESCE(NEW.zone5_shipping, 0);
  
  -- 4) sell_price = cost_with_shipping * multiplier
  NEW.sell_price := NEW.cost_with_shipping * COALESCE(NEW.multiplier, 1);
  
  -- 5) profit = sell_price - per_unit (final cost without shipping/markup)
  NEW.profit := NEW.sell_price - NEW.per_unit;
  
  -- 6) rounded_normal_price = floor(sell_price / 5) * 5
  NEW.rounded_normal_price := FLOOR(NEW.sell_price / 5) * 5;
  
  -- 7) list_price: Only calculate if NULL (preserve manually set values)
  IF NEW.list_price IS NULL THEN
    NEW.list_price := NEW.sell_price * 1.2;
  END IF;
  
  -- 8) black_friday_price = list_price * 0.75
  NEW.black_friday_price := NEW.list_price * 0.75;
  
  -- 9) rounded_sale_price = floor(black_friday_price / 100) * 100 - 1
  NEW.rounded_sale_price := FLOOR(NEW.black_friday_price / 100) * 100 - 1;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER compute_price_list_fields_trigger
  BEFORE INSERT OR UPDATE ON price_list_items
  FOR EACH ROW
  EXECUTE FUNCTION compute_price_list_derived_fields();

-- Backfill existing rows with profit calculation
UPDATE price_list_items
SET profit = sell_price - per_unit
WHERE profit IS NULL;
