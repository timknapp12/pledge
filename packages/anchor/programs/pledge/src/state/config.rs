use anchor_lang::prelude::*;

#[account]
pub struct ProgramConfig {
    pub admin: Pubkey,           // Program admin (can update config)
    pub treasury: Pubkey,        // Treasury wallet (receives forfeitures)
    pub charity: Pubkey,         // Charity wallet (receives forfeitures)
    pub treasury_split_bps: u16, // Treasury % of forfeitures (7000 = 70%)
    pub partial_fee_bps: u16,    // Fee on partial completions (100 = 1%)
    pub edit_penalty_bps: u16,   // Penalty for editing (1000 = 10%)
    pub grace_period_seconds: i64, // Grace period after deadline (86400 = 1 day)
    pub paused: bool,            // Emergency pause flag
    pub bump: u8,
}

impl ProgramConfig {
    pub const INIT_SPACE: usize = 8 +  // discriminator
        32 +    // admin
        32 +    // treasury
        32 +    // charity
        2 +     // treasury_split_bps
        2 +     // partial_fee_bps
        2 +     // edit_penalty_bps
        8 +     // grace_period_seconds
        1 +     // paused
        1; // bump
}

#[event]
pub struct ConfigInitialized {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub charity: Pubkey,
}

#[event]
pub struct ConfigUpdated {
    pub field: String,
    pub old_value: String,
    pub new_value: String,
}
