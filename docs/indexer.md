# Indexer & Sync Architecture

## Overview

The Pledge sync system has three layers:

1. **Frontend confirm-then-write** — immediate DB writes for metadata (name, todos, reminders)
2. **Helius webhook indexer** — real-time event-driven sync for on-chain state (status, amounts, settlement tx)
3. **Daily reconciliation** — server-side safety net that catches anything the indexer missed

On-chain is always the source of truth for status and funds. Supabase is the source of truth for metadata.

---

## Architecture

```
User Action (create/report/settle)
    │
    ├── Frontend: on-chain tx → confirm → write metadata to Supabase
    │
    └── On-chain program emits event
            │
            ▼
      Helius Webhook (real-time, ~1-5s)
            │
            ▼
      Supabase Edge Function: indexer
            │
            └── Upserts status/amounts to Supabase
                (idempotent via processed_transactions table)

Crank (every 6 hours via pg_cron)
    │
    └── Processes expired pledges on-chain
        └── Indexer picks up the resulting events

Daily Reconcile (once per day via pg_cron)
    │
    └── getProgramAccounts → compare with DB → fix mismatches
```

---

## Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `indexer` | Helius webhook POST | Real-time sync of on-chain events to DB |
| `daily-reconcile` | pg_cron (once/day) | Safety net — catches anything indexer missed |
| `process-crank` | pg_cron (every 6h) | Processes expired pledges on-chain |

---

## Deployment — Devnet

### 1. Deploy Edge Functions

```bash
# From repo root
supabase functions deploy indexer --project-ref ejgcfgjkwlkblwrqtqbr
supabase functions deploy daily-reconcile --project-ref ejgcfgjkwlkblwrqtqbr
```

### 2. Set Environment Variables

In the Supabase dashboard (Settings > Edge Functions > Secrets), or via CLI:

```bash
# Indexer webhook secret (generate a random string)
supabase secrets set WEBHOOK_SECRET="your-random-secret-here" --project-ref ejgcfgjkwlkblwrqtqbr

# These should already be set from previous deploys:
# HELIUS_API_KEY, SOLANA_NETWORK=devnet, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FUNCTION_SECRET
```

### 3. Run the processed_transactions Migration

This should already be applied (migration 00010). Verify:

```bash
supabase db push --project-ref ejgcfgjkwlkblwrqtqbr
```

Or check in the Supabase dashboard that the `processed_transactions` table exists.

### 4. Register Helius Webhook (Devnet)

