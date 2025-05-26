use anchor_lang::prelude::*;

use crate::{error::ProgramError, id, program::Predictory, state::contract_state::State};

// --------------------------- Context ----------------------------- //

#[derive(Accounts)]
pub struct InitializeContractState<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        owner = id(),
        seeds = [b"state".as_ref()],
        bump,
        space = State::LEN
    )]
    pub state: Account<'info, State>,

    #[account(
        constraint = program_account.key() == id() @ ProgramError::InvalidProgramAccount,
        constraint = program_account.programdata_address()? == Some(program_data.key()) @ ProgramError::InvalidProgramData,
    )]
    pub program_account: Program<'info, Predictory>,

    #[account(
        constraint = program_data.upgrade_authority_address == Some(authority.key()) @ ProgramError::AuthorityMismatch,
    )]
    pub program_data: Account<'info, ProgramData>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateContractState<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"state".as_ref()],
        constraint = state.authority == authority.key() @ ProgramError::AuthorityMismatch,
        bump,
    )]
    pub state: Account<'info, State>,
}

// ------------------------ Implementation ------------------------- //

impl InitializeContractState<'_> {
    pub fn initialize_contract_state(
        &mut self,
        authority: Pubkey,
        multiplier: u64,
        event_price: u64,
        platform_fee: u64,
        org_reward: u64,
    ) -> Result<()> {
        let state = &mut self.state;

        state.authority = authority;
        state.multiplier = multiplier;
        state.event_price = event_price;
        state.platform_fee = platform_fee;
        state.org_reward = org_reward;
        state.version = State::VERSION;

        msg!("Contract state initialized");

        Ok(())
    }
}

impl UpdateContractState<'_> {
    pub fn set_authority(&mut self, authority: Pubkey) -> Result<()> {
        let state = &mut self.state;

        state.authority = authority;

        msg!("Contract state updated: authority set to {authority}",);

        Ok(())
    }

    pub fn set_multiplier(&mut self, multiplier: u64) -> Result<()> {
        let state = &mut self.state;

        state.multiplier = multiplier;

        msg!("Contract state multiplier updated",);

        Ok(())
    }

    pub fn set_price(&mut self, event_price: u64) -> Result<()> {
        let state = &mut self.state;

        state.event_price = event_price;

        msg!("Contract sale pricer updated",);

        Ok(())
    }

    pub fn set_platform_fee(&mut self, fee: u64) -> Result<()> {
        let state = &mut self.state;

        state.platform_fee = fee;

        msg!("Contract fee updated");

        Ok(())
    }

    pub fn set_org_reward(&mut self, reward: u64) -> Result<()> {
        let state = &mut self.state;

        state.org_reward = reward;

        msg!("Contract org reward updated");

        Ok(())
    }
}
