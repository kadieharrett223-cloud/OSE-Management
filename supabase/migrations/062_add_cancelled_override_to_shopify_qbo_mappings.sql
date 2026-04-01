ALTER TABLE shopify_qbo_mappings
  ALTER COLUMN qbo_invoice_id DROP NOT NULL;

ALTER TABLE shopify_qbo_mappings
  ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN NOT NULL DEFAULT FALSE;
