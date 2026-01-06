-- Ensure suppliers table exists (in case previous migration hasn't run)
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  address TEXT,
  city_state_zip TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  terms TEXT,
  payment_method TEXT,
  ship_to_name TEXT,
  ship_to_address TEXT,
  ship_to_city_state_zip TEXT
);

INSERT INTO suppliers (
  name,
  address,
  city_state_zip,
  contact_name,
  representative,
  email,
  phone,
  terms,
  payment_method
)
SELECT
  'highlift',
  'No. 139 East Jinniushan Street, Yingkou\nLiaoning Province China',
  'Liaoning Province China',
  'Mila J.',
  'Mila J.',
  'mila@high-lift.cn',
  '',
  '30% advance',
  'WT'
WHERE NOT EXISTS (
  SELECT 1 FROM suppliers WHERE lower(name) = lower('highlift')
);
