use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    // Auth errors
    #[msg("Unauthorized - not admin")]
    Unauthorized,

    #[msg("Unauthorized - not pledge owner")]
    NotPledgeOwner,

    // Config errors
    #[msg("Program is paused")]
    ProgramPaused,

    #[msg("Invalid treasury split - must be <= 10000 bps")]
    InvalidTreasurySplit,

    #[msg("Invalid fee - must be <= 1000 bps (10%)")]
    InvalidFee,

    // Pledge errors
    #[msg("Invalid timestamp - exceeds clock drift tolerance")]
    InvalidTimestamp,

    #[msg("Invalid deadline - must be in the future")]
    InvalidDeadline,

    #[msg("Invalid stake amount - must be greater than 0")]
    InvalidStakeAmount,

    #[msg("Pledge is not active")]
    PledgeNotActive,

    #[msg("Pledge is not reported")]
    PledgeNotReported,

    #[msg("Deadline has not passed yet")]
    DeadlineNotPassed,

    #[msg("Deadline has already passed")]
    DeadlineAlreadyPassed,

    #[msg("Grace period has not ended")]
    GracePeriodNotEnded,

    #[msg("Grace period has ended - cannot report")]
    GracePeriodEnded,

    #[msg("Invalid completion percentage - must be 0-100")]
    InvalidCompletionPercentage,

    // Math errors
    #[msg("Numeric overflow")]
    Overflow,

    #[msg("Numeric underflow")]
    Underflow,

    // Token errors
    #[msg("Invalid token mint")]
    InvalidMint,

    #[msg("Invalid token account owner")]
    InvalidTokenAccountOwner,
}
