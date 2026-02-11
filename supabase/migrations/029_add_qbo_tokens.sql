-- Create qbo_tokens table for multi-tenant QuickBooks OAuth support
CREATE TABLE IF NOT EXISTS qbo_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  realm_id TEXT,
  token_type TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  refresh_expires_at TIMESTAMP WITH TIME ZONE,
  state TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add user_id column if it doesn't exist (for idempotency)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'qbo_tokens' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE qbo_tokens ADD COLUMN user_id TEXT;
  END IF;
END $$;

-- Add unique constraint for user_id to prevent duplicate per-user tokens
CREATE UNIQUE INDEX IF NOT EXISTS idx_qbo_tokens_user_id ON qbo_tokens(user_id) WHERE user_id IS NOT NULL;

-- Add index for the global "primary" token
CREATE UNIQUE INDEX IF NOT EXISTS idx_qbo_tokens_primary ON qbo_tokens(id) WHERE id = 'primary';

-- Enable RLS if not already enabled
ALTER TABLE qbo_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own tokens (drop first if exists to ensure idempotency)
DROP POLICY IF EXISTS "Users can read their own QBO tokens" ON qbo_tokens;
CREATE POLICY "Users can read their own QBO tokens"
  ON qbo_tokens
  FOR SELECT
  USING (
    auth.uid()::TEXT = user_id OR id = 'primary'
  );

-- Create policy to allow users to update their own tokens
DROP POLICY IF EXISTS "Users can update their own QBO tokens" ON qbo_tokens;
CREATE POLICY "Users can update their own QBO tokens"
  ON qbo_tokens
  FOR UPDATE
  USING (
    auth.uid()::TEXT = user_id OR id = 'primary'
  )
  WITH CHECK (
    auth.uid()::TEXT = user_id OR id = 'primary'
  );

-- Create policy to allow users to insert their own tokens
DROP POLICY IF EXISTS "Users can insert their own QBO tokens" ON qbo_tokens;
CREATE POLICY "Users can insert their own QBO tokens"
  ON qbo_tokens
  FOR INSERT
  WITH CHECK (
    auth.uid()::TEXT = user_id OR id = 'primary'
  );

-- Create policy to allow users to delete their own tokens
DROP POLICY IF EXISTS "Users can delete their own QBO tokens" ON qbo_tokens;
CREATE POLICY "Users can delete their own QBO tokens"
  ON qbo_tokens
  FOR DELETE
  USING (
    auth.uid()::TEXT = user_id OR id = 'primary'
  );

COMMENT ON TABLE qbo_tokens IS 'Stores OAuth tokens for QuickBooks Online connections, supporting both global (id=primary) and per-user (user_id set) token storage';
COMMENT ON COLUMN qbo_tokens.id IS 'Primary identifier (primary for global token, or user_id for per-user tokens)';
COMMENT ON COLUMN qbo_tokens.user_id IS 'User ID from auth_users table; NULL for global primary token';
COMMENT ON COLUMN qbo_tokens.access_token IS 'OAuth access token for API requests';
COMMENT ON COLUMN qbo_tokens.refresh_token IS 'OAuth refresh token for token renewal';
COMMENT ON COLUMN qbo_tokens.realm_id IS 'QuickBooks realm (company) ID';
COMMENT ON COLUMN qbo_tokens.expires_at IS 'Expiry timestamp for access token';
COMMENT ON COLUMN qbo_tokens.refresh_expires_at IS 'Expiry timestamp for refresh token';
