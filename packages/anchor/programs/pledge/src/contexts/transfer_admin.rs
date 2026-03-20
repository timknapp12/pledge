use anchor_lang::prelude::*;

use crate::constants::CONFIG_SEED;
use crate::errors::ErrorCode;
use crate::state::{AdminTransferAccepted, AdminTransferProposed, ProgramConfig};

#[derive(Accounts)]
pub struct ProposeAdminTransfer<'info> {
    #[account(
        mut,
        constraint = admin.key() == config.admin @ ErrorCode::Unauthorized
    )]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        realloc = ProgramConfig::INIT_SPACE,
        realloc::payer = admin,
        realloc::zero = false
    )]
    pub config: Account<'info, ProgramConfig>,

    pub system_program: Program<'info, System>,
}

impl<'info> ProposeAdminTransfer<'info> {
    pub fn propose_admin_transfer(&mut self, new_admin: Pubkey) -> Result<()> {
        self.config.pending_admin = Some(new_admin);

        emit!(AdminTransferProposed {
            current_admin: self.config.admin,
            pending_admin: new_admin,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct AcceptAdminTransfer<'info> {
    pub new_admin: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = config.pending_admin.is_some() @ ErrorCode::NoPendingAdminTransfer,
        constraint = config.pending_admin.unwrap() == new_admin.key() @ ErrorCode::NotPendingAdmin
    )]
    pub config: Account<'info, ProgramConfig>,
}

impl<'info> AcceptAdminTransfer<'info> {
    pub fn accept_admin_transfer(&mut self) -> Result<()> {
        let old_admin = self.config.admin;
        let new_admin = self.new_admin.key();

        self.config.admin = new_admin;
        self.config.pending_admin = None;

        emit!(AdminTransferAccepted {
            old_admin,
            new_admin,
        });

        Ok(())
    }
}
