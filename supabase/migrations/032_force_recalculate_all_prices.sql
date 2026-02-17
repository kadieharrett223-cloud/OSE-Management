-- Force recalculation of all price list items with the new formula
-- This triggers the BEFORE UPDATE trigger on all rows by doing a no-op update

UPDATE price_list_items
SET fob_cost = fob_cost
WHERE item_no IS NOT NULL;
