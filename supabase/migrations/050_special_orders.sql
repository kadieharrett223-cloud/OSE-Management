-- Special Orders module
-- Track factory color orders, statuses, docs, and linked QBO invoices

CREATE TABLE IF NOT EXISTS special_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  order_name TEXT NOT NULL,
  customer_name TEXT,
  special_colors TEXT,
  factory_notes TEXT,
  status TEXT NOT NULL DEFAULT 'SENT_TO_FACTORY',
  expected_delivery DATE,
  qbo_invoice_id TEXT,
  qbo_invoice_number TEXT,
  created_by TEXT,
  CONSTRAINT special_orders_status_check CHECK (status IN ('SENT_TO_FACTORY', 'IN_PRODUCTION', 'ON_THE_WAY', 'DELIVERED'))
);

CREATE INDEX IF NOT EXISTS idx_special_orders_status ON special_orders(status);
CREATE INDEX IF NOT EXISTS idx_special_orders_created_at ON special_orders(created_at DESC);

ALTER TABLE special_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Special orders: read for authenticated" ON special_orders;
CREATE POLICY "Special orders: read for authenticated" ON special_orders
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Special orders: insert for authenticated" ON special_orders;
CREATE POLICY "Special orders: insert for authenticated" ON special_orders
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Special orders: update for authenticated" ON special_orders;
CREATE POLICY "Special orders: update for authenticated" ON special_orders
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Special orders: delete for authenticated" ON special_orders;
CREATE POLICY "Special orders: delete for authenticated" ON special_orders
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS special_order_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  special_order_id UUID NOT NULL REFERENCES special_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_mime_type TEXT,
  file_path TEXT NOT NULL UNIQUE,
  upload_notes TEXT,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_special_order_documents_order_id
  ON special_order_documents(special_order_id);

ALTER TABLE special_order_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Special order documents: read for authenticated" ON special_order_documents;
CREATE POLICY "Special order documents: read for authenticated" ON special_order_documents
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Special order documents: insert for authenticated" ON special_order_documents;
CREATE POLICY "Special order documents: insert for authenticated" ON special_order_documents
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Special order documents: update for authenticated" ON special_order_documents;
CREATE POLICY "Special order documents: update for authenticated" ON special_order_documents
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Special order documents: delete for authenticated" ON special_order_documents;
CREATE POLICY "Special order documents: delete for authenticated" ON special_order_documents
  FOR DELETE USING (auth.role() = 'authenticated');

INSERT INTO storage.buckets (id, name, public)
VALUES ('special-order-documents', 'special-order-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload special order documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload special order documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'special-order-documents' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read special order documents" ON storage.objects;
CREATE POLICY "Authenticated users can read special order documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'special-order-documents' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update special order documents" ON storage.objects;
CREATE POLICY "Authenticated users can update special order documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'special-order-documents' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'special-order-documents' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete special order documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete special order documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'special-order-documents' AND auth.role() = 'authenticated');