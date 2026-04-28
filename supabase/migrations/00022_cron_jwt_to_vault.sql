-- Security audit fixes (continued):
--   - Stop hardcoding the service-role JWT in cron.job command bodies.
--     Anyone with SELECT on cron.job (superusers + Supabase team by default)
--     can read it verbatim. Store it in vault.secrets and read at job-run time.
--   - Move pg_net out of the public schema. Flagged by advisors.
--
-- IMPORTANT: re-uses whatever JWT and project URL are already embedded in
-- cron.job, so this migration is portable across pledge-dev and pledge-mainnet
-- without per-project edits. Idempotent — safe to re-apply.

-- ---------------------------------------------
-- 1. Capture the existing service-role JWT and project URL into vault.
-- ---------------------------------------------
do $$
declare
  v_jwt text;
  v_project_url text;
begin
  -- Pull JWT out of any existing http_post job.
  select substring(command from 'Bearer ([A-Za-z0-9_\-\.]+)')
  into v_jwt
  from cron.job
  where command like '%Bearer %'
  limit 1;

  -- Pull the project's supabase URL (https://<ref>.supabase.co) out of the same job.
  select substring(command from '(https://[^/'']+\.supabase\.co)')
  into v_project_url
  from cron.job
  where command like '%supabase.co/functions%'
  limit 1;

  if v_jwt is null then
    raise exception 'Could not extract service-role JWT from cron.job; aborting';
  end if;
  if v_project_url is null then
    raise exception 'Could not extract project URL from cron.job; aborting';
  end if;

  if not exists (select 1 from vault.secrets where name = 'service_role_jwt') then
    perform vault.create_secret(
      v_jwt,
      'service_role_jwt',
      'Service-role JWT used by pg_cron jobs to invoke Edge Functions.'
    );
  end if;

  if not exists (select 1 from vault.secrets where name = 'project_url') then
    perform vault.create_secret(
      v_project_url,
      'project_url',
      'Base URL of this Supabase project (https://<ref>.supabase.co).'
    );
  end if;
end $$;

-- ---------------------------------------------
-- 2. Reschedule the http_post cron jobs to read both URL + JWT from vault.
--    cron.schedule with the same name overwrites the existing entry.
-- ---------------------------------------------
select cron.schedule(
  'process-expired-pledges',
  '0 */6 * * *',
  $cmd$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1)
            || '/functions/v1/process-crank',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt' limit 1)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

select cron.schedule(
  'daily-reconcile',
  '0 3 * * *',
  $cmd$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1)
            || '/functions/v1/daily-reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt' limit 1)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

select cron.schedule(
  'send-notifications',
  '*/2 * * * *',
  $cmd$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1)
            || '/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt' limit 1)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);

-- Note: pg_net does not support `alter extension ... set schema`, so the
-- "extension in public schema" advisor warning is left as-is. The functions
-- still live in the `net` schema; only the extension catalog entry is in public.
-- Cosmetic only.
