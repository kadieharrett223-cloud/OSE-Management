-- Create auth_users table for manual user management
CREATE TABLE IF NOT EXISTS auth_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL, -- Store passwords in plain text for simplicity (or use bcrypt if preferred)
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'rep')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;

-- Create policies (allow service role full access)
CREATE POLICY "Allow service role full access to auth_users"
  ON auth_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert initial admin user (change password after first login!)
INSERT INTO auth_users (email, password, role)
VALUES ('admin@olympic-equipment.com', 'ChangeMe123!', 'admin')
ON CONFLICT (email) DO NOTHING;
