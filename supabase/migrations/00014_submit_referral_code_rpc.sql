-- RPC function for submitting referral codes.
-- SECURITY DEFINER bypasses RLS so we can look up the referrer
-- without exposing the users table to cross-user queries.

CREATE OR REPLACE FUNCTION submit_referral_code(code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id uuid;
  v_referrer_id uuid;
  v_clean_code text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_clean_code := upper(trim(code));

  -- Look up referrer by code (bypasses RLS via SECURITY DEFINER)
  SELECT id INTO v_referrer_id
    FROM users
    WHERE referral_code = v_clean_code;

  IF v_referrer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid referral code';
  END IF;

  IF v_referrer_id = v_caller_id THEN
    RAISE EXCEPTION 'Cannot use your own referral code';
  END IF;

  -- Insert referral record
  -- Unique constraint on referred_id handles duplicate submissions
  -- trg_check_referral_eligibility handles the "already has pledges" check
  -- trg_points_referral_signup handles awarding points to both users
  INSERT INTO referrals (referrer_id, referred_id, referral_code)
  VALUES (v_referrer_id, v_caller_id, v_clean_code);
END;
$$;
