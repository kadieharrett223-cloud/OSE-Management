-- Add Hangzhou Yizhan Technology supplier
INSERT INTO suppliers (
  name,
  address,
  city_state_zip,
  contact_name,
  terms,
  payment_method,
  ship_to_name,
  ship_to_city_state_zip
)
SELECT
  'HANGZHOU YIZHAN TECHNOLOGY CO.,LTD.',
  'Fuyang District',
  'Hangzhou City, Zhejiang Province',
  'Sara',
  '30% Advance',
  'Wire Transfer',
  'Port of Seattle',
  'Port of Seattle, Washington'
WHERE NOT EXISTS (
  SELECT 1 FROM suppliers WHERE lower(name) = lower('HANGZHOU YIZHAN TECHNOLOGY CO.,LTD.')
);
