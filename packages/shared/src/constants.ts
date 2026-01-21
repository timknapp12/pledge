// USDC token constants
export const USDC_DECIMALS = 6;
export const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

// Fee constants (in basis points, 100 = 1%)
export const PARTIAL_COMPLETION_FEE_BPS = 100; // 1%

// Forfeiture split (in basis points)
export const TREASURY_SPLIT_BPS = 7000; // 70%
export const CHARITY_SPLIT_BPS = 3000; // 30%

// Edit penalty (in basis points)
export const EDIT_PENALTY_BPS = 1000; // 10%

// Grace period (in seconds)
export const GRACE_PERIOD_SECONDS = 24 * 60 * 60; // 1 day

// Points system
export const BASE_POINTS = 100;
export const STREAK_MULTIPLIER_2 = 1.5; // 2 in a row
export const STREAK_MULTIPLIER_3_PLUS = 2.0; // 3+ in a row

// Timeframe durations (in milliseconds)
export const TIMEFRAME_DURATIONS = {
  '1_day': 24 * 60 * 60 * 1000,
  '1_week': 7 * 24 * 60 * 60 * 1000,
  '1_month': 30 * 24 * 60 * 60 * 1000,
} as const;

// Days of week (for to-do scheduling)
export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
