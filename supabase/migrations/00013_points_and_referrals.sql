-- Points & Referrals system
-- Adds seasons, configurable points rules, event ledger, referrals,
-- and DB triggers for automatic point awarding.
-- Security fixes: C1-C4, H1-H3, M1-M3 applied per audit.

-- ============================================================
-- 0. Drop legacy increment_points (C3 — exploitable, replaced by triggers)
-- ============================================================
DROP FUNCTION IF EXISTS increment_points;

-- ============================================================
-- 1. Seasons
-- ============================================================
CREATE TABLE seasons (
  id serial PRIMARY KEY,
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,           -- null = ongoing
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- H3: Only one active season at a time
CREATE UNIQUE INDEX idx_one_active_season ON seasons (is_active) WHERE is_active = true;

-- Seed Season 0 (displayed as "Season 1" in UI)
INSERT INTO seasons (id, name, starts_at, is_active)
OVERRIDING SYSTEM VALUE
VALUES (0, 'Season 1', now(), true);
ALTER SEQUENCE seasons_id_seq RESTART WITH 1;

-- ============================================================
-- 2. Points config (all earning rules configurable per season)
-- ============================================================
CREATE TABLE points_config (
  id serial PRIMARY KEY,
  season_id integer REFERENCES seasons(id),
  rule_key text NOT NULL,
  rule_value numeric NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(season_id, rule_key)
);

-- Seed Season 0 rules
INSERT INTO points_config (season_id, rule_key, rule_value, description) VALUES
  (0, 'base_creation',              10,    'Base points for creating any pledge'),
  (0, 'stake_per_dollar',           10,    'Points per $1 USDC pledged'),
  (0, 'duration_per_week',          50,    'Points per week of pledge duration'),
  (0, 'completion_100_multiplier',  2,     'Multiplier on creation points for 100% completion'),
  (0, 'completion_50_99_multiplier',1,     'Multiplier for 50-99% completion'),
  (0, 'completion_1_49_multiplier', 0.5,   'Multiplier for 1-49% completion'),
  (0, 'streak_2_multiplier',        1.25,  'Points multiplier at 2 consecutive 100% completions'),
  (0, 'streak_5_multiplier',        1.5,   'Points multiplier at 5 consecutive'),
  (0, 'streak_10_multiplier',       2,     'Points multiplier at 10 consecutive'),
  (0, 'referral_signup_bonus',      25,    'Points for both referrer and referred on signup'),
  (0, 'referral_earning_pct',       10,    '% of referred user''s pledge points that referrer earns');

-- ============================================================
-- 3. Point events ledger (append-only)
-- ============================================================
CREATE TABLE point_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  season_id integer REFERENCES seasons(id),
  event_type text NOT NULL,  -- 'pledge_created','pledge_completed','streak_bonus','referral_signup','referral_earning:<source>'
  points bigint NOT NULL,    -- M2: bigint for consistency with users.points
  pledge_id uuid REFERENCES pledges(id),
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_point_events_user   ON point_events(user_id);
CREATE INDEX idx_point_events_season ON point_events(season_id);
CREATE INDEX idx_point_events_type   ON point_events(event_type);

-- H1: Idempotency — prevent duplicate awards for same user+event+pledge
CREATE UNIQUE INDEX idx_point_events_pledge_dedup
  ON point_events(user_id, event_type, pledge_id)
  WHERE pledge_id IS NOT NULL;

-- H1: Idempotency for non-pledge events (e.g. referral_signup)
CREATE UNIQUE INDEX idx_point_events_no_pledge_dedup
  ON point_events(user_id, event_type)
  WHERE pledge_id IS NULL;

-- ============================================================
-- 4. Referrals
-- ============================================================
CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES users(id) ON DELETE CASCADE,
  referred_id uuid REFERENCES users(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  status text DEFAULT 'signed_up',  -- 'signed_up','first_completion','active'
  created_at timestamptz DEFAULT now(),
  UNIQUE(referred_id),                                    -- each user referred once
  CONSTRAINT no_self_referral CHECK (referrer_id != referred_id)  -- C4
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_code    ON referrals(referral_code);

-- ============================================================
-- 5. Add referral_code to users + generator function
-- ============================================================
ALTER TABLE users ADD COLUMN referral_code text UNIQUE;

-- M3: Generate a unique 8-char alphanumeric referral code (base64 stripped)
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  exists_already boolean;
BEGIN
  LOOP
    code := upper(regexp_replace(encode(gen_random_bytes(6), 'base64'), '[^a-zA-Z0-9]', '', 'g'));
    code := substr(code, 1, 6);
    SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already AND length(code) = 6;
  END LOOP;
  RETURN code;
END;
$$;

-- Auto-assign referral code on new user insert
CREATE OR REPLACE FUNCTION assign_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_referral_code
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION assign_referral_code();

-- Backfill existing users with referral codes
UPDATE users SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

-- H2: Prevent clients from modifying referral_code or points
-- Uses GUC app.internal_update to allow SECURITY DEFINER functions to bypass
CREATE OR REPLACE FUNCTION protect_immutable_user_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow internal updates from SECURITY DEFINER functions
  IF current_setting('app.internal_update', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    RAISE EXCEPTION 'referral_code cannot be modified';
  END IF;
  IF NEW.points IS DISTINCT FROM OLD.points THEN
    RAISE EXCEPTION 'points cannot be modified directly';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_immutable_user_fields
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION protect_immutable_user_fields();

-- M1: Block referral creation if referred user already has pledges
CREATE OR REPLACE FUNCTION check_referral_eligibility()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pledges WHERE user_id = NEW.referred_id LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot apply referral code after creating a pledge';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_referral_eligibility
  BEFORE INSERT ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION check_referral_eligibility();

-- ============================================================
-- 6. RLS Policies
-- ============================================================
-- auth.uid() returns user UUID directly (set in verify-wallet Edge Function).
-- Pattern matches 00012: user_id = (SELECT auth.uid())

-- seasons: read-only for all authenticated
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read seasons"
  ON seasons FOR SELECT TO authenticated USING (true);

-- points_config: read-only for all authenticated
ALTER TABLE points_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read points config"
  ON points_config FOR SELECT TO authenticated USING (true);

-- C1: point_events — auth.uid() = user UUID
ALTER TABLE point_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own point events"
  ON point_events FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- C1: referrals — auth.uid() = user UUID
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own referrals"
  ON referrals FOR SELECT TO authenticated
  USING (
    referrer_id = (SELECT auth.uid())
    OR referred_id = (SELECT auth.uid())
  );

CREATE POLICY "Users can create referral as referred"
  ON referrals FOR INSERT TO authenticated
  WITH CHECK (referred_id = (SELECT auth.uid()));

-- ============================================================
-- 7. award_points helper (called ONLY by triggers, not by clients)
-- ============================================================
CREATE OR REPLACE FUNCTION award_points(
  p_user_id uuid,
  p_season_id integer,
  p_event_type text,
  p_points bigint,
  p_pledge_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_season_id IS NULL THEN RETURN; END IF;

  -- H1: ON CONFLICT for idempotency
  INSERT INTO point_events (user_id, season_id, event_type, points, pledge_id, metadata)
  VALUES (p_user_id, p_season_id, p_event_type, p_points, p_pledge_id, p_metadata)
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN RETURN; END IF;

  -- Update cached total (set GUC to bypass protect_immutable_user_fields trigger)
  PERFORM set_config('app.internal_update', 'true', true);
  UPDATE users SET points = points + p_points WHERE id = p_user_id;
  PERFORM set_config('app.internal_update', '', true);
END;
$$;

-- C2: Only triggers (SECURITY DEFINER) should call this, not clients
REVOKE EXECUTE ON FUNCTION award_points FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION award_points FROM authenticated;

-- ============================================================
-- 8. Trigger 1: Points on pledge creation
-- ============================================================
CREATE OR REPLACE FUNCTION trg_award_pledge_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_season_id integer;
  v_base numeric;
  v_per_dollar numeric;
  v_total bigint;
BEGIN
  SELECT id INTO v_season_id FROM seasons WHERE is_active = true LIMIT 1;
  IF v_season_id IS NULL THEN RETURN NEW; END IF;

  SELECT rule_value INTO v_base FROM points_config
    WHERE season_id = v_season_id AND rule_key = 'base_creation';
  SELECT rule_value INTO v_per_dollar FROM points_config
    WHERE season_id = v_season_id AND rule_key = 'stake_per_dollar';

  -- Base + stake only. Duration points awarded at completion based on actual time elapsed.
  v_total := FLOOR(
    COALESCE(v_base, 10)
    + (NEW.stake_amount / 1000000.0 * COALESCE(v_per_dollar, 10))
  );

  PERFORM award_points(
    NEW.user_id, v_season_id, 'pledge_created', v_total, NEW.id,
    jsonb_build_object('stake_amount', NEW.stake_amount)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_points_pledge_created
  AFTER INSERT ON pledges
  FOR EACH ROW
  EXECUTE FUNCTION trg_award_pledge_created();

-- ============================================================
-- 9. Trigger 2: Points on pledge completion/settlement
-- ============================================================
CREATE OR REPLACE FUNCTION trg_award_pledge_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_season_id integer;
  v_creation_points bigint;
  v_per_week numeric;
  v_actual_weeks numeric;
  v_duration_points bigint;
  v_multiplier numeric;
  v_streak_mult numeric;
  v_completion_pct int;
  v_total_base bigint;
  v_completion_award bigint;
  v_streak int;
BEGIN
  -- Only fire on status change from Active to terminal
  IF OLD.status != 'Active' THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('Completed', 'Forfeited') THEN RETURN NEW; END IF;

  SELECT id INTO v_season_id FROM seasons WHERE is_active = true LIMIT 1;
  IF v_season_id IS NULL THEN RETURN NEW; END IF;

  v_completion_pct := COALESCE(NEW.completion_percentage, 0);
  IF v_completion_pct = 0 THEN RETURN NEW; END IF;

  -- Get creation points (base + stake only)
  SELECT points INTO v_creation_points
    FROM point_events
    WHERE pledge_id = NEW.id AND event_type = 'pledge_created'
    LIMIT 1;
  IF v_creation_points IS NULL THEN RETURN NEW; END IF;

  -- Calculate duration points based on ACTUAL time elapsed (prevents early-close gaming)
  SELECT rule_value INTO v_per_week FROM points_config
    WHERE season_id = v_season_id AND rule_key = 'duration_per_week';
  v_actual_weeks := EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 604800.0;
  v_duration_points := FLOOR(v_actual_weeks * COALESCE(v_per_week, 50));

  -- Total base = creation points + actual duration points
  v_total_base := v_creation_points + v_duration_points;

  -- Completion multiplier applies to everything (base + stake + duration)
  IF v_completion_pct = 100 THEN
    SELECT rule_value INTO v_multiplier FROM points_config
      WHERE season_id = v_season_id AND rule_key = 'completion_100_multiplier';
  ELSIF v_completion_pct >= 50 THEN
    SELECT rule_value INTO v_multiplier FROM points_config
      WHERE season_id = v_season_id AND rule_key = 'completion_50_99_multiplier';
  ELSE
    SELECT rule_value INTO v_multiplier FROM points_config
      WHERE season_id = v_season_id AND rule_key = 'completion_1_49_multiplier';
  END IF;

  v_completion_award := FLOOR(v_total_base * COALESCE(v_multiplier, 1));

  IF v_completion_award > 0 THEN
    PERFORM award_points(
      NEW.user_id, v_season_id, 'pledge_completed', v_completion_award, NEW.id,
      jsonb_build_object(
        'completion_pct', v_completion_pct,
        'multiplier', v_multiplier,
        'actual_weeks', round(v_actual_weeks, 1),
        'duration_points', v_duration_points
      )
    );
  END IF;

  -- Streak bonus (100% only)
  IF v_completion_pct = 100 THEN
    v_streak := COALESCE((SELECT streak_current FROM users WHERE id = NEW.user_id), 0);
    v_streak_mult := 1;

    IF v_streak >= 10 THEN
      SELECT rule_value INTO v_streak_mult FROM points_config
        WHERE season_id = v_season_id AND rule_key = 'streak_10_multiplier';
    ELSIF v_streak >= 5 THEN
      SELECT rule_value INTO v_streak_mult FROM points_config
        WHERE season_id = v_season_id AND rule_key = 'streak_5_multiplier';
    ELSIF v_streak >= 2 THEN
      SELECT rule_value INTO v_streak_mult FROM points_config
        WHERE season_id = v_season_id AND rule_key = 'streak_2_multiplier';
    END IF;

    IF COALESCE(v_streak_mult, 1) > 1 THEN
      PERFORM award_points(
        NEW.user_id, v_season_id, 'streak_bonus',
        FLOOR(v_completion_award * (COALESCE(v_streak_mult, 1) - 1)),
        NEW.id,
        jsonb_build_object('streak', v_streak, 'multiplier', v_streak_mult)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_points_pledge_completed
  AFTER UPDATE ON pledges
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION trg_award_pledge_completed();

-- ============================================================
-- 10. Trigger 3: Points on referral creation (signup bonus)
-- ============================================================
CREATE OR REPLACE FUNCTION trg_award_referral_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_season_id integer;
  v_bonus bigint;
BEGIN
  SELECT id INTO v_season_id FROM seasons WHERE is_active = true LIMIT 1;
  IF v_season_id IS NULL THEN RETURN NEW; END IF;

  SELECT rule_value::bigint INTO v_bonus FROM points_config
    WHERE season_id = v_season_id AND rule_key = 'referral_signup_bonus';
  v_bonus := COALESCE(v_bonus, 25);

  -- Award to referrer (compound event_type for per-referral dedup)
  PERFORM award_points(
    NEW.referrer_id, v_season_id, 'referral_signup:' || NEW.referred_id::text, v_bonus, NULL,
    jsonb_build_object('referred_user_id', NEW.referred_id)
  );

  -- Award to referred (compound event_type for per-referral dedup)
  PERFORM award_points(
    NEW.referred_id, v_season_id, 'referral_signup:' || NEW.referrer_id::text, v_bonus, NULL,
    jsonb_build_object('referrer_id', NEW.referrer_id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_points_referral_signup
  AFTER INSERT ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION trg_award_referral_signup();

-- ============================================================
-- 11. Trigger 4: Referral earning (% of referee's pledge points)
--     Uses compound event_type 'referral_earning:<source>' to allow
--     separate earnings per source event per pledge.
-- ============================================================
CREATE OR REPLACE FUNCTION trg_award_referral_earning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id uuid;
  v_pct numeric;
  v_earning bigint;
  v_event_type text;
BEGIN
  SELECT referrer_id INTO v_referrer_id
    FROM referrals WHERE referred_id = NEW.user_id LIMIT 1;
  IF v_referrer_id IS NULL THEN RETURN NEW; END IF;

  SELECT rule_value INTO v_pct FROM points_config
    WHERE season_id = NEW.season_id AND rule_key = 'referral_earning_pct';
  IF v_pct IS NULL OR v_pct <= 0 THEN RETURN NEW; END IF;

  v_earning := GREATEST(1, FLOOR(NEW.points * v_pct / 100));
  v_event_type := 'referral_earning:' || NEW.event_type;

  -- Direct insert (not via award_points to avoid recursion)
  INSERT INTO point_events (user_id, season_id, event_type, points, pledge_id, metadata)
  VALUES (
    v_referrer_id, NEW.season_id, v_event_type, v_earning, NEW.pledge_id,
    jsonb_build_object('referred_user_id', NEW.user_id, 'source_event', NEW.event_type, 'source_points', NEW.points)
  )
  ON CONFLICT DO NOTHING;

  IF FOUND THEN
    PERFORM set_config('app.internal_update', 'true', true);
    UPDATE users SET points = points + v_earning WHERE id = v_referrer_id;
    PERFORM set_config('app.internal_update', '', true);
  END IF;

  RETURN NEW;
END;
$$;

-- Only fire for non-referral events to prevent recursion
CREATE TRIGGER trg_points_referral_earning
  AFTER INSERT ON point_events
  FOR EACH ROW
  WHEN (NEW.event_type NOT LIKE 'referral%')
  EXECUTE FUNCTION trg_award_referral_earning();
