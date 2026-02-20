-- Add column to track auto-generated PDF for each PO
ALTER TABLE purchase_orders
ADD COLUMN generated_pdf_path TEXT;

-- Add index for filtering POs with generated PDFs
CREATE INDEX IF NOT EXISTS idx_purchase_orders_generated_pdf_path ON purchase_orders(generated_pdf_path);
