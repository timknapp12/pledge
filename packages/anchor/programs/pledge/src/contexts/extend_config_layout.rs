use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

use crate::constants::CONFIG_SEED;
use crate::errors::ErrorCode;
use crate::state::ProgramConfig;

/// Account data size after crank_authority + allowed_mint, before `pending_admin` was added.
pub const CONFIG_SIZE_BEFORE_PENDING_ADMIN: usize = 184;

/// One-time migration: realloc config from 184 → 217 bytes so `pending_admin` fits.
/// Required when the program was upgraded on-chain before `pending_admin` existed but
/// `update_config` could not run (Anchor deserializes before realloc).
#[derive(Accounts)]
pub struct ExtendConfigLayout<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: PDA [`CONFIG_SEED`]; owner, size, and admin pubkey verified in handler before resize.
    #[account(mut, seeds = [CONFIG_SEED], bump)]
    pub config: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> ExtendConfigLayout<'info> {
    pub fn extend_config_layout(&self) -> Result<()> {
        let info = self.config.to_account_info();
        require_keys_eq!(*info.owner, crate::ID, ErrorCode::InvalidProgramAccount);

        let current_len = info.data_len();
        require!(
            current_len == CONFIG_SIZE_BEFORE_PENDING_ADMIN,
            ErrorCode::ConfigMigrationSizeMismatch
        );

        {
            let data = info.try_borrow_data()?;
            let admin_bytes: [u8; 32] = data[8..40]
                .try_into()
                .map_err(|_| error!(ErrorCode::ConfigMigrationSizeMismatch))?;
            require_keys_eq!(
                Pubkey::new_from_array(admin_bytes),
                self.admin.key(),
                ErrorCode::Unauthorized
            );
        }

        let new_len = ProgramConfig::INIT_SPACE;
        let rent = Rent::get()?;
        let new_minimum_balance = rent.minimum_balance(new_len);
        let lamports_diff = new_minimum_balance.saturating_sub(info.lamports());

        if lamports_diff > 0 {
            system_program::transfer(
                CpiContext::new(
                    self.system_program.to_account_info(),
                    Transfer {
                        from: self.admin.to_account_info(),
                        to: self.config.to_account_info(),
                    },
                ),
                lamports_diff,
            )?;
        }

        info.realloc(new_len, false)?;

        let mut data = info.try_borrow_mut_data()?;
        for i in CONFIG_SIZE_BEFORE_PENDING_ADMIN..new_len {
            data[i] = 0;
        }

        Ok(())
    }
}
