-- Initial schema for Pledge app

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (created on first SIWS auth)
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text UNIQUE NOT NULL,
  username text,
  pfp_url text,
  points bigint DEFAULT 0,
  streak_current int DEFAULT 0,
  streak_best int DEFAULT 0,
  github_username text,           -- V2: for verified goals
  x_username text,                -- V2: for verified goals
  notification_preferences jsonb,
  created_at timestamptz DEFAULT now()
);

-- Goal Templates
CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  todos jsonb NOT NULL,  -- [{text, days: [0-6] or null for all}]
  default_timeframe text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Pledges (mirror on-chain + extra metadata)
CREATE TABLE pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  on_chain_address text UNIQUE,
  name text NOT NULL,
  timeframe_type text NOT NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  deadline timestamptz NOT NULL,
  stake_amount bigint NOT NULL,  -- in USDC (6 decimals)
  todos jsonb NOT NULL,
  status text NOT NULL DEFAULT 'Active',  -- mirrors on-chain
  completion_percentage int,
  points_earned int,
  created_at timestamptz DEFAULT now()
);

-- Daily Progress
CREATE TABLE daily_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pledge_id uuid REFERENCES pledges(id) ON DELETE CASCADE,
  date date NOT NULL,
  todos_completed jsonb NOT NULL DEFAULT '[]',  -- [todo_index, ...]
  created_at timestamptz DEFAULT now(),
  UNIQUE(pledge_id, date)
);

-- Create indexes for common queries
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_pledges_user ON pledges(user_id);
CREATE INDEX idx_pledges_status ON pledges(status);
CREATE INDEX idx_pledges_deadline ON pledges(deadline);
CREATE INDEX idx_templates_user ON templates(user_id);
CREATE INDEX idx_daily_progress_pledge ON daily_progress(pledge_id);
CREATE INDEX idx_daily_progress_date ON daily_progress(date);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile"
ON users FOR SELECT TO authenticated
USING ((SELECT auth.uid())::text = wallet_address);

CREATE POLICY "Users can update own profile"
ON users FOR UPDATE TO authenticated
USING ((SELECT auth.uid())::text = wallet_address);

-- RLS Policies for templates table
CREATE POLICY "Users can view own templates"
ON templates FOR SELECT TO authenticated
USING (user_id = (SELECT id FROM users WHERE wallet_address = (SELECT auth.uid())::text));

CREATE POLICY "Users can create own templates"
ON templates FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT id FROM users WHERE wallet_address = (SELECT auth.uid())::text));

CREATE POLICY "Users can update own templates"
ON templates FOR UPDATE TO authenticated
USING (user_id = (SELECT id FROM users WHERE wallet_address = (SELECT auth.uid())::text));

CREATE POLICY "Users can delete own templates"
ON templates FOR DELETE TO authenticated
USING (user_id = (SELECT id FROM users WHERE wallet_address = (SELECT auth.uid())::text));

-- RLS Policies for pledges table
CREATE POLICY "Users can view own pledges"
ON pledges FOR SELECT TO authenticated
USING (user_id = (SELECT id FROM users WHERE wallet_address = (SELECT auth.uid())::text));

CREATE POLICY "Users can create own pledges"
ON pledges FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT id FROM users WHERE wallet_address = (SELECT auth.uid())::text));

CREATE POLICY "Users can update own pledges"
ON pledges FOR UPDATE TO authenticated
USING (user_id = (SELECT id FROM users WHERE wallet_address = (SELECT auth.uid())::text));

-- RLS Policies for daily_progress table
CREATE POLICY "Users can view own progress"
ON daily_progress FOR SELECT TO authenticated
USING (pledge_id IN (
  SELECT id FROM pledges WHERE user_id = (
    SELECT id FROM users WHERE wallet_address = (SELECT auth.uid())::text
  )
));

CREATE POLICY "Users can create own progress"
ON daily_progress FOR INSERT TO authenticated
WITH CHECK (pledge_id IN (
  SELECT id FROM pledges WHERE user_id = (
    SELECT id FROM users WHERE wallet_address = (SELECT auth.uid())::text
  )
));

CREATE POLICY "Users can update own progress"
ON daily_progress FOR UPDATE TO authenticated
USING (pledge_id IN (
  SELECT id FROM pledges WHERE user_id = (
    SELECT id FROM users WHERE wallet_address = (SELECT auth.uid())::text
  )
));
