-- Manual mappings between Shopify orders and QBO invoices
-- Used when auto-matching fails (different customer names, missing PO #, etc.)
CREATE TABLE IF NOT EXISTS shopify_qbo_mappings (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_order_id    TEXT        NOT NULL UNIQUE,
  shopify_order_number TEXT       NOT NULL,
  qbo_invoice_id      TEXT        NOT NULL,
  qbo_doc_number      TEXT,
  qbo_customer_name   TEXT,
  mapped_by           TEXT,
  note                TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: allow authenticated reads/writes (service role bypasses RLS)
ALTER TABLE shopify_qbo_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_authenticated" ON shopify_qbo_mappings
  FOR ALL USING (true) WITH CHECK (true);
