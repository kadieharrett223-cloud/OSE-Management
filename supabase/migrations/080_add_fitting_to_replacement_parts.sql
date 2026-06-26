-- Add fitting replacement marker to replacement parts

ALTER TABLE replacement_parts
ADD COLUMN IF NOT EXISTS fitting BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_replacement_parts_fitting
  ON replacement_parts(fitting);
