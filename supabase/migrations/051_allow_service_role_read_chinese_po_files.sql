-- Allow service role to read Chinese PO files for server-side downloads
-- This is necessary because the download endpoint needs to serve files on behalf of authenticated users

CREATE POLICY "Service role can read chinese PO files for downloads"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'chinese-po-files');
