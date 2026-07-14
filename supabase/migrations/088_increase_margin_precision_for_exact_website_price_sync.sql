-- Increase margin precision so synced website sell prices can be matched exactly.
-- Previous scale (8,4) could cause rounding drift (e.g., 3198.96 instead of 3199.00).

ALTER TABLE price_list_items
  ALTER COLUMN margin TYPE NUMERIC(12,10);

ALTER TABLE price_list_items
  ALTER COLUMN margin SET DEFAULT 0;

NOTIFY pgrst, 'reload schema';
