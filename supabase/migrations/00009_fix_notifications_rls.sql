-- Fix notifications RLS policies to use auth.uid() directly as UUID
-- Migration 00003 used the old pattern: wallet_address = auth.uid()::text
-- But migration 00002 changed JWT so auth.uid() returns the user's UUID directly
-- These broken policies prevented users from querying their own notifications

-- Drop old broken policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;

-- Create fixed policies using auth.uid() directly
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own notifications"
ON notifications FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Note: INSERT policy intentionally NOT recreated.
-- Notifications are created by Edge Functions using service role key (bypasses RLS).
