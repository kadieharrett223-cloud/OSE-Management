-- Chinese PO Files
-- Tracks the original Chinese purchase orders sent to factories

CREATE TABLE IF NOT EXISTS chinese_po_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_mime_type TEXT,
  file_path TEXT NOT NULL,
  file_uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  upload_notes TEXT,
  created_by_user_id TEXT,
  UNIQUE (purchase_order_id, file_name)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_chinese_po_files_po_id ON chinese_po_files(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_chinese_po_files_uploaded_at ON chinese_po_files(file_uploaded_at);

-- RLS
ALTER TABLE chinese_po_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chinese PO files: read for authenticated" ON chinese_po_files
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Chinese PO files: insert for authenticated" ON chinese_po_files
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Chinese PO files: update for authenticated" ON chinese_po_files
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Chinese PO files: delete for authenticated" ON chinese_po_files
  FOR DELETE USING (auth.role() = 'authenticated');

-- Trigger to update updated_at
CREATE TRIGGER update_chinese_po_files_updated_at
BEFORE UPDATE ON chinese_po_files
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