Go to [Helius Dashboard](https://dashboard.helius.dev/) → Webhooks → Create Webhook:

- **Network:** Devnet
- **Webhook URL:** `https://ejgcfgjkwlkblwrqtqbr.supabase.co/functions/v1/indexer`
- **Transaction Type:** Any
- **Account Addresses:** `PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp`
- **Webhook Type:** Enhanced
- **Auth Header:** `Bearer your-random-secret-here` (must match WEBHOOK_SECRET)

Or via the Helius API:

```bash
curl -X POST https://api.helius.xyz/v0/webhooks?api-key=YOUR_HELIUS_API_KEY \
  -H "Content-Type: application/json" \
  -d '{
    "webhookURL": "https://ejgcfgjkwlkblwrqtqbr.supabase.co/functions/v1/indexer",
    "transactionTypes": ["ANY"],
    "accountAddresses": ["PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp"],
    "webhookType": "enhanced",
    "authHeader": "Bearer your-random-secret-here"
  }'
```

Save the returned webhook ID — you'll need it to update or delete the webhook later.

### 5. Set Up pg_cron for Daily Reconciliation

In the Supabase SQL editor, run:

```sql
-- Schedule daily reconciliation at 3:00 AM UTC
SELECT cron.schedule(
  'daily-reconcile',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ejgcfgjkwlkblwrqtqbr.supabase.co/functions/v1/daily-reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'YOUR_FUNCTION_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### 6. Test the Indexer

1. Create a pledge on devnet using the app
2. Check Supabase logs: Dashboard > Edge Functions > indexer > Logs
3. Verify the `processed_transactions` table has the tx signature
4. Check that the pledge status in DB matches on-chain

### 7. Test Daily Reconciliation

Invoke manually:

```bash
curl -X POST https://ejgcfgjkwlkblwrqtqbr.supabase.co/functions/v1/daily-reconcile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FUNCTION_SECRET"
```

Check the response — it should show `alreadyInSync` counts and zero errors.

---

## Deployment — Mainnet

### 1. Deploy Edge Functions

```bash
supabase functions deploy indexer --project-ref xbltaxjcpthidsglslxf
supabase functions deploy daily-reconcile --project-ref xbltaxjcpthidsglslxf
```

### 2. Set Environment Variables

```bash
supabase secrets set WEBHOOK_SECRET="a-DIFFERENT-secret-for-mainnet" --project-ref xbltaxjcpthidsglslxf

# Ensure these are set for mainnet:
# HELIUS_API_KEY (same key works for both networks)
# SOLANA_NETWORK=mainnet (or mainnet-beta)
# FUNCTION_SECRET (for crank + daily-reconcile auth)
```

### 3. Run the processed_transactions Migration

```bash
supabase db push --project-ref xbltaxjcpthidsglslxf
```

### 4. Register Helius Webhook (Mainnet)

Same process as devnet, but:

- **Network:** Mainnet
- **Webhook URL:** `https://xbltaxjcpthidsglslxf.supabase.co/functions/v1/indexer`
- **Auth Header:** Use the mainnet WEBHOOK_SECRET

```bash
curl -X POST https://api.helius.xyz/v0/webhooks?api-key=YOUR_HELIUS_API_KEY \
  -H "Content-Type: application/json" \
  -d '{
    "webhookURL": "https://xbltaxjcpthidsglslxf.supabase.co/functions/v1/indexer",
    "transactionTypes": ["ANY"],
    "accountAddresses": ["PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp"],
    "webhookType": "enhanced",
    "authHeader": "Bearer a-DIFFERENT-secret-for-mainnet"
  }'
```

### 5. Set Up pg_cron for Daily Reconciliation

```sql
SELECT cron.schedule(
  'daily-reconcile',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xbltaxjcpthidsglslxf.supabase.co/functions/v1/daily-reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'YOUR_FUNCTION_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## Monitoring

### Checking Indexer Health

1. **Supabase Dashboard:** Edge Functions > indexer > Logs — look for errors
2. **processed_transactions table:** Should have entries for recent program transactions
3. **Helius Dashboard:** Webhooks > check delivery status and error counts

### Checking Reconciliation Health

Invoke manually and check the response:

```bash
curl -X POST <FUNCTION_URL>/daily-reconcile \
  -H "Authorization: Bearer <FUNCTION_SECRET>" \
  -H "Content-Type: application/json"
```

A healthy response looks like:
```json
{
  "onChainTotal": 42,
  "dbTotal": 42,
  "alreadyInSync": 42,
  "statusFixed": 0,
  "completionFixed": 0,
  "missingCreated": 0,
  "errors": []
}
```

If `statusFixed` or `missingCreated` are consistently non-zero, the indexer may be missing events.

---

## Cost

| Component | Cost |
|-----------|------|
| Helius webhooks | Free tier (1M credits/month) |
| Supabase Edge Functions | Included in plan |
| pg_cron | Included in plan |
| **Total additional cost** | **$0** |

---

## Troubleshooting

### Indexer not receiving events

1. Check Helius Dashboard for webhook delivery errors
2. Verify WEBHOOK_SECRET matches between Helius config and Supabase secrets
3. Check Edge Function logs for auth failures (401s)
4. Verify the program ID matches in both the webhook config and the indexer code

### DB out of sync with chain

1. Run daily-reconcile manually to fix immediately
2. Check processed_transactions for gaps
3. Check Edge Function logs for errors during event processing

### Helius webhook stopped working

1. Check if the webhook is still active in the Helius Dashboard
2. Verify your Helius API key hasn't expired
3. Re-register the webhook if needed (the webhook ID is required for updates)
