use anchor_lang::prelude::*;

declare_id!("C8rKxSHRihYaPRfc8S81TexwD36LU5rFK134miYAgrjp");

#[program]
pub mod pledge {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
