-- Add a website URL field so each price list item can link to its website product page.
ALTER TABLE price_list_items
ADD COLUMN IF NOT EXISTS website_product_url TEXT;

COMMENT ON COLUMN price_list_items.website_product_url IS 'Website product URL for this SKU (e.g., Shopify storefront URL)';

NOTIFY pgrst, 'reload schema';
