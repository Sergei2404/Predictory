use anchor_lang::prelude::*;

use crate::{
    context::{transfer_sol, withdraw_sol, INITIAL_LVL},
    error::ProgramError,
    id,
    state::user::User,
};

// --------------------------- Context ----------------------------- //

#[derive(Accounts)]
pub struct CreateUser<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        init,
        payer = sender,
        owner = id(),
        seeds = [b"user".as_ref(), sender.key().as_ref()],
        bump,
        space = User::LEN
    )]
    pub user: Account<'info, User>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferStake<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        mut,
        seeds = [b"user".as_ref(), sender.key().as_ref()],
        bump,
    )]
    pub user: Account<'info, User>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawStake<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        mut,
        seeds = [b"user".as_ref(), sender.key().as_ref()],
        bump,
    )]
    pub user: Account<'info, User>,

    pub system_program: Program<'info, System>,
}

// ------------------------ Implementation ------------------------- //

impl CreateUser<'_> {
    pub fn create_user(&mut self, name: [u8; 32]) -> Result<()> {
        let user = &mut self.user;

        user.name = name;
        user.payer = self.sender.key();
        user.trust_lvl = INITIAL_LVL;
        user.version = User::VERSION;

        msg!("New user created {}", user.payer,);

        Ok(())
    }
}

impl TransferStake<'_> {
    pub fn transfer_stake(&mut self, stake: u64) -> Result<()> {
        transfer_sol(
            self.sender.to_account_info(),
            self.user.to_account_info(),
            stake,
            self.system_program.to_account_info(),
        )?;

        let user = &mut self.user;
        user.stake += stake;

        msg!("New user created {}", user.payer,);

        Ok(())
    }
}

impl WithdrawStake<'_> {
    pub fn withdraw(&mut self, withdraw_amount: Option<u64>) -> Result<()> {
        let user = &mut self.user;

        let amount = if let Some(amount) = withdraw_amount {
            require!(amount < user.stake, ProgramError::InsufficientFunds);
            amount
        } else {
            user.stake
        };

        if amount == 0 {
            msg!("User has no available stake - {}", self.user.payer,);
            return Ok(());
        }

        withdraw_sol(
            &user.to_account_info(),
            &self.sender.to_account_info(),
            amount,
        )?;

        user.stake -= amount;

        msg!("User stake withdrawn - {amount} for {}", self.user.payer,);

        Ok(())
    }
}
