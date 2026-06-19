-- Remove tracking_carrier from replacement_parts
-- tracking links/status now rely on tracking_number and dates

ALTER TABLE replacement_parts
DROP COLUMN IF EXISTS tracking_carrier;
