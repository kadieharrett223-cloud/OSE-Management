-- Delete 'note' product from price list
-- Moving 'note' functionality to a dedicated field on purchase_order_lines instead

DELETE FROM price_list_items 
WHERE LOWER(item_no) = LOWER('note') 
OR LOWER(item_no) LIKE LOWER('%note%');
