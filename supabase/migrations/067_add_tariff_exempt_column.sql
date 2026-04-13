-- Add tariff_exempt column to price_list_items
-- Tariff exempt items skip tariff, ocean, and importing calculations
-- Only use FOB + Shipping for cost calculation

ALTER TABLE price_list_items
ADD COLUMN tariff_exempt BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for filtering
CREATE INDEX idx_price_list_items_tariff_exempt ON price_list_items(tariff_exempt);

-- Update the compute_price_list_derived_fields function to handle tariff exempt items
CREATE OR REPLACE FUNCTION compute_price_list_derived_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tariff_exempt THEN
    -- Tariff exempt calculation: FOB + Shipping only, no tariff/ocean/importing
    NEW.tariff_105 := 0;
    NEW.per_unit := COALESCE(NEW.fob_cost, 0) + COALESCE(NEW.ocean_frt, 0) + COALESCE(NEW.importing, 0);
    NEW.cost_with_shipping := NEW.per_unit + COALESCE(NEW.zone5_shipping, 0);
  ELSE
    -- Normal calculation with tariff (FOB × 2) + ocean + importing
    NEW.tariff_105 := COALESCE(NEW.fob_cost, 0) * 2;
    NEW.per_unit := NEW.tariff_105 + COALESCE(NEW.ocean_frt, 0) + COALESCE(NEW.importing, 0);
    NEW.cost_with_shipping := NEW.per_unit + COALESCE(NEW.zone5_shipping, 0);
  END IF;
  
  -- 4) sell_price = cost_with_shipping * multiplier
  NEW.sell_price := NEW.cost_with_shipping * COALESCE(NEW.multiplier, 1);
  
  -- 5) rounded_normal_price = floor(sell_price / 5) * 5
  NEW.rounded_normal_price := FLOOR(NEW.sell_price / 5) * 5;
  
  -- 6) list_price = sell_price * 1.2
  NEW.list_price := NEW.sell_price * 1.2;
  
  -- 7) black_friday_price = list_price * 0.75
  NEW.black_friday_price := NEW.list_price * 0.75;
  
  -- 8) rounded_sale_price = floor(black_friday_price / 100) * 100 - 1
  NEW.rounded_sale_price := FLOOR(NEW.black_friday_price / 100) * 100 - 1;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
