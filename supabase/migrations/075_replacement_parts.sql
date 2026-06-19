-- Replacement Parts module
-- Track replacement part requests, shipment tracking, and linked QBO invoices

CREATE TABLE IF NOT EXISTS replacement_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  part_name TEXT NOT NULL,
  customer_name TEXT,
  request_notes TEXT,
  internal_notes TEXT,
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  tracking_carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  tracking_status TEXT,
  shipped_at DATE,
  delivered_at DATE,
  qbo_invoice_id TEXT,
  qbo_invoice_number TEXT,
  created_by TEXT,
  CONSTRAINT replacement_parts_status_check CHECK (
    status IN ('REQUESTED', 'ORDERED', 'SHIPPED', 'DELIVERED', 'CANCELLED')
  )
);

CREATE INDEX IF NOT EXISTS idx_replacement_parts_status
  ON replacement_parts(status);

CREATE INDEX IF NOT EXISTS idx_replacement_parts_created_at
  ON replacement_parts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_replacement_parts_invoice_number
  ON replacement_parts(qbo_invoice_number);

ALTER TABLE replacement_parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Replacement parts: read for authenticated" ON replacement_parts;
CREATE POLICY "Replacement parts: read for authenticated" ON replacement_parts
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Replacement parts: insert for authenticated" ON replacement_parts;
CREATE POLICY "Replacement parts: insert for authenticated" ON replacement_parts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Replacement parts: update for authenticated" ON replacement_parts;
CREATE POLICY "Replacement parts: update for authenticated" ON replacement_parts
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Replacement parts: delete for authenticated" ON replacement_parts;
CREATE POLICY "Replacement parts: delete for authenticated" ON replacement_parts
  FOR DELETE USING (auth.role() = 'authenticated');
