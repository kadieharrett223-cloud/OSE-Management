-- Purchase Order change log table
-- Stores exact field-level changes with timestamp for PO detail view

CREATE TABLE IF NOT EXISTS purchase_order_change_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
  changed_by TEXT,
  event_type TEXT NOT NULL DEFAULT 'UPDATED',
  changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_po_change_logs_po_id ON purchase_order_change_logs(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_change_logs_created_at ON purchase_order_change_logs(created_at DESC);

ALTER TABLE purchase_order_change_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PO change logs: read for authenticated" ON purchase_order_change_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "PO change logs: insert for authenticated" ON purchase_order_change_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
