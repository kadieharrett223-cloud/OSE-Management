-- First, let's see what policies exist
-- Run this to view existing policies:
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

-- Drop all existing policies on storage.objects for chinese-po-files
DROP POLICY IF EXISTS "Allow service role to read chinese PO files" ON storage.objects;
DROP POLICY IF EXISTS "Allow reading chinese PO files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to read chinese PO files" ON storage.objects;

-- Create a single clear policy for reading chinese-po-files
CREATE POLICY "chinese_po_files_read_access"
ON storage.objects FOR SELECT
USING (bucket_id = 'chinese-po-files');
