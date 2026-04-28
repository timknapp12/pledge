-- Security audit fixes (2026-04-27).
-- See SECURITY-AUDIT.md (Critical #1, #2; Medium #6).
-- Idempotent — safe to re-apply.

-- =============================================
-- 1. REVOKE EXECUTE on SECURITY DEFINER functions from anon/authenticated/PUBLIC
--    These should run only as triggers or via service_role.
-- =============================================

-- Caller-controllable point grant — service_role only.
revoke all on function public.award_points(uuid, integer, text, bigint, uuid, jsonb) from public;
revoke all on function public.award_points(uuid, integer, text, bigint, uuid, jsonb) from anon;
revoke all on function public.award_points(uuid, integer, text, bigint, uuid, jsonb) from authenticated;
grant execute on function public.award_points(uuid, integer, text, bigint, uuid, jsonb) to service_role;

-- Trigger functions — never invoked directly.
revoke all on function public.trg_award_pledge_completed() from public;
revoke all on function public.trg_award_pledge_completed() from anon;
revoke all on function public.trg_award_pledge_completed() from authenticated;

revoke all on function public.trg_award_pledge_created() from public;
revoke all on function public.trg_award_pledge_created() from anon;
revoke all on function public.trg_award_pledge_created() from authenticated;

revoke all on function public.trg_award_referral_earning() from public;
revoke all on function public.trg_award_referral_earning() from anon;
revoke all on function public.trg_award_referral_earning() from authenticated;

revoke all on function public.trg_award_referral_signup() from public;
revoke all on function public.trg_award_referral_signup() from anon;
revoke all on function public.trg_award_referral_signup() from authenticated;

revoke all on function public.assign_referral_code() from public;
revoke all on function public.assign_referral_code() from anon;
revoke all on function public.assign_referral_code() from authenticated;

revoke all on function public.check_referral_eligibility() from public;
revoke all on function public.check_referral_eligibility() from anon;
revoke all on function public.check_referral_eligibility() from authenticated;

revoke all on function public.protect_immutable_user_fields() from public;
revoke all on function public.protect_immutable_user_fields() from anon;
revoke all on function public.protect_immutable_user_fields() from authenticated;

revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon;
revoke all on function public.set_updated_at() from authenticated;

revoke all on function public.trigger_schedule_pledge_notifications() from public;
revoke all on function public.trigger_schedule_pledge_notifications() from anon;
revoke all on function public.trigger_schedule_pledge_notifications() from authenticated;

-- cleanup_rpc_rate_limits: missed anon/authenticated revoke in 00019.
revoke all on function public.cleanup_rpc_rate_limits() from anon;
revoke all on function public.cleanup_rpc_rate_limits() from authenticated;

-- submit_referral_code: keeps EXECUTE for authenticated (user-facing RPC).
-- It uses auth.uid() internally to identify the caller.

-- =============================================
-- 2. ENABLE RLS on rpc_rate_limits.
--    No policies — service_role bypasses RLS, no other role should access it directly.
-- =============================================

alter table public.rpc_rate_limits enable row level security;

-- =============================================
-- 3. SET search_path on every SECURITY DEFINER function.
--    Prevents privilege escalation if an attacker ever gains CREATE on a schema
--    earlier in search_path than public.
-- =============================================

-- Include `extensions` so functions can call pgcrypto helpers (gen_random_bytes etc.)
-- which Supabase installs into the extensions schema.
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
