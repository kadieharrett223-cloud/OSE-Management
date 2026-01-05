-- Combine "2 Post Accessories" into "2-POST LIFTS" category

DO $$
DECLARE
  cat_2post UUID;
  cat_2post_acc UUID;
BEGIN
  -- Get the category IDs
  SELECT id INTO cat_2post FROM price_list_categories WHERE category_name = '2-POST LIFTS';
  SELECT id INTO cat_2post_acc FROM price_list_categories WHERE category_name = '2 Post Accessories';
  
  -- Move all "2 Post Accessories" items to "2-POST LIFTS"
  UPDATE price_list_items
  SET category_id = cat_2post
  WHERE category_id = cat_2post_acc;
  
  -- Delete the "2 Post Accessories" category
  DELETE FROM price_list_categories WHERE id = cat_2post_acc;
  
END $$;
