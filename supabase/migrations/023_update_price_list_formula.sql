-- Update pricing formula to use container constants and avoid multiplying shipping

DROP TRIGGER IF EXISTS compute_price_list_fields_trigger ON price_list_items;
DROP FUNCTION IF EXISTS compute_price_list_derived_fields();

CREATE OR REPLACE FUNCTION compute_price_list_derived_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- 1) Tariff = FOB * 2 (100%)
  NEW.tariff_105 := COALESCE(NEW.fob_cost, 0) * 2;

  -- 2) Ocean/Import per unit from container constants when quantity is provided
  IF COALESCE(NEW.quantity, 0) > 0 THEN
    NEW.ocean_frt := 3000 / NEW.quantity;
    NEW.importing := 2100 / NEW.quantity;
  ELSE
    NEW.ocean_frt := COALESCE(NEW.ocean_frt, 0);
    NEW.importing := COALESCE(NEW.importing, 0);
  END IF;

  -- 3) Cost per unit (no shipping)
  NEW.per_unit := NEW.tariff_105 + COALESCE(NEW.ocean_frt, 0) + COALESCE(NEW.importing, 0);

  -- 4) Final cost (with shipping)
  NEW.cost_with_shipping := NEW.per_unit + COALESCE(NEW.zone5_shipping, 0);

  -- 5) Sell price = (Cost * Multiplier) + Shipping
  NEW.sell_price := (NEW.per_unit * COALESCE(NEW.multiplier, 1)) + COALESCE(NEW.zone5_shipping, 0);

  -- 6) Rounded normal price = floor(sell_price / 5) * 5
  NEW.rounded_normal_price := FLOOR(NEW.sell_price / 5) * 5;

  -- 7) List price: Only calculate if NULL (preserve manual values)
  IF NEW.list_price IS NULL THEN
    NEW.list_price := NEW.sell_price * 1.2;
  END IF;

  -- 8) Black Friday and sale prices
  NEW.black_friday_price := NEW.list_price * 0.75;
  NEW.rounded_sale_price := FLOOR(NEW.black_friday_price / 100) * 100 - 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER compute_price_list_fields_trigger
  BEFORE INSERT OR UPDATE ON price_list_items
  FOR EACH ROW
  EXECUTE FUNCTION compute_price_list_derived_fields();
