// USDC mint addresses
pub const USDC_MINT_MAINNET: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
pub const USDC_MINT_DEVNET: &str = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

// Default config values
pub const DEFAULT_TREASURY_SPLIT_BPS: u16 = 7000; // 70%
pub const DEFAULT_PARTIAL_FEE_BPS: u16 = 100; // 1%
pub const DEFAULT_EDIT_PENALTY_BPS: u16 = 1000; // 10%
pub const DEFAULT_GRACE_PERIOD: i64 = 86400; // 1 day in seconds

// Basis points
pub const BPS_DENOMINATOR: u64 = 10000;

// PDA Seeds
pub const CONFIG_SEED: &[u8] = b"config";
pub const PLEDGE_SEED: &[u8] = b"pledge";
pub const VAULT_SEED: &[u8] = b"vault";
