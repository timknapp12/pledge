use crate::constants::BPS_DENOMINATOR;
use crate::errors::ErrorCode;
use anchor_lang::prelude::*;

/// Calculate refund and fee for partial completion
/// Returns (refund_amount, fee_amount)
pub fn calculate_partial_refund(
    stake_amount: u64,
    completion_percentage: u8,
    fee_bps: u16,
) -> Result<(u64, u64)> {
    require!(
        completion_percentage <= 100,
        ErrorCode::InvalidCompletionPercentage
    );

    // Calculate proportional amount
    let proportional = stake_amount
        .checked_mul(completion_percentage as u64)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(100)
        .ok_or(ErrorCode::Overflow)?;

    // Calculate fee on proportional amount (only for partial, not 100%)
    let fee = if completion_percentage == 100 {
        0
    } else {
        proportional
            .checked_mul(fee_bps as u64)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(ErrorCode::Overflow)?
    };

    let refund = proportional.checked_sub(fee).ok_or(ErrorCode::Underflow)?;

    Ok((refund, fee))
}

/// Calculate treasury/charity split for forfeitures/fees
/// Returns (treasury_amount, charity_amount)
pub fn calculate_split(amount: u64, treasury_split_bps: u16) -> Result<(u64, u64)> {
    let treasury = amount
        .checked_mul(treasury_split_bps as u64)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(ErrorCode::Overflow)?;

    let charity = amount.checked_sub(treasury).ok_or(ErrorCode::Underflow)?;

    Ok((treasury, charity))
}

/// Calculate edit penalty
pub fn calculate_edit_penalty(remaining_stake: u64, penalty_bps: u16) -> Result<u64> {
    Ok(remaining_stake
        .checked_mul(penalty_bps as u64)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(ErrorCode::Overflow)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_full_completion_no_fee() {
        let (refund, fee) = calculate_partial_refund(1_000_000, 100, 100).unwrap();
        assert_eq!(refund, 1_000_000);
        assert_eq!(fee, 0);
    }

    #[test]
    fn test_partial_completion_with_fee() {
        // 50% completion of 1,000,000 = 500,000
        // 1% fee on 500,000 = 5,000
        // Refund = 495,000
        let (refund, fee) = calculate_partial_refund(1_000_000, 50, 100).unwrap();
        assert_eq!(refund, 495_000);
        assert_eq!(fee, 5_000);
    }

    #[test]
    fn test_zero_completion() {
        let (refund, fee) = calculate_partial_refund(1_000_000, 0, 100).unwrap();
        assert_eq!(refund, 0);
        assert_eq!(fee, 0);
    }

    #[test]
    fn test_treasury_charity_split() {
        // 70/30 split of 1,000,000
        let (treasury, charity) = calculate_split(1_000_000, 7000).unwrap();
        assert_eq!(treasury, 700_000);
        assert_eq!(charity, 300_000);
    }

    #[test]
    fn test_edit_penalty() {
        // 10% of 1,000,000 = 100,000
        let penalty = calculate_edit_penalty(1_000_000, 1000).unwrap();
        assert_eq!(penalty, 100_000);
    }

    #[test]
    fn test_75_percent_completion() {
        // 75% completion of 1,000,000 = 750,000
        // 1% fee on 750,000 = 7,500
        // Refund = 742,500
        let (refund, fee) = calculate_partial_refund(1_000_000, 75, 100).unwrap();
        assert_eq!(refund, 742_500);
        assert_eq!(fee, 7_500);
    }

    #[test]
    fn test_50_50_split() {
        // 50/50 split of 1,000,000
        let (treasury, charity) = calculate_split(1_000_000, 5000).unwrap();
        assert_eq!(treasury, 500_000);
        assert_eq!(charity, 500_000);
    }

    #[test]
    fn test_invalid_completion_percentage() {
        let result = calculate_partial_refund(1_000_000, 101, 100);
        assert!(result.is_err());
    }
}
