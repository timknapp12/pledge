use anchor_lang::prelude::*;

pub mod constants;
pub mod contexts;
pub mod errors;
pub mod state;
pub mod utils;

pub use contexts::*;
pub use state::*;

declare_id!("PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp");

#[program]
pub mod pledge {
    use super::*;

    /// Initialize the program config (admin only, one-time setup)
    pub fn initialize(
        ctx: Context<Initialize>,
        treasury: Pubkey,
        charity: Pubkey,
        treasury_split_bps: u16,
        partial_fee_bps: u16,
        edit_penalty_bps: u16,
        grace_period_seconds: i64,
    ) -> Result<()> {
        ctx.accounts.initialize(
            treasury,
            charity,
            treasury_split_bps,
            partial_fee_bps,
            edit_penalty_bps,
            grace_period_seconds,
            &ctx.bumps,
        )
    }

    /// Update program config parameters (admin only)
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_treasury: Option<Pubkey>,
        new_charity: Option<Pubkey>,
        new_treasury_split_bps: Option<u16>,
        new_partial_fee_bps: Option<u16>,
        new_edit_penalty_bps: Option<u16>,
        new_grace_period_seconds: Option<i64>,
        paused: Option<bool>,
    ) -> Result<()> {
        ctx.accounts.update_config(
            new_treasury,
            new_charity,
            new_treasury_split_bps,
            new_partial_fee_bps,
            new_edit_penalty_bps,
            new_grace_period_seconds,
            paused,
        )
    }

    /// Create a new pledge and stake tokens
    pub fn create_pledge(
        ctx: Context<CreatePledge>,
        stake_amount: u64,
        deadline: i64,
        created_at: i64,
    ) -> Result<()> {
        ctx.accounts
            .create_pledge(stake_amount, deadline, created_at, &ctx.bumps)
    }

    /// Edit an existing pledge (10% penalty)
    pub fn edit_pledge(ctx: Context<EditPledge>, new_deadline: Option<i64>) -> Result<()> {
        ctx.accounts.edit_pledge(new_deadline)
    }

    /// Report completion percentage (user calls within grace period)
    pub fn report_completion(ctx: Context<ReportCompletion>, completion_percentage: u8) -> Result<()> {
        ctx.accounts.report_completion(completion_percentage)
    }

    /// Process a reported pledge (permissionless crank)
    pub fn process_completion(ctx: Context<ProcessCompletion>) -> Result<()> {
        ctx.accounts.process_completion()
    }

    /// Process an expired pledge that wasn't reported (permissionless crank)
    pub fn process_expired(ctx: Context<ProcessExpired>, completion_percentage: u8) -> Result<()> {
        ctx.accounts.process_expired(completion_percentage)
    }
}
