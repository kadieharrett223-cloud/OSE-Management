-- Fix Chinese PO files read policy to allow downloads
-- Drop the old auth.role() restriction from the SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read chinese PO files" ON storage.objects;

-- Create a new policy that allows reads without auth.role() check
-- (authentication is verified at the app level)
CREATE POLICY "Allow reading chinese PO files"
ON storage.objects FOR SELECT
USING (bucket_id = 'chinese-po-files');
