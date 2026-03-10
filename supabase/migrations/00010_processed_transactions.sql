-- Processed transactions table for indexer idempotency.
-- The Helius webhook indexer checks this table before processing
-- a transaction to avoid duplicate writes.

CREATE TABLE processed_transactions (
  tx_signature text PRIMARY KEY,
  event_type text NOT NULL,
  processed_at timestamptz DEFAULT now()
);

-- Only the service role (Edge Functions) should access this table.
ALTER TABLE processed_transactions ENABLE ROW LEVEL SECURITY;

-- No RLS policies = no access via anon/authenticated keys.
-- Service role bypasses RLS by default.
