-- Chinese Invoices Log
-- Tracks invoices received from factories to confirm POs
-- Typically one or two invoices per purchase order

CREATE TABLE IF NOT EXISTS chinese_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  factory_name TEXT,
  total_amount NUMERIC(14,2),
  currency TEXT DEFAULT 'CNY', -- Chinese Yuan by default
  payment_status TEXT DEFAULT 'RECEIVED', -- RECEIVED, PROCESSED, PAID, etc.
  invoice_file_path TEXT, -- Path to stored PDF or image
  notes TEXT,
  created_by_user_id TEXT,
  UNIQUE (purchase_order_id, invoice_number)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_chinese_invoices_po_id ON chinese_invoices(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_chinese_invoices_invoice_number ON chinese_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_chinese_invoices_invoice_date ON chinese_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_chinese_invoices_payment_status ON chinese_invoices(payment_status);

-- RLS
ALTER TABLE chinese_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chinese invoices: read for authenticated" ON chinese_invoices
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Chinese invoices: insert for authenticated" ON chinese_invoices
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Chinese invoices: update for authenticated" ON chinese_invoices
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Chinese invoices: delete for authenticated" ON chinese_invoices
  FOR DELETE USING (auth.role() = 'authenticated');

-- Trigger to update updated_at
CREATE TRIGGER update_chinese_invoices_updated_at
BEFORE UPDATE ON chinese_invoices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
