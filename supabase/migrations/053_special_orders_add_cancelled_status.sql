-- Allow cancelled status for special orders
ALTER TABLE special_orders
DROP CONSTRAINT IF EXISTS special_orders_status_check;

ALTER TABLE special_orders
ADD CONSTRAINT special_orders_status_check
CHECK (status IN ('SENT_TO_FACTORY', 'IN_PRODUCTION', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED'));
