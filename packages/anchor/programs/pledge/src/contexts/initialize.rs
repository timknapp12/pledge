use anchor_lang::prelude::*;

use crate::constants::CONFIG_SEED;
use crate::errors::ErrorCode;
use crate::state::{ConfigInitialized, ProgramConfig};

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// The signer who initializes becomes the admin.
    /// For dev: use a generated test keypair.
    /// For prod: use your secure wallet.
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = ProgramConfig::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, ProgramConfig>,

    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(
        &mut self,
        treasury: Pubkey,
        charity: Pubkey,
        treasury_split_bps: u16,
        partial_fee_bps: u16,
        edit_penalty_bps: u16,
        grace_period_seconds: i64,
        bumps: &InitializeBumps,
    ) -> Result<()> {
        // Validate parameters
        require!(
            treasury_split_bps <= 10000,
            ErrorCode::InvalidTreasurySplit
        );
        require!(partial_fee_bps <= 1000, ErrorCode::InvalidFee);
        require!(edit_penalty_bps <= 1000, ErrorCode::InvalidFee);

        // Initialize config
        self.config.set_inner(ProgramConfig {
            admin: self.admin.key(),
            treasury,
            charity,
            treasury_split_bps,
            partial_fee_bps,
            edit_penalty_bps,
            grace_period_seconds,
            paused: false,
            bump: bumps.config,
        });

        emit!(ConfigInitialized {
            admin: self.admin.key(),
            treasury,
            charity,
        });

        Ok(())
    }
}
