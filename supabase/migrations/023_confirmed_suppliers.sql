-- Add/standardize confirmed suppliers (Highlift, Hiker, Yizhan)
-- Ensures records exist with consistent naming and contact info

-- Highlift upsert/update
WITH updated AS (
  UPDATE suppliers
  SET
    name = 'Highlift',
    address = 'No. 139 East Jinniushan Street\nYingkou, Liaoning Province\nChina',
    city_state_zip = 'Yingkou, Liaoning Province, China',
    contact_name = 'Mila',
    representative = 'Mila',
    email = 'mila@high-lift.cn',
    terms = COALESCE(terms, '30% advance'),
    payment_method = COALESCE(payment_method, 'Wire Transfer')
  WHERE lower(name) IN ('highlift', 'high-lift', 'high lift')
  RETURNING id
)
INSERT INTO suppliers (
  name,
  address,
  city_state_zip,
  contact_name,
  representative,
  email,
  terms,
  payment_method
)
SELECT
  'Highlift',
  'No. 139 East Jinniushan Street\nYingkou, Liaoning Province\nChina',
  'Yingkou, Liaoning Province, China',
  'Mila',
  'Mila',
  'mila@high-lift.cn',
  '30% advance',
  'Wire Transfer'
WHERE NOT EXISTS (
  SELECT 1 FROM suppliers WHERE lower(name) IN ('highlift', 'high-lift', 'high lift')
);

-- Qingdao Hiker Machinery (Hiker / HikerLift) upsert/update
WITH updated AS (
  UPDATE suppliers
  SET
    name = 'Qingdao Hiker Machinery Co., Ltd.',
    address = 'Qingdao, China',
    city_state_zip = 'Qingdao, China',
    contact_name = 'Vicky Cao',
    representative = 'Vicky Cao',
    email = 'vicky.cao@hikerlift.com',
    phone = '+86 150 6302 7988 (Mobile/WhatsApp); Skype: vickycao.china',
    payment_method = COALESCE(payment_method, 'Wire Transfer')
  WHERE lower(name) IN ('qingdao hiker machinery co., ltd.', 'hiker', 'hikerlift', 'hiker lift')
  RETURNING id
)
INSERT INTO suppliers (
  name,
  address,
  city_state_zip,
  contact_name,
  representative,
  email,
  phone,
  payment_method
)
SELECT
  'Qingdao Hiker Machinery Co., Ltd.',
  'Qingdao, China',
  'Qingdao, China',
  'Vicky Cao',
  'Vicky Cao',
  'vicky.cao@hikerlift.com',
  '+86 150 6302 7988 (Mobile/WhatsApp); Skype: vickycao.china',
  'Wire Transfer'
WHERE NOT EXISTS (
  SELECT 1 FROM suppliers WHERE lower(name) IN ('qingdao hiker machinery co., ltd.', 'hiker', 'hikerlift', 'hiker lift')
);

-- Standardize Yizhan naming (handle Yizan/Yizhan Machinery variations)
UPDATE suppliers
SET
  name = 'Yizhan Machinery',
  address = COALESCE(address, 'China'),
  city_state_zip = COALESCE(city_state_zip, 'China'),
  contact_name = COALESCE(contact_name, 'Sara'),
  terms = COALESCE(terms, '30% Advance'),
  payment_method = COALESCE(payment_method, 'Wire Transfer')
WHERE lower(name) IN (
  'hangzhou yizhan technology co.,ltd.',
  'yizhan',
  'yizan',
  'yizhan machinery'
);
