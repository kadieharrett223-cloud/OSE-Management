-- Set current global tariff percent to 34.
-- This updates the live setting and leaves it unchanged until an admin explicitly saves a new value.

INSERT INTO pricing_settings (id, global_tariff_percent, updated_at)
VALUES ('00000000-0000-0000-0000-000000000002', 34, NOW())
ON CONFLICT (id)
DO UPDATE SET
  global_tariff_percent = 34,
  updated_at = NOW();

NOTIFY pgrst, 'reload schema';
