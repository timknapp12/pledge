use anchor_lang::prelude::*;

use crate::constants::CONFIG_SEED;
use crate::errors::ErrorCode;
use crate::state::{ConfigUpdated, ProgramConfig};

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        constraint = admin.key() == config.admin @ ErrorCode::Unauthorized
    )]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump
    )]
    pub config: Account<'info, ProgramConfig>,
}

impl<'info> UpdateConfig<'info> {
    pub fn update_config(
        &mut self,
        new_treasury: Option<Pubkey>,
        new_charity: Option<Pubkey>,
        new_treasury_split_bps: Option<u16>,
        new_partial_fee_bps: Option<u16>,
        new_edit_penalty_bps: Option<u16>,
        new_grace_period_seconds: Option<i64>,
        paused: Option<bool>,
    ) -> Result<()> {
        if let Some(treasury) = new_treasury {
            emit!(ConfigUpdated {
                field: "treasury".to_string(),
                old_value: self.config.treasury.to_string(),
                new_value: treasury.to_string(),
            });
            self.config.treasury = treasury;
        }

        if let Some(charity) = new_charity {
            emit!(ConfigUpdated {
                field: "charity".to_string(),
                old_value: self.config.charity.to_string(),
                new_value: charity.to_string(),
            });
            self.config.charity = charity;
        }

        if let Some(split_bps) = new_treasury_split_bps {
            require!(split_bps <= 10000, ErrorCode::InvalidTreasurySplit);
            emit!(ConfigUpdated {
                field: "treasury_split_bps".to_string(),
                old_value: self.config.treasury_split_bps.to_string(),
                new_value: split_bps.to_string(),
            });
            self.config.treasury_split_bps = split_bps;
        }

        if let Some(fee_bps) = new_partial_fee_bps {
            require!(fee_bps <= 1000, ErrorCode::InvalidFee);
            emit!(ConfigUpdated {
                field: "partial_fee_bps".to_string(),
                old_value: self.config.partial_fee_bps.to_string(),
                new_value: fee_bps.to_string(),
            });
            self.config.partial_fee_bps = fee_bps;
        }

        if let Some(penalty_bps) = new_edit_penalty_bps {
            require!(penalty_bps <= 1000, ErrorCode::InvalidFee);
            emit!(ConfigUpdated {
                field: "edit_penalty_bps".to_string(),
                old_value: self.config.edit_penalty_bps.to_string(),
                new_value: penalty_bps.to_string(),
            });
            self.config.edit_penalty_bps = penalty_bps;
        }

        if let Some(grace_period) = new_grace_period_seconds {
            emit!(ConfigUpdated {
                field: "grace_period_seconds".to_string(),
                old_value: self.config.grace_period_seconds.to_string(),
                new_value: grace_period.to_string(),
            });
            self.config.grace_period_seconds = grace_period;
        }

        if let Some(pause_state) = paused {
            emit!(ConfigUpdated {
                field: "paused".to_string(),
                old_value: self.config.paused.to_string(),
                new_value: pause_state.to_string(),
            });
            self.config.paused = pause_state;
        }

        Ok(())
    }
}
