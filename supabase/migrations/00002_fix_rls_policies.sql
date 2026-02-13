-- Fix RLS policies to use auth.uid() directly as user UUID
-- Previously, auth.uid() contained the wallet address which caused UUID parsing errors
-- Now, auth.uid() returns the user's UUID directly

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

-- RLS Policies for users table
-- Users can view/update their own profile (auth.uid() = user.id)
CREATE POLICY "Users can view own profile"
ON users FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON users FOR UPDATE TO authenticated
USING (id = auth.uid());

-- RLS Policies for templates table
CREATE POLICY "Users can view own templates"
ON templates FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create own templates"
ON templates FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own templates"
ON templates FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own templates"
ON templates FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- RLS Policies for pledges table
CREATE POLICY "Users can view own pledges"
ON pledges FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create own pledges"
ON pledges FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pledges"
ON pledges FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- RLS Policies for daily_progress table
CREATE POLICY "Users can view own progress"
ON daily_progress FOR SELECT TO authenticated
USING (pledge_id IN (SELECT id FROM pledges WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own progress"
ON daily_progress FOR INSERT TO authenticated
WITH CHECK (pledge_id IN (SELECT id FROM pledges WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own progress"
ON daily_progress FOR UPDATE TO authenticated
USING (pledge_id IN (SELECT id FROM pledges WHERE user_id = auth.uid()));
