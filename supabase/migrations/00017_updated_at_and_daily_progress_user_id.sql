-- Add updated_at columns and optimize daily_progress RLS

-- =============================================
-- 1. Generic updated_at trigger function
-- =============================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================
-- 2. Add updated_at to core tables
-- =============================================
ALTER TABLE users ADD COLUMN updated_at timestamptz DEFAULT now();
ALTER TABLE pledges ADD COLUMN updated_at timestamptz DEFAULT now();
ALTER TABLE notifications ADD COLUMN updated_at timestamptz DEFAULT now();
ALTER TABLE daily_progress ADD COLUMN updated_at timestamptz DEFAULT now();

-- Backfill existing rows with created_at value
UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE pledges SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE notifications SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE daily_progress SET updated_at = created_at WHERE updated_at IS NULL;

-- Create triggers
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pledges_updated_at
  BEFORE UPDATE ON pledges
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_daily_progress_updated_at
  BEFORE UPDATE ON daily_progress
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- =============================================
-- 3. Add user_id to daily_progress for flat RLS
-- =============================================
ALTER TABLE daily_progress ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;

-- Backfill from pledges table
UPDATE daily_progress dp
SET user_id = p.user_id
FROM pledges p
WHERE dp.pledge_id = p.id;

-- Now make it NOT NULL
ALTER TABLE daily_progress ALTER COLUMN user_id SET NOT NULL;

-- Index for RLS performance
CREATE INDEX idx_daily_progress_user ON daily_progress(user_id);

-- =============================================
-- 4. Replace daily_progress RLS with flat user_id check
-- =============================================
DROP POLICY IF EXISTS "Users can view own progress" ON daily_progress;
CREATE POLICY "Users can view own progress"
  ON daily_progress FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create own progress" ON daily_progress;
CREATE POLICY "Users can create own progress"
  ON daily_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own progress" ON daily_progress;
CREATE POLICY "Users can update own progress"
  ON daily_progress FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
