-- Create storage bucket for Chinese PO files
INSERT INTO storage.buckets (id, name, public)
VALUES ('chinese-po-files', 'chinese-po-files', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload PO files
CREATE POLICY "Authenticated users can upload chinese PO files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chinese-po-files' AND auth.role() = 'authenticated');

-- Allow authenticated users to read PO files
CREATE POLICY "Authenticated users can read chinese PO files"
ON storage.objects FOR SELECT
USING (bucket_id = 'chinese-po-files' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete PO files
CREATE POLICY "Authenticated users can delete chinese PO files"
ON storage.objects FOR DELETE
USING (bucket_id = 'chinese-po-files' AND auth.role() = 'authenticated');
