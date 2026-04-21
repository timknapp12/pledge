-- Security and integrity fixes from migration audit
-- Addresses: C1, W1, W2, W3, M1, M2, M3 from audit report

-- =============================================
-- C1: Lock down schedule_pledge_notifications
-- It's SECURITY DEFINER but was callable by any authenticated user.
-- Only service_role (crank, edge functions) should call it.
-- =============================================
REVOKE EXECUTE ON FUNCTION schedule_pledge_notifications FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION schedule_pledge_notifications FROM authenticated;
REVOKE EXECUTE ON FUNCTION schedule_pledge_notifications FROM anon;
GRANT EXECUTE ON FUNCTION schedule_pledge_notifications TO service_role;

-- =============================================
-- W1: Fix GUC bypass in protect_immutable_user_fields
-- Replace app.internal_update check (any SQL caller can SET it)
-- with session_user check (only supabase_admin for service_role).
-- =============================================
CREATE OR REPLACE FUNCTION protect_immutable_user_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow internal updates from service_role (triggers, SECURITY DEFINER functions)
  IF session_user = 'supabase_admin' THEN
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

-- =============================================
-- W2: Restrict notification_templates and supported_languages
-- to authenticated users (was open to anon)
-- =============================================
DROP POLICY IF EXISTS "Anyone can read supported languages" ON supported_languages;
CREATE POLICY "Authenticated users can read supported languages"
  ON supported_languages FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can read notification templates" ON notification_templates;
CREATE POLICY "Authenticated users can read notification templates"
  ON notification_templates FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- W3: Lock down generate_referral_code and submit_referral_code
-- =============================================
-- generate_referral_code is only needed by triggers and SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION generate_referral_code FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION generate_referral_code FROM authenticated;
REVOKE EXECUTE ON FUNCTION generate_referral_code FROM anon;
GRANT EXECUTE ON FUNCTION generate_referral_code TO service_role;

-- submit_referral_code should only be callable by authenticated users (not anon)
REVOKE EXECUTE ON FUNCTION submit_referral_code FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION submit_referral_code FROM anon;
GRANT EXECUTE ON FUNCTION submit_referral_code TO authenticated;
GRANT EXECUTE ON FUNCTION submit_referral_code TO service_role;

-- =============================================
-- M1: Drop redundant idx_users_wallet index
-- The UNIQUE constraint on wallet_address already creates an index.
-- =============================================
DROP INDEX IF EXISTS idx_users_wallet;

-- =============================================
-- M2: Add CHECK constraints on status columns
-- Matches existing casing conventions (no data changes).
-- =============================================
ALTER TABLE pledges
  ADD CONSTRAINT chk_pledges_status
  CHECK (status IN ('Active', 'Reported', 'Completed', 'Forfeited', 'Cancelled'));

ALTER TABLE notifications
  ADD CONSTRAINT chk_notifications_status
  CHECK (status IN ('pending', 'sent', 'cancelled', 'failed'));

-- =============================================
-- M3: Add unique constraint on notification_templates
-- Prevents duplicate rows from manual seed re-runs.
-- =============================================
ALTER TABLE notification_templates
  ADD CONSTRAINT uq_notification_templates_key_pers_lang_title
  UNIQUE (key, personality, language, title);
