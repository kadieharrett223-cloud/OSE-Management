-- Extend Shopify settings to support Shopify -> QuickBooks order sync automation
ALTER TABLE shopify_settings
  ADD COLUMN IF NOT EXISTS order_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS order_sync_financial_statuses TEXT[] NOT NULL DEFAULT ARRAY['paid'],
  ADD COLUMN IF NOT EXISTS qbo_default_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS qbo_default_item_id TEXT,
  ADD COLUMN IF NOT EXISTS qbo_shipping_item_id TEXT,
  ADD COLUMN IF NOT EXISTS qbo_payment_method_id TEXT,
  ADD COLUMN IF NOT EXISTS qbo_payment_method_name TEXT NOT NULL DEFAULT 'Shopify',
  ADD COLUMN IF NOT EXISTS qbo_deposit_account_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_mapping_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS line_item_mapping_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_send_to_email TEXT,
  ADD COLUMN IF NOT EXISTS send_summary_email BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS create_missing_customers BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_order_sync_at TIMESTAMPTZ;

-- Log each order sync run and outcomes
CREATE TABLE IF NOT EXISTS shopify_order_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  synced_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  since_timestamp TIMESTAMPTZ,
  trigger_source TEXT,
  recipient_email TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE shopify_order_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to shopify_order_sync_logs"
  ON shopify_order_sync_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);