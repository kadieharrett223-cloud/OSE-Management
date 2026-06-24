-- Add emailed status fields to replacement parts records

ALTER TABLE replacement_parts
ADD COLUMN IF NOT EXISTS emailed_to_customer BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_replacement_parts_emailed_to_customer
  ON replacement_parts(emailed_to_customer);
