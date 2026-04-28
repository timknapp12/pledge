-- Server-issued single-use SIWS nonces with TTL.
-- Closes the residual replay window from SECURITY-AUDIT.md finding #3.
--
-- Flow:
--   1. Client calls issue-siws-nonce edge function with its wallet pubkey.
--   2. That function inserts a row here with expires_at = now() + 5 min.
--   3. Client signs a SIWS message containing the nonce.
--   4. verify-wallet edge function atomically claims the nonce
--      (UPDATE ... WHERE used_at IS NULL AND expires_at > now()).
--   5. cleanup_siws_nonces deletes rows older than 1 hour.
--
-- Service role bypasses RLS; no other role should access this table.

create table if not exists public.siws_nonces (
  nonce text primary key,
  wallet_address text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists siws_nonces_expires_idx
  on public.siws_nonces (expires_at);

alter table public.siws_nonces enable row level security;

comment on table public.siws_nonces is
  'Single-use server-issued nonces for SIWS verification. Bound to a wallet at issue time, valid for 5 minutes, atomically marked used during verify.';

-- ---------------------------------------------
-- Cleanup of old rows (used or expired).
-- ---------------------------------------------
create or replace function public.cleanup_siws_nonces()
returns void
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  delete from public.siws_nonces
  where expires_at < now() - interval '1 hour';
$$;

revoke all on function public.cleanup_siws_nonces() from public;
revoke all on function public.cleanup_siws_nonces() from anon;
revoke all on function public.cleanup_siws_nonces() from authenticated;
grant execute on function public.cleanup_siws_nonces() to service_role;

-- Drop any prior schedule with the same name, then schedule cleanup hourly.
do $$
begin
  perform cron.unschedule('cleanup_siws_nonces');
exception when others then
  null;
end $$;

select cron.schedule(
  'cleanup_siws_nonces',
  '0 * * * *',
  $$select public.cleanup_siws_nonces();$$
);
