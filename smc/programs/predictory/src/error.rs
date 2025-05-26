use anchor_lang::prelude::*;

#[error_code]
pub enum ProgramError {
    #[msg("Authority mismatched")]
    AuthorityMismatch,
    #[msg("Invalid program data account")]
    InvalidProgramData,
    #[msg("Invalid program account")]
    InvalidProgramAccount,
    #[msg("Account has illegal owner")]
    IllegalOwner,
    #[msg("Event has already started")]
    EventAlreadyStarted,
    #[msg("Event is not over")]
    EventIsNotOver,
    #[msg("Low event volume")]
    LowEventVolume,
    #[msg("Invalid UUID version")]
    InvalidUUID,
    #[msg("Invalid sale end date")]
    InvalidEndDate,
    #[msg("Invalid index - must be sequential")]
    InvalidIndex,
    #[msg("Event has too many options")]
    TooManyOptions,
    #[msg("Event is inactive")]
    InactiveEvent,
    #[msg("Event is still active")]
    ActiveEvent,
    #[msg("Event creator cannot be a participant")]
    CreatorParticipation,
    #[msg("Stake can be withdrawn only after the event is over and appellation time has passed")]
    EarlyStakeWithdraw,
    #[msg("Reward can be withdrawn only after the event is over and completion time + appellation time has passed")]
    EarlyClaim,
    #[msg("Appellation deadline passed")]
    AppellationDeadlinePassed,
    #[msg("Participation deadline passed")]
    ParticipationDeadlinePassed,
    #[msg("Event is canceled")]
    CanceledEvent,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Already appealed")]
    AlreadyAppealed,
    #[msg("This option has lost")]
    LosingOption,
    #[msg("Event is not cancelled")]
    EventIsNotCancelled,
    #[msg("All user stake is locked")]
    AllStakeLocked,
    #[msg("Low stake to create event")]
    StakeTooLow,
    #[msg("Not enough trust to burn")]
    NotEnoughTrust,
    #[msg("Not funds to withdraw")]
    InsufficientFunds,
}
