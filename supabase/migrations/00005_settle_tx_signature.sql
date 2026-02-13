-- Add settle_tx_signature to pledges table
-- Stores the on-chain transaction signature when a user self-settles (report + process_completion)
-- Provides an audit trail linking DB status change to a verifiable on-chain transaction
ALTER TABLE pledges ADD COLUMN IF NOT EXISTS settle_tx_signature text;
