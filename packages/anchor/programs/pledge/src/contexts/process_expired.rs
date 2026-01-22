use anchor_lang::prelude::*;
use anchor_spl::token::{close_account, transfer, CloseAccount, Token, TokenAccount, Transfer};

use crate::constants::{CONFIG_SEED, PLEDGE_SEED, VAULT_SEED};
use crate::errors::ErrorCode;
use crate::state::{Pledge, PledgeCompleted, PledgeForfeited, PledgeStatus, ProgramConfig};
use crate::utils::fees::{calculate_partial_refund, calculate_split};

#[derive(Accounts)]
pub struct ProcessExpired<'info> {
    /// Any signer can be the crank - permissionless
    pub crank: Signer<'info>,

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

    #[account(
        mut,
        seeds = [VAULT_SEED, pledge.key().as_ref()],
        bump = pledge.vault_bump
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: This is the user who created the pledge, used for rent return
    #[account(mut, address = pledge.user)]
    pub user: AccountInfo<'info>,

    #[account(
        mut,
        token::mint = pledge.mint,
        token::authority = pledge.user
    )]
    pub user_token_account: Account<'info, TokenAccount>,

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

impl<'info> ProcessExpired<'info> {
    pub fn process_expired(&mut self, completion_percentage: u8) -> Result<()> {
        let clock = Clock::get()?;

        // Validate grace period has ended
        let grace_period_end = self
            .pledge
            .deadline
            .checked_add(self.config.grace_period_seconds)
            .ok_or(ErrorCode::Overflow)?;
        require!(
            clock.unix_timestamp > grace_period_end,
            ErrorCode::GracePeriodNotEnded
        );

        // Validate completion percentage
        require!(
            completion_percentage <= 100,
            ErrorCode::InvalidCompletionPercentage
        );

        // Calculate refund and fee based on completion (passed from DB data)
        let (refund_amount, fee_amount) = calculate_partial_refund(
            self.pledge.stake_amount,
            completion_percentage,
            self.config.partial_fee_bps,
        )?;

        // Calculate forfeited amount
        let forfeited_amount = self
            .pledge
            .stake_amount
            .checked_sub(refund_amount)
            .ok_or(ErrorCode::Underflow)?
            .checked_sub(fee_amount)
            .ok_or(ErrorCode::Underflow)?;

        // Total going to treasury/charity
        let total_to_split = fee_amount
            .checked_add(forfeited_amount)
            .ok_or(ErrorCode::Overflow)?;

        let (treasury_amount, charity_amount) =
            calculate_split(total_to_split, self.config.treasury_split_bps)?;

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

        // Transfer refund to user (if any)
        if refund_amount > 0 {
            let transfer_ctx = CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                Transfer {
                    from: self.vault.to_account_info(),
                    to: self.user_token_account.to_account_info(),
                    authority: self.pledge.to_account_info(),
                },
                signer_seeds,
            );
            transfer(transfer_ctx, refund_amount)?;
        }

        // Transfer to treasury (if any)
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

        // Transfer to charity (if any)
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

        // Close vault account (return rent to user)
        let close_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.vault.to_account_info(),
                destination: self.user.to_account_info(),
                authority: self.pledge.to_account_info(),
            },
            signer_seeds,
        );
        close_account(close_ctx)?;

        // Update pledge with completion data from crank
        self.pledge.completion_percentage = Some(completion_percentage);

        // Update status based on outcome
        if completion_percentage > 0 {
            self.pledge.status = PledgeStatus::Completed;
            emit!(PledgeCompleted {
                pledge: self.pledge.key(),
                completion_percentage,
                refund_amount,
                fee_amount,
            });
        } else {
            self.pledge.status = PledgeStatus::Forfeited;
            emit!(PledgeForfeited {
                pledge: self.pledge.key(),
                treasury_amount,
                charity_amount,
            });
        }

        Ok(())
    }
}
