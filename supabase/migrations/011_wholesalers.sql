-- Wholesalers table for managing client relationships

-- Drop existing table and recreate with correct schema
DROP TABLE IF EXISTS wholesalers CASCADE;

CREATE TABLE wholesalers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Basic Info
  company_name TEXT NOT NULL,
  contact_name TEXT,
  
  -- Contact Information
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  
  -- Commission/Margin
  commission_percentage NUMERIC(5, 2), -- e.g., 5.00 for 5%
  
  -- Notes
  notes TEXT,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  UNIQUE (company_name)
);

-- Index for quick lookups
CREATE INDEX idx_wholesalers_company_name ON wholesalers(company_name);
CREATE INDEX idx_wholesalers_is_active ON wholesalers(is_active);

-- RLS Policies
ALTER TABLE wholesalers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wholesalers: Allow all for authenticated users" ON wholesalers
  FOR ALL USING (TRUE);

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_wholesalers_updated_at BEFORE UPDATE ON wholesalers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
