-- Remove requested_by from replacement_parts
-- requested_by is no longer used in UI/API

ALTER TABLE replacement_parts
DROP COLUMN IF EXISTS requested_by;