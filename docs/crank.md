# Crank Service

## Overview

The crank is a Supabase Edge Function (`process-crank`) that processes expired pledges past their deadline + grace period. It runs periodically via pg_cron or can be invoked manually.

**Location:** `supabase/functions/process-crank/index.ts`

---

## What It Does

For each Active pledge where `deadline + 24h grace` has passed:

1. **Verify on-chain status** — fetch the Pledge account; skip if already processed
2. **Calculate completion %** — from daily_progress rows and todos
3. **Call `process_expired`** — on-chain instruction that distributes funds based on completion
4. **Update DB** — set status to Completed/Forfeited, store completion % and tx signature
5. **Cancel pending notifications** — remove any unsent reminders for that pledge

---

## Environment Variables

Set via `supabase secrets set`:

| Variable                    | Description                                                      |
| --------------------------- | ---------------------------------------------------------------- |
| `CRANK_KEYPAIR`             | Base58-encoded secret key — must match `config.crank_authority`  |
| `HELIUS_API_KEY`            | Helius RPC API key (works for devnet and mainnet)                |
| `SOLANA_NETWORK`            | `devnet` or `mainnet` (defaults to `mainnet`)                    |
| `FUNCTION_SECRET`           | Shared secret for auth (optional — if unset, no auth check)     |
| `SUPABASE_URL`              | Auto-set by Supabase                                             |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set by Supabase                                             |

---

## CLI Commands

### Deploy

```bash
supabase functions deploy process-crank --no-verify-jwt --project-ref ejgcfgjkwlkblwrqtqbr
```

Note: `--no-verify-jwt` is required because the function uses `FUNCTION_SECRET` bearer auth instead of Supabase JWT verification.

### Set Secrets

```bash
supabase secrets set --project-ref ejgcfgjkwlkblwrqtqbr \
  CRANK_KEYPAIR=<base58-encoded-keypair> \
  HELIUS_API_KEY=<helius-api-key> \
  SOLANA_NETWORK=devnet
```

Leave off `SOLANA_NETWORK` for mainnet (defaults to `mainnet`).

### Manual Test

```bash
curl -X POST https://ejgcfgjkwlkblwrqtqbr.supabase.co/functions/v1/process-crank \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json"
```

Find the service role key in the Supabase dashboard: Project Settings > API > service_role key.

### View Logs

```bash
supabase functions logs process-crank --project-ref ejgcfgjkwlkblwrqtqbr
```

---

## pg_cron Setup

Run this SQL once (via Supabase SQL editor) to schedule the crank every 6 hours.

**Important:** Use hardcoded URL and service role key — `current_setting('app.settings.*')` is not configured on Supabase hosted projects.

```sql
SELECT cron.schedule(
  'process-expired-pledges',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/process-crank',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <service-role-key>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

This runs at 00:00, 06:00, 12:00, and 18:00 UTC daily.

### Manage the cron job

```sql
-- List all cron jobs
SELECT * FROM cron.job;

-- Unschedule
SELECT cron.unschedule('process-expired-pledges');

-- View recent runs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

---

## Fund Flow

| Completion | User Gets                     | Fee                                     | Destination                                   |
| ---------- | ----------------------------- | --------------------------------------- | --------------------------------------------- |
| 100%       | Full stake                    | None                                    | —                                             |
| 1–99%      | Proportional amount minus fee | `partialFeeBps` (1%) on returned amount | Treasury/Charity split per `treasurySplitBps` |
| 0%         | Nothing                       | Full stake forfeited                    | Treasury/Charity split per `treasurySplitBps` |

---

## Troubleshooting

### "On-chain account not found"

- The PDA derivation uses `wallet_address` + `created_at` timestamp. If the DB `created_at` doesn't match the on-chain seed, the crank falls back to `on_chain_address`.
- Ensure pledges have a valid `on_chain_address` or matching `wallet_address` + `created_at`.

### Transaction fails

- Check that the crank wallet has enough SOL for fees.
- Verify the crank wallet pubkey matches `config.crank_authority` on-chain.
- Check Helius API key is valid and not rate-limited.

### Crank not running (pg_cron)

- Check `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;`
- If you see `unrecognized configuration parameter "app.settings.supabase_url"`, the cron job needs hardcoded URL and key (see pg_cron Setup above).

### Pledge processed on-chain but DB not updated

- The crank detects this case: if on-chain status is not Active, it syncs the DB status and skips the transaction.
- Run the crank again — it will reconcile.

### Secrets not working

```bash
# List current secrets
supabase secrets list --project-ref ejgcfgjkwlkblwrqtqbr
```
