-- Mobile notification support (free SMS gateway based)
-- 1) Persist manual calendar notifications for server-side 8AM reminders
-- 2) Deduplicate customer payment SMS alerts

CREATE TABLE IF NOT EXISTS calendar_mobile_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  recurring TEXT NOT NULL DEFAULT 'none',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_for_date DATE,
  last_sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_calendar_mobile_notifications_event_date
  ON calendar_mobile_notifications(event_date);

CREATE INDEX IF NOT EXISTS idx_calendar_mobile_notifications_active
  ON calendar_mobile_notifications(is_active);

ALTER TABLE calendar_mobile_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Calendar mobile notifications: read for authenticated" ON calendar_mobile_notifications;
CREATE POLICY "Calendar mobile notifications: read for authenticated" ON calendar_mobile_notifications
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Calendar mobile notifications: insert for authenticated" ON calendar_mobile_notifications;
CREATE POLICY "Calendar mobile notifications: insert for authenticated" ON calendar_mobile_notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Calendar mobile notifications: update for authenticated" ON calendar_mobile_notifications;
CREATE POLICY "Calendar mobile notifications: update for authenticated" ON calendar_mobile_notifications
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Calendar mobile notifications: delete for authenticated" ON calendar_mobile_notifications;
CREATE POLICY "Calendar mobile notifications: delete for authenticated" ON calendar_mobile_notifications
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS customer_payment_sms_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  qbo_payment_id TEXT NOT NULL UNIQUE,
  payment_date DATE,
  customer_name TEXT,
  applied_amount NUMERIC(12, 2)
);

CREATE INDEX IF NOT EXISTS idx_customer_payment_sms_logs_payment_date
  ON customer_payment_sms_logs(payment_date);

ALTER TABLE customer_payment_sms_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payment SMS logs: read for authenticated" ON customer_payment_sms_logs;
CREATE POLICY "Payment SMS logs: read for authenticated" ON customer_payment_sms_logs
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Payment SMS logs: insert for authenticated" ON customer_payment_sms_logs;
CREATE POLICY "Payment SMS logs: insert for authenticated" ON customer_payment_sms_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');