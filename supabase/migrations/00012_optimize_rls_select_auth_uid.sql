-- Optimize RLS policies to use (SELECT auth.uid()) instead of auth.uid()
-- The subquery form evaluates once per query instead of once per row,
-- which improves performance as tables grow.
-- Notifications policies (migration 00009) already use this pattern.

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view own templates" ON templates;
DROP POLICY IF EXISTS "Users can create own templates" ON templates;
DROP POLICY IF EXISTS "Users can update own templates" ON templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON templates;
DROP POLICY IF EXISTS "Users can view own pledges" ON pledges;
DROP POLICY IF EXISTS "Users can create own pledges" ON pledges;
DROP POLICY IF EXISTS "Users can update own pledges" ON pledges;
DROP POLICY IF EXISTS "Users can view own progress" ON daily_progress;
DROP POLICY IF EXISTS "Users can create own progress" ON daily_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON daily_progress;

-- Users table
CREATE POLICY "Users can view own profile"
ON users FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can update own profile"
ON users FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()));

-- Templates table
CREATE POLICY "Users can view own templates"
ON templates FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create own templates"
ON templates FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own templates"
ON templates FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own templates"
ON templates FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Pledges table
CREATE POLICY "Users can view own pledges"
ON pledges FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create own pledges"
ON pledges FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own pledges"
ON pledges FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Daily progress table
CREATE POLICY "Users can view own progress"
ON daily_progress FOR SELECT TO authenticated
USING (pledge_id IN (SELECT id FROM pledges WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Users can create own progress"
ON daily_progress FOR INSERT TO authenticated
WITH CHECK (pledge_id IN (SELECT id FROM pledges WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "Users can update own progress"
ON daily_progress FOR UPDATE TO authenticated
USING (pledge_id IN (SELECT id FROM pledges WHERE user_id = (SELECT auth.uid())));
