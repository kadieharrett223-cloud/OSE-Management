-- OSE Management Multi-User Dashboard Schema
-- Supabase PostgreSQL Database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (linked to Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'rep')),
  rep_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sales Reps table
CREATE TABLE reps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rep_name TEXT UNIQUE NOT NULL, -- Must match QBO Sales Rep field exactly
  qbo_rep_code TEXT UNIQUE,
  commission_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.05, -- e.g., 0.05 = 5%
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Price List Items (SKU mapping with shipping deduction)
CREATE TABLE price_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  description TEXT,
  current_sale_price_per_unit NUMERIC(12, 2) NOT NULL,
  shipping_included_per_unit NUMERIC(12, 2) NOT NULL, -- CRITICAL: commission deduction
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoices (synced from QuickBooks Online)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qbo_invoice_id TEXT UNIQUE NOT NULL,
  invoice_number TEXT NOT NULL,
  rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
  txn_date DATE NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  commission_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  commissionable_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  shipping_deducted_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoice Lines (line-by-line detail)
CREATE TABLE invoice_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  qbo_line_id TEXT,
  line_num INTEGER NOT NULL,
  sku TEXT,
  description TEXT,
  quantity NUMERIC(12, 4) NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  line_total NUMERIC(12, 2) NOT NULL,
  shipping_deducted NUMERIC(12, 2) NOT NULL DEFAULT 0,
  commissionable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sku_match_status TEXT NOT NULL DEFAULT 'NEEDS_MAPPING' CHECK (sku_match_status IN ('MATCHED', 'NEEDS_MAPPING')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Commission Snapshots (monthly aggregates for fast dashboard reads)
CREATE TABLE commission_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  total_commission NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_commissionable NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_shipping_deducted NUMERIC(12, 2) NOT NULL DEFAULT 0,
  invoice_count INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rep_id, year, month)
);

-- Indexes for performance
CREATE INDEX idx_invoices_rep_id ON invoices(rep_id);
CREATE INDEX idx_invoices_txn_date ON invoices(txn_date);
CREATE INDEX idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
CREATE INDEX idx_invoice_lines_sku ON invoice_lines(sku);
CREATE INDEX idx_commission_snapshots_rep_year_month ON commission_snapshots(rep_id, year, month);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_rep_id ON users(rep_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_snapshots ENABLE ROW LEVEL SECURITY;

-- Users: Admins see all, reps see only themselves
CREATE POLICY "Users: Admins can view all" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Users: Reps can view themselves" ON users
  FOR SELECT USING (auth.uid() = id);

-- Reps: Admins see all, reps see only their own record
CREATE POLICY "Reps: Admins can manage all" ON reps
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Reps: Reps can view their own record" ON reps
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.rep_id = reps.id)
  );

-- Price List: Admins can manage, reps can read
CREATE POLICY "Price List: Admins can manage all" ON price_list_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Price List: Reps can view all" ON price_list_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'rep')
  );

-- Invoices: Admins see all, reps see only their own
CREATE POLICY "Invoices: Admins can view all" ON invoices
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Invoices: Reps can view their own" ON invoices
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.rep_id = invoices.rep_id)
  );

-- Invoice Lines: Admins see all, reps see only their invoice lines
CREATE POLICY "Invoice Lines: Admins can view all" ON invoice_lines
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Invoice Lines: Reps can view their own" ON invoice_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      JOIN invoices ON invoices.rep_id = users.rep_id
      WHERE users.id = auth.uid() AND invoice_lines.invoice_id = invoices.id
    )
  );

-- Commission Snapshots: Admins see all, reps see only their own
CREATE POLICY "Commission Snapshots: Admins can view all" ON commission_snapshots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Commission Snapshots: Reps can view their own" ON commission_snapshots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.rep_id = commission_snapshots.rep_id)
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reps_updated_at BEFORE UPDATE ON reps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_list_items_updated_at BEFORE UPDATE ON price_list_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoice_lines_updated_at BEFORE UPDATE ON invoice_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_snapshots_updated_at BEFORE UPDATE ON commission_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
