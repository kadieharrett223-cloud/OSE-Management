-- Create storage bucket and policies for Chinese invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('chinese-invoices', 'chinese-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload chinese invoices"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chinese-invoices' AND auth.role() = 'authenticated');

-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read chinese invoices"
ON storage.objects FOR SELECT
USING (bucket_id = 'chinese-invoices' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update chinese invoices"
ON storage.objects FOR UPDATE
USING (bucket_id = 'chinese-invoices' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'chinese-invoices' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete chinese invoices"
ON storage.objects FOR DELETE
USING (bucket_id = 'chinese-invoices' AND auth.role() = 'authenticated');
