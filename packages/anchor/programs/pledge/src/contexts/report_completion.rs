use anchor_lang::prelude::*;

use crate::constants::{CONFIG_SEED, PLEDGE_SEED};
use crate::errors::ErrorCode;
use crate::state::{CompletionReported, Pledge, PledgeStatus, ProgramConfig};

#[derive(Accounts)]
pub struct ReportCompletion<'info> {
    #[account(
        constraint = user.key() == pledge.user @ ErrorCode::NotPledgeOwner
    )]
    pub user: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump
    )]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        mut,
        seeds = [PLEDGE_SEED, pledge.user.as_ref(), &pledge.created_at.to_le_bytes()],
        bump = pledge.bump,
        constraint = pledge.status == PledgeStatus::Active @ ErrorCode::PledgeNotActive
    )]
    pub pledge: Account<'info, Pledge>,
}

impl<'info> ReportCompletion<'info> {
    pub fn report_completion(&mut self, completion_percentage: u8) -> Result<()> {
        let clock = Clock::get()?;

        // Validate completion percentage
        require!(
            completion_percentage <= 100,
            ErrorCode::InvalidCompletionPercentage
        );

        // No time constraints — user can report at any time (before or after deadline).
        // The crank handles users who forget (via process_expired after grace period).

        // Update pledge
        self.pledge.completion_percentage = Some(completion_percentage);
        self.pledge.reported_at = Some(clock.unix_timestamp);
        self.pledge.status = PledgeStatus::Reported;

        emit!(CompletionReported {
            pledge: self.pledge.key(),
            completion_percentage,
        });

        Ok(())
    }
}
