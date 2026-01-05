-- Enhanced Price List Schema with Categories and Versioning
-- This extends the existing price_list_items table to store full Excel pricing data

-- Categories/Sections table
CREATE TABLE price_list_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_name TEXT UNIQUE NOT NULL,
  display_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drop and recreate price_list_items with full pricing columns
DROP TABLE IF EXISTS price_list_items CASCADE;

CREATE TABLE price_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Versioning
  version_tag TEXT NOT NULL DEFAULT '2025-04-25',
  as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Category
  category_id UUID REFERENCES price_list_categories(id) ON DELETE SET NULL,
  
  -- Core identifiers
  item_no TEXT NOT NULL, -- SKU like "2PBP-8"
  description TEXT,
  supplier TEXT,
  
  -- INPUT FIELDS (stored from Excel)
  fob_cost NUMERIC(12, 2),
  quantity NUMERIC(12, 4), -- Optional reference qty
  ocean_frt NUMERIC(12, 2),
  importing NUMERIC(12, 2),
  zone5_shipping NUMERIC(12, 2), -- Shipping included per unit (for commission deduction)
  multiplier NUMERIC(8, 4),
  
  -- DERIVED FIELDS (computed, but stored for quick access)
  tariff_105 NUMERIC(12, 2), -- fob_cost * 2
  per_unit NUMERIC(12, 2), -- tariff_105 + ocean_frt + importing
  cost_with_shipping NUMERIC(12, 2), -- per_unit + zone5_shipping
  sell_price NUMERIC(12, 2), -- cost_with_shipping * multiplier
  rounded_normal_price NUMERIC(12, 2), -- floor(sell_price, 5)
  list_price NUMERIC(12, 2), -- sell_price * 1.2
  black_friday_price NUMERIC(12, 2), -- list_price * 0.75
  rounded_sale_price NUMERIC(12, 2), -- floor(black_friday_price, 100) - 1
  
  -- Aliases for commission system (computed from above)
  current_sale_price_per_unit NUMERIC(12, 2) GENERATED ALWAYS AS (rounded_sale_price) STORED,
  shipping_included_per_unit NUMERIC(12, 2) GENERATED ALWAYS AS (zone5_shipping) STORED,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint on SKU + version
  UNIQUE (item_no, version_tag)
);

-- Indexes
CREATE INDEX idx_price_list_items_item_no ON price_list_items(item_no);
CREATE INDEX idx_price_list_items_version ON price_list_items(version_tag);
CREATE INDEX idx_price_list_items_category ON price_list_items(category_id);
CREATE INDEX idx_price_list_items_active ON price_list_items(is_active);

-- RLS Policies
ALTER TABLE price_list_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories: Admins can manage all" ON price_list_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Categories: Reps can view all" ON price_list_categories
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'rep')
  );

-- Re-enable RLS on price_list_items
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Price List: Admins can manage all" ON price_list_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Price List: Reps can view all" ON price_list_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'rep')
  );

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_price_list_items_updated_at BEFORE UPDATE ON price_list_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to compute derived fields
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

-- Trigger to auto-compute derived fields on insert/update
CREATE TRIGGER compute_price_list_fields_trigger
  BEFORE INSERT OR UPDATE ON price_list_items
  FOR EACH ROW
  EXECUTE FUNCTION compute_price_list_derived_fields();

-- Insert categories
INSERT INTO price_list_categories (category_name, display_order) VALUES
  ('2-POST LIFTS', 1),
  ('2 Post Accessories', 2),
  ('4-POST LIFTS', 3),
  ('Scissor Lifts', 4),
  ('Tire Machines', 5),
  ('Wheel Balancers', 6),
  ('Alignment Machines', 7),
  ('Shop Equipment', 8),
  ('Motorcycle Lifts', 9),
  ('Bundles', 10),
  ('Accessories', 11);
