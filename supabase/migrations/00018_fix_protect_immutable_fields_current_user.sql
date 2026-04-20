-- Fix protect_immutable_user_fields to use current_user instead of session_user.
--
-- Migration 00016 replaced the GUC-based bypass (app.internal_update) with
-- a session_user = 'supabase_admin' check. The GUC bypass was correctly
-- flagged as insecure (any client can SET a GUC).
--
-- However, session_user never changes — even inside SECURITY DEFINER functions.
-- This broke the trigger chain: when an authenticated user creates a pledge,
-- trg_award_pledge_created (SECURITY DEFINER) → award_points (SECURITY DEFINER)
-- → UPDATE users.points → protect_immutable_user_fields fires, sees
-- session_user = 'authenticated', and raises an exception.
--
-- Fix: use current_user instead. SECURITY DEFINER functions set current_user
-- to the function owner (postgres). Clients cannot spoof current_user —
-- only SECURITY DEFINER functions change it — so this is equally secure
-- as the session_user check while actually allowing the intended bypass.

CREATE OR REPLACE FUNCTION protect_immutable_user_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow internal updates from SECURITY DEFINER functions (owned by postgres).
  -- current_user reflects SECURITY DEFINER context; clients cannot spoof it.
  IF current_user = 'postgres' THEN
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
