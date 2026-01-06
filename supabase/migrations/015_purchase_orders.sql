-- Purchase Orders and Payments tracking

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  po_number TEXT NOT NULL UNIQUE,
  vendor_name TEXT NOT NULL,
  vendor_address TEXT,
  vendor_city_state_zip TEXT,
  vendor_contact_name TEXT,
  vendor_email TEXT,
  vendor_phone TEXT,
  ship_to_name TEXT,
  ship_to_address TEXT,
  ship_to_city_state_zip TEXT,
  representative TEXT,
  authorized_by TEXT,
  destination TEXT,
  terms TEXT,
  payment_method TEXT,
  order_date DATE NOT NULL,
  expected_delivery DATE,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, RECEIVED, CANCELLED
  notes TEXT,
  created_by_user_id TEXT
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  sku TEXT,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  line_total NUMERIC(14,2) NOT NULL,
  UNIQUE (purchase_order_id, line_number)
);

CREATE TABLE IF NOT EXISTS purchase_order_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  payment_method TEXT, -- CHECK, WIRE, CREDIT_CARD, ACH, etc.
  reference_number TEXT,
  notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_po_vendor_name ON purchase_orders(vendor_name);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_order_date ON purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_po_lines_po_id ON purchase_order_lines(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_payments_po_id ON purchase_order_payments(purchase_order_id);

-- RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Purchase orders: read for authenticated" ON purchase_orders
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Purchase order lines: read for authenticated" ON purchase_order_lines
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Purchase order payments: read for authenticated" ON purchase_order_payments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Triggers
CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  address TEXT,
  city_state_zip TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  terms TEXT, -- e.g., "30% advance"
  payment_method TEXT, -- e.g., "WT"
  ship_to_name TEXT,
  ship_to_address TEXT,
  ship_to_city_state_zip TEXT
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Suppliers: read for authenticated" ON suppliers
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Suppliers: insert for authenticated" ON suppliers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Suppliers: update for authenticated" ON suppliers
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON suppliers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
