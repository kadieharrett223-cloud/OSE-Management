-- Update suppliers schema: add representative, keep ship_to columns unused
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS representative TEXT;
