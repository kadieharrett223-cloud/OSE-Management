-- Consolidate 4PHR-9X duplicate entries, keeping the one with the longest description

-- Update any lowercase variant to uppercase and use the longer description
UPDATE price_list_items 
SET description = 'Gold Series 4 post High Rise Storage lift, 9,000 lb capacity, min 184" runways, min 87,67" drive through, min 78" storage space resting on top lock, tool tray, 3 drip trays, caster arms, pullies cables and hoses factory installed, 110v 60hz 2.2kw power, palletize tool tray and power unit seperately'
WHERE LOWER(item_no) = '4phr-9x' AND item_no != '4PHR-9X';

-- Delete any duplicate entries (case-insensitive), keeping only the first one
DELETE FROM price_list_items
WHERE LOWER(item_no) = '4phr-9x'
AND id NOT IN (
  SELECT id FROM price_list_items
  WHERE LOWER(item_no) = '4phr-9x'
  ORDER BY created_at ASC NULLS LAST, id ASC
  LIMIT 1
);
