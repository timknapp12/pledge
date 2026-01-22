use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Token, TokenAccount, Transfer};

use crate::constants::{CONFIG_SEED, PLEDGE_SEED, VAULT_SEED};
use crate::errors::ErrorCode;
use crate::state::{Pledge, PledgeEdited, PledgeStatus, ProgramConfig};
use crate::utils::fees::{calculate_edit_penalty, calculate_split};

#[derive(Accounts)]
pub struct EditPledge<'info> {
    #[account(
        constraint = user.key() == pledge.user @ ErrorCode::NotPledgeOwner
    )]
    pub user: Signer<'info>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = !config.paused @ ErrorCode::ProgramPaused
    )]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        mut,
        seeds = [PLEDGE_SEED, pledge.user.as_ref(), &pledge.created_at.to_le_bytes()],
        bump = pledge.bump,
        constraint = pledge.status == PledgeStatus::Active @ ErrorCode::PledgeNotActive
    )]
    pub pledge: Account<'info, Pledge>,

    #[account(
        mut,
        seeds = [VAULT_SEED, pledge.key().as_ref()],
        bump = pledge.vault_bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pledge.mint,
        token::authority = config.treasury
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = pledge.mint,
        token::authority = config.charity
    )]
    pub charity_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl<'info> EditPledge<'info> {
    pub fn edit_pledge(&mut self, new_deadline: Option<i64>) -> Result<()> {
        let clock = Clock::get()?;

        // Validate deadline hasn't passed
        require!(
            clock.unix_timestamp < self.pledge.deadline,
            ErrorCode::DeadlineAlreadyPassed
        );

        // Calculate 10% penalty from remaining stake
        let penalty = calculate_edit_penalty(self.pledge.stake_amount, self.config.edit_penalty_bps)?;

        // Calculate treasury/charity split
        let (treasury_amount, charity_amount) =
            calculate_split(penalty, self.config.treasury_split_bps)?;

        // Create PDA signer seeds for pledge (which is the vault authority)
        let user_key = self.pledge.user;
        let created_at_bytes = self.pledge.created_at.to_le_bytes();
        let pledge_seeds = &[
            PLEDGE_SEED,
            user_key.as_ref(),
            created_at_bytes.as_ref(),
            &[self.pledge.bump],
        ];
        let signer_seeds = &[&pledge_seeds[..]];

        // Transfer penalty to treasury
        if treasury_amount > 0 {
            let transfer_ctx = CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.vault.to_account_info(),
                    to: self.treasury_token_account.to_account_info(),
                    authority: self.pledge.to_account_info(),
                },
                signer_seeds,
            );
            transfer(transfer_ctx, treasury_amount)?;
        }

        // Transfer penalty to charity
        if charity_amount > 0 {
            let transfer_ctx = CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.vault.to_account_info(),
                    to: self.charity_token_account.to_account_info(),
                    authority: self.pledge.to_account_info(),
                },
                signer_seeds,
            );
            transfer(transfer_ctx, charity_amount)?;
        }

        // Update stake amount
        self.pledge.stake_amount = self
            .pledge
            .stake_amount
            .checked_sub(penalty)
            .ok_or(ErrorCode::Underflow)?;

        // Update deadline if provided
        if let Some(deadline) = new_deadline {
            require!(deadline > clock.unix_timestamp, ErrorCode::InvalidDeadline);
            self.pledge.deadline = deadline;
        }

        emit!(PledgeEdited {
            pledge: self.pledge.key(),
            penalty_paid: penalty,
        });

        Ok(())
    }
}
