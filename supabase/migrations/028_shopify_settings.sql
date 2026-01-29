-- Shopify settings for filtering visible collections
CREATE TABLE IF NOT EXISTS shopify_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  allowed_collection_ids TEXT[] DEFAULT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE shopify_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to shopify_settings"
  ON shopify_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
