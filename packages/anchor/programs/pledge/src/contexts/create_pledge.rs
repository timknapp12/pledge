use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer, Mint, Token, TokenAccount, Transfer},
};

use crate::constants::{CONFIG_SEED, PLEDGE_SEED, VAULT_SEED};
use crate::errors::ErrorCode;
use crate::state::{Pledge, PledgeCreated, PledgeStatus, ProgramConfig};

#[derive(Accounts)]
pub struct CreatePledge<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = !config.paused @ ErrorCode::ProgramPaused
    )]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        init,
        payer = user,
        space = Pledge::INIT_SPACE,
        seeds = [PLEDGE_SEED, user.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub pledge: Account<'info, Pledge>,

    #[account(
        init,
        payer = user,
        token::mint = mint,
        token::authority = pledge,
        seeds = [VAULT_SEED, pledge.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> CreatePledge<'info> {
    pub fn create_pledge(
        &mut self,
        stake_amount: u64,
        deadline: i64,
        bumps: &CreatePledgeBumps,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let created_at = clock.unix_timestamp;

        // Validate inputs
        require!(stake_amount > 0, ErrorCode::InvalidStakeAmount);
        require!(deadline > created_at, ErrorCode::InvalidDeadline);

        // Transfer tokens from user to vault
        let transfer_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.user_token_account.to_account_info(),
                to: self.vault.to_account_info(),
                authority: self.user.to_account_info(),
            },
        );
        transfer(transfer_ctx, stake_amount)?;

        // Initialize pledge account
        self.pledge.set_inner(Pledge {
            user: self.user.key(),
            mint: self.mint.key(),
            stake_amount,
            deadline,
            status: PledgeStatus::Active,
            completion_percentage: None,
            reported_at: None,
            created_at,
            bump: bumps.pledge,
            vault_bump: bumps.vault,
        });

        emit!(PledgeCreated {
            pledge: self.pledge.key(),
            user: self.user.key(),
            stake_amount,
            deadline,
        });

        Ok(())
    }
}
