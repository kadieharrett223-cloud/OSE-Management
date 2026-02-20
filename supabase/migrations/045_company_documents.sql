-- Company Documents
-- Shared internal documents for the company

CREATE TABLE IF NOT EXISTS company_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_mime_type TEXT,
  file_path TEXT NOT NULL,
  file_uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  upload_notes TEXT,
  created_by_user_id TEXT,
  UNIQUE (file_path)
);

CREATE INDEX IF NOT EXISTS idx_company_documents_uploaded_at ON company_documents(file_uploaded_at);

ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company documents: read for authenticated" ON company_documents
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Company documents: insert for authenticated" ON company_documents
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Company documents: update for authenticated" ON company_documents
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Company documents: delete for authenticated" ON company_documents
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE TRIGGER update_company_documents_updated_at
BEFORE UPDATE ON company_documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
