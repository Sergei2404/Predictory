#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use context::*;

mod context;
mod error;
mod state;

declare_id!("EV4SZ8mid5j4AVTBsi9tE4faCVHuu2XEPk857KWvrnL4");

#[program]
pub mod predictory {
    use super::*;

    pub fn initialize_contract_state(
        ctx: Context<InitializeContractState>,
        authority: Pubkey,
        multiplier: u64,
        event_price: u64,
        platform_fee: u64,
        org_reward: u64,
    ) -> Result<()> {
        ctx.accounts.initialize_contract_state(
            authority,
            multiplier,
            event_price,
            platform_fee,
            org_reward,
        )
    }

    pub fn set_contract_authority(
        ctx: Context<UpdateContractState>,
        authority: Pubkey,
    ) -> Result<()> {
        ctx.accounts.set_authority(authority)
    }

    pub fn set_contract_multiplier(
        ctx: Context<UpdateContractState>,
        multiplier: u64,
    ) -> Result<()> {
        ctx.accounts.set_multiplier(multiplier)
    }

    pub fn set_event_price(ctx: Context<UpdateContractState>, event_price: u64) -> Result<()> {
        ctx.accounts.set_price(event_price)
    }

    pub fn set_contract_fee(ctx: Context<UpdateContractState>, fee: u64) -> Result<()> {
        ctx.accounts.set_platform_fee(fee)
    }

    pub fn set_org_reward(ctx: Context<UpdateContractState>, reward: u64) -> Result<()> {
        ctx.accounts.set_org_reward(reward)
    }

    pub fn create_user(ctx: Context<CreateUser>, name: [u8; 32]) -> Result<()> {
        ctx.accounts.create_user(name)
    }

    pub fn transfer_stake(ctx: Context<TransferStake>, stake: u64) -> Result<()> {
        ctx.accounts.transfer_stake(stake)
    }

    pub fn withdraw_stake(ctx: Context<WithdrawStake>, amount: Option<u64>) -> Result<()> {
        ctx.accounts.withdraw(amount)
    }

    pub fn create_event(
        ctx: Context<CreateEvent>,
        event_id: u128,
        args: CreateEventArgs,
    ) -> Result<()> {
        ctx.accounts.create_event(event_id, args)
    }

    pub fn update_event_name(
        ctx: Context<UpdateEvent>,
        event_id: u128,
        name: [u8; 32],
    ) -> Result<()> {
        ctx.accounts.update_event_name(event_id, name)
    }

    pub fn update_event_description(
        ctx: Context<UpdateEvent>,
        event_id: u128,
        description: [u8; 256],
    ) -> Result<()> {
        ctx.accounts.update_event_description(event_id, description)
    }

    pub fn update_event_end_date(
        ctx: Context<UpdateEvent>,
        event_id: u128,
        end_date: i64,
    ) -> Result<()> {
        ctx.accounts.update_event_end_date(event_id, end_date)
    }

    pub fn update_event_participation_deadline(
        ctx: Context<UpdateEvent>,
        event_id: u128,
        deadline: Option<i64>,
    ) -> Result<()> {
        ctx.accounts
            .update_event_participation_deadline(event_id, deadline)
    }

    pub fn create_event_option(
        ctx: Context<CreateEventOption>,
        event_id: u128,
        index: u8,
        description: [u8; 256],
    ) -> Result<()> {
        ctx.accounts
            .create_event_option(event_id, index, description)
    }

    pub fn update_event_option(
        ctx: Context<UpdateEventOption>,
        event_id: u128,
        index: u8,
        description: [u8; 256],
    ) -> Result<()> {
        ctx.accounts
            .update_event_option(event_id, index, description)
    }

    pub fn cancel_event(ctx: Context<CancelEvent>, event_id: u128) -> Result<()> {
        ctx.accounts.cancel_event(event_id)
    }

    pub fn complete_event(ctx: Context<CompleteEvent>, event_id: u128, result: u8) -> Result<()> {
        ctx.accounts.complete_event(event_id, result)
    }

    pub fn vote(ctx: Context<Vote>, event_id: u128, option_ix: u8, amount: u64) -> Result<()> {
        ctx.accounts.vote(event_id, option_ix, amount)
    }

    pub fn claim_event_reward(ctx: Context<ClaimEventReward>, event_id: u128) -> Result<()> {
        ctx.accounts.claim_event_reward(event_id)
    }

    pub fn recharge(ctx: Context<Recharge>, event_id: u128) -> Result<()> {
        ctx.accounts.recharge(event_id)
    }

    pub fn appeal(ctx: Context<AppealResult>, event_id: u128) -> Result<()> {
        ctx.accounts.appeal(event_id)
    }

    pub fn burn_trust(ctx: Context<BurnTrust>, event_id: u128) -> Result<()> {
        ctx.accounts.burn_trust(event_id)
    }
}
