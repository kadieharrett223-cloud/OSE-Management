-- Create table for purchase order payment schedules and notes

CREATE TABLE IF NOT EXISTS purchase_order_payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id TEXT NOT NULL,
  po_number TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  amount NUMERIC(12,2),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_po_payment_schedules_event_date
  ON purchase_order_payment_schedules (event_date);

CREATE INDEX IF NOT EXISTS idx_po_payment_schedules_po_id
  ON purchase_order_payment_schedules (po_id);

CREATE INDEX IF NOT EXISTS idx_po_payment_schedules_is_active
  ON purchase_order_payment_schedules (is_active);
