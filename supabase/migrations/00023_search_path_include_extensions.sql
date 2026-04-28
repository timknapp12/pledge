-- Fix: 00021 set `search_path = public, pg_temp` on SECURITY DEFINER functions,
-- which blocked access to pgcrypto helpers (gen_random_bytes, gen_random_uuid)
-- that Supabase installs into the `extensions` schema. The
-- generate_referral_code() trigger then crashed every user upsert.
--
-- Add `extensions` to search_path on all SECURITY DEFINER functions. This still
-- excludes user-controllable schemas, so the privilege-escalation protection
-- from 00021 is preserved.

alter function public.award_points(uuid, integer, text, bigint, uuid, jsonb) set search_path = public, extensions, pg_temp;
alter function public.assign_referral_code() set search_path = public, extensions, pg_temp;
alter function public.check_referral_eligibility() set search_path = public, extensions, pg_temp;
alter function public.trg_award_pledge_completed() set search_path = public, extensions, pg_temp;
alter function public.trg_award_pledge_created() set search_path = public, extensions, pg_temp;
alter function public.trg_award_referral_earning() set search_path = public, extensions, pg_temp;
alter function public.trg_award_referral_signup() set search_path = public, extensions, pg_temp;
alter function public.schedule_pledge_notifications(uuid, uuid) set search_path = public, extensions, pg_temp;
alter function public.protect_immutable_user_fields() set search_path = public, extensions, pg_temp;
alter function public.generate_referral_code() set search_path = public, extensions, pg_temp;
alter function public.submit_referral_code(text) set search_path = public, extensions, pg_temp;
alter function public.set_updated_at() set search_path = public, extensions, pg_temp;
alter function public.trigger_schedule_pledge_notifications() set search_path = public, extensions, pg_temp;
alter function public.cleanup_rpc_rate_limits() set search_path = public, extensions, pg_temp;
alter function public.increment_rpc_rate_limit(text, bigint, int) set search_path = public, extensions, pg_temp;
