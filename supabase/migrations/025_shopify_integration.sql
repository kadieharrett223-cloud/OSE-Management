-- Add Shopify tokens storage table
CREATE TABLE IF NOT EXISTS shopify_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE shopify_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies (allow server access)
CREATE POLICY "Allow service role full access to shopify_tokens"
  ON shopify_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add sync logs table
CREATE TABLE IF NOT EXISTS shopify_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  errors JSONB,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE shopify_sync_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (allow server access)
CREATE POLICY "Allow service role full access to shopify_sync_logs"
  ON shopify_sync_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
