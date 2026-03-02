-- Add internal tracking fields for Special Orders
ALTER TABLE special_orders
ADD COLUMN IF NOT EXISTS internal_notes TEXT,
ADD COLUMN IF NOT EXISTS internal_updates TEXT;
