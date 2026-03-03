-- Ensure the generated-po-pdfs bucket is public
UPDATE storage.buckets
SET public = true
WHERE id = 'generated-po-pdfs';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to generated-po-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to generated-po-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to generated-po-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from generated-po-pdfs" ON storage.objects;

-- Recreate policies
CREATE POLICY "Allow public read access to generated-po-pdfs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'generated-po-pdfs');

CREATE POLICY "Allow authenticated uploads to generated-po-pdfs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'generated-po-pdfs');

CREATE POLICY "Allow authenticated updates to generated-po-pdfs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'generated-po-pdfs')
WITH CHECK (bucket_id = 'generated-po-pdfs');

CREATE POLICY "Allow authenticated deletes from generated-po-pdfs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'generated-po-pdfs');
