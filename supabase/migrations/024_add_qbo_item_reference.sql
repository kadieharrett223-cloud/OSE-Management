-- Add QBO item reference to price_list_items
-- This allows matching price list items to actual QuickBooks inventory

ALTER TABLE price_list_items
ADD COLUMN qbo_item_id TEXT,
ADD COLUMN qbo_item_name TEXT,
ADD COLUMN last_synced_with_qbo TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX idx_price_list_items_qbo_item_id ON price_list_items(qbo_item_id);
CREATE INDEX idx_price_list_items_qbo_item_name ON price_list_items(qbo_item_name);

-- Add comment explaining the purpose
COMMENT ON COLUMN price_list_items.qbo_item_id IS 'QuickBooks Online item ID for direct product matching';
COMMENT ON COLUMN price_list_items.qbo_item_name IS 'QuickBooks Online item name (cached for reference)';
COMMENT ON COLUMN price_list_items.last_synced_with_qbo IS 'Timestamp of last sync with QBO inventory';
