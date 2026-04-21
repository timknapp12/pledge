-- Rate limiting for the rpc-proxy Edge Function.
-- Per-wallet limits prevent a single account from draining Helius credits;
-- the "global" bucket is a circuit breaker against coordinated abuse or runaway loops.

create table if not exists public.rpc_rate_limits (
  bucket_key text not null,        -- 'wallet:<pubkey>' or 'global:minute' / 'global:hour'
  window_start bigint not null,    -- minute bucket: floor(epoch_seconds / 60)
  request_count int not null default 0,
  primary key (bucket_key, window_start)
);

create index if not exists rpc_rate_limits_window_idx
  on public.rpc_rate_limits (window_start);

comment on table public.rpc_rate_limits is
  'Sliding-window counters used by the rpc-proxy Edge Function to rate-limit Helius RPC calls.';

-- Atomic increment + limit check in a single roundtrip.
-- Returns the new count and whether the request is allowed (count <= limit).
create or replace function public.increment_rpc_rate_limit(
  p_key text,
  p_window bigint,
  p_limit int
)
returns table(allowed boolean, current_count int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  insert into public.rpc_rate_limits (bucket_key, window_start, request_count)
  values (p_key, p_window, 1)
  on conflict (bucket_key, window_start)
  do update set request_count = public.rpc_rate_limits.request_count + 1
  returning public.rpc_rate_limits.request_count into v_count;

  allowed := v_count <= p_limit;
  current_count := v_count;
  return next;
end;
$$;

-- Only the Edge Function (service_role) should call this. Revoke from everyone else.
revoke all on function public.increment_rpc_rate_limit(text, bigint, int) from public;
revoke all on function public.increment_rpc_rate_limit(text, bigint, int) from anon;
revoke all on function public.increment_rpc_rate_limit(text, bigint, int) from authenticated;
grant execute on function public.increment_rpc_rate_limit(text, bigint, int) to service_role;

-- Keep only the last ~2 hours of buckets.
create or replace function public.cleanup_rpc_rate_limits()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.rpc_rate_limits
  where window_start < floor(extract(epoch from now()) / 60) - 120;
$$;

revoke all on function public.cleanup_rpc_rate_limits() from public;
grant execute on function public.cleanup_rpc_rate_limits() to service_role;

-- Drop any prior schedule with the same name, then schedule cleanup every 10 minutes.
do $$
begin
  perform cron.unschedule('cleanup_rpc_rate_limits');
exception when others then
  null;
end $$;

select cron.schedule(
  'cleanup_rpc_rate_limits',
  '*/10 * * * *',
  $$select public.cleanup_rpc_rate_limits();$$
);
