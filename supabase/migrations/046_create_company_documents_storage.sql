-- Create storage bucket for company documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-documents', 'company-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload company documents
CREATE POLICY "Authenticated users can upload company documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'company-documents' AND auth.role() = 'authenticated');

-- Allow authenticated users to read company documents
CREATE POLICY "Authenticated users can read company documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-documents' AND auth.role() = 'authenticated');

-- Allow authenticated users to update company documents
CREATE POLICY "Authenticated users can update company documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'company-documents' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'company-documents' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete company documents
CREATE POLICY "Authenticated users can delete company documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'company-documents' AND auth.role() = 'authenticated');
