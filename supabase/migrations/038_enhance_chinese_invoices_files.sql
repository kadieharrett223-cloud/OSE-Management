-- Enhanced Chinese Invoices with file metadata
ALTER TABLE chinese_invoices
ADD COLUMN file_name TEXT,
ADD COLUMN file_size INTEGER,
ADD COLUMN file_mime_type TEXT,
ADD COLUMN file_uploaded_at TIMESTAMPTZ;

-- Create index for file lookups
CREATE INDEX IF NOT EXISTS idx_chinese_invoices_file_name ON chinese_invoices(file_name);
CREATE INDEX IF NOT EXISTS idx_chinese_invoices_file_uploaded_at ON chinese_invoices(file_uploaded_at);
