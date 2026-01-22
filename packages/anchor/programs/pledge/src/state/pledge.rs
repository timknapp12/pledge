use anchor_lang::prelude::*;

#[account]
pub struct Pledge {
    pub user: Pubkey,                       // User who created the pledge
    pub mint: Pubkey,                       // Token mint (USDC)
    pub stake_amount: u64,                  // Amount staked (USDC has 6 decimals)
    pub deadline: i64,                      // Unix timestamp when pledge ends
    pub status: PledgeStatus,               // Current status
    pub completion_percentage: Option<u8>,  // Reported completion (0-100)
    pub reported_at: Option<i64>,           // When user reported completion
    pub created_at: i64,                    // When pledge was created
    pub bump: u8,
    pub vault_bump: u8, // Bump for token vault PDA
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PledgeStatus {
    Active,    // Pledge is ongoing
    Reported,  // User reported, awaiting processing
    Completed, // Processed with refund
    Forfeited, // Processed with forfeiture
    Cancelled, // User cancelled (if allowed)
}

impl Default for PledgeStatus {
    fn default() -> Self {
        PledgeStatus::Active
    }
}

impl Pledge {
    pub const INIT_SPACE: usize = 8 +  // discriminator
        32 +    // user
        32 +    // mint
        8 +     // stake_amount
        8 +     // deadline
        1 +     // status (enum)
        1 + 1 + // completion_percentage (Option<u8>)
        1 + 8 + // reported_at (Option<i64>)
        8 +     // created_at
        1 +     // bump
        1; // vault_bump
}

#[event]
pub struct PledgeCreated {
    pub pledge: Pubkey,
    pub user: Pubkey,
    pub stake_amount: u64,
    pub deadline: i64,
}

#[event]
pub struct PledgeEdited {
    pub pledge: Pubkey,
    pub penalty_paid: u64,
}

#[event]
pub struct CompletionReported {
    pub pledge: Pubkey,
    pub completion_percentage: u8,
}

#[event]
pub struct PledgeCompleted {
    pub pledge: Pubkey,
    pub completion_percentage: u8,
    pub refund_amount: u64,
    pub fee_amount: u64,
}

#[event]
pub struct PledgeForfeited {
    pub pledge: Pubkey,
    pub treasury_amount: u64,
    pub charity_amount: u64,
}
