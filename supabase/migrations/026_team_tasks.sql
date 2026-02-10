-- Create team_tasks table for shared team updates on POs and manufacturers
CREATE TABLE IF NOT EXISTS team_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open', -- open, in-progress, completed
  priority TEXT DEFAULT 'medium', -- low, medium, high
  assigned_to TEXT, -- team member name/email
  po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT NOT NULL, -- user email or name
  is_archived BOOLEAN DEFAULT FALSE
);

-- Create index for faster queries
CREATE INDEX idx_team_tasks_status ON team_tasks(status);
CREATE INDEX idx_team_tasks_po_id ON team_tasks(po_id);
CREATE INDEX idx_team_tasks_vendor_id ON team_tasks(vendor_id);
CREATE INDEX idx_team_tasks_created_at ON team_tasks(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE team_tasks ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view tasks
CREATE POLICY "team_tasks_select"
  ON team_tasks FOR SELECT
  USING (true);

-- Allow authenticated users to insert tasks
CREATE POLICY "team_tasks_insert"
  ON team_tasks FOR INSERT
  WITH CHECK (true);

-- Allow users to update tasks
CREATE POLICY "team_tasks_update"
  ON team_tasks FOR UPDATE
  USING (true);

-- Allow users to delete tasks
CREATE POLICY "team_tasks_delete"
  ON team_tasks FOR DELETE
  USING (true);
