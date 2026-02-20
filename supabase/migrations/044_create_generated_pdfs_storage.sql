-- Create storage bucket for auto-generated PO PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-po-pdfs', 'generated-po-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload generated PDFs
CREATE POLICY "Allow authenticated uploads to generated-po-pdfs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'generated-po-pdfs');

-- Allow public read access to generated PDFs
CREATE POLICY "Allow public read access to generated-po-pdfs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'generated-po-pdfs');

-- Allow authenticated users to update their generated PDFs
CREATE POLICY "Allow authenticated updates to generated-po-pdfs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'generated-po-pdfs')
WITH CHECK (bucket_id = 'generated-po-pdfs');

-- Allow authenticated users to delete generated PDFs
CREATE POLICY "Allow authenticated deletes from generated-po-pdfs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'generated-po-pdfs');
