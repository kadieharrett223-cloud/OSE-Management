-- Add container assignment field for special orders
ALTER TABLE special_orders
ADD COLUMN IF NOT EXISTS container_name TEXT;
