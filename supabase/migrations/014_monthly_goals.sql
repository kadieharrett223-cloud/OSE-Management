-- Monthly goals table for admin-set monthly sales targets
CREATE TABLE IF NOT EXISTS monthly_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  year INT NOT NULL,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  goal_amount NUMERIC(14,2) NOT NULL,
  notes TEXT,
  UNIQUE (year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_goals_year_month ON monthly_goals(year, month);

ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read; writes should go through server-side admin logic
CREATE POLICY "Monthly goals: read for authenticated" ON monthly_goals
  FOR SELECT USING (auth.role() = 'authenticated');

-- Keep admin/service role writes server-side; service_role bypasses RLS
CREATE TRIGGER update_monthly_goals_updated_at
BEFORE UPDATE ON monthly_goals
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
