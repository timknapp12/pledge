-- Add notification support to Pledge app

-- Users table additions for push notifications
ALTER TABLE users ADD COLUMN push_token text;
ALTER TABLE users ADD COLUMN notifications_enabled boolean DEFAULT false;

-- Pledges table addition for per-pledge reminder settings
ALTER TABLE pledges ADD COLUMN reminder_settings jsonb;
-- Structure: { "reminders": [{ "type": "daily", "time": "09:00" }, { "type": "before_deadline", "hours": 24 }] }

-- Notifications table to track scheduled/sent notifications
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  pledge_id uuid REFERENCES pledges(id) ON DELETE CASCADE,
  type text NOT NULL,  -- 'daily_reminder', 'deadline_24h', 'deadline_1h', etc.
  title text NOT NULL,
  body text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  status text DEFAULT 'pending',  -- 'pending', 'sent', 'cancelled', 'failed'
  error_message text,  -- Store error if failed
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_pledge ON notifications(pledge_id);
CREATE INDEX idx_notifications_pending_scheduled ON notifications(status, scheduled_for)
  WHERE status = 'pending';

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications table
-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT TO authenticated
USING (user_id = (SELECT id FROM users WHERE wallet_address = (SELECT auth.uid())::text));

-- Users can create notifications for their own pledges
CREATE POLICY "Users can create own notifications"
ON notifications FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT id FROM users WHERE wallet_address = (SELECT auth.uid())::text)
  AND pledge_id IN (
    SELECT id FROM pledges WHERE user_id = (
      SELECT id FROM users WHERE wallet_address = (SELECT auth.uid())::text
    )
  )
);

-- Users can update their own notifications (e.g., cancel)
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE TO authenticated
USING (user_id = (SELECT id FROM users WHERE wallet_address = (SELECT auth.uid())::text));

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON notifications FOR DELETE TO authenticated
USING (user_id = (SELECT id FROM users WHERE wallet_address = (SELECT auth.uid())::text));

-- Service role can do everything (for cron job/Edge Function)
-- Note: Service role bypasses RLS by default, so no policy needed
