-- Ensure purchase_order_payment_schedules exists in production environments
-- where migration 066 may have been skipped.

CREATE TABLE IF NOT EXISTS public.purchase_order_payment_schedules (
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
  ON public.purchase_order_payment_schedules (event_date);

CREATE INDEX IF NOT EXISTS idx_po_payment_schedules_po_id
  ON public.purchase_order_payment_schedules (po_id);

CREATE INDEX IF NOT EXISTS idx_po_payment_schedules_is_active
  ON public.purchase_order_payment_schedules (is_active);

NOTIFY pgrst, 'reload schema';
