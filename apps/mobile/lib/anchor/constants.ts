import { PublicKey } from '@solana/web3.js';
import Constants from 'expo-constants';

// Get config from app.config.ts (set based on DEPLOY_ENVIRONMENT)
const extra = Constants.expoConfig?.extra;

// Program ID from app.config.ts
export const PROGRAM_ID = new PublicKey(
  (extra?.programId as string) || 'PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp'
);

// USDC Mint from app.config.ts (changes based on environment)
export const USDC_MINT = new PublicKey(
  (extra?.usdcMint as string) || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
);

export const USDC_DECIMALS = 6;

// PDA Seeds
export const SEEDS = {
  CONFIG: Buffer.from('config'),
  PLEDGE: Buffer.from('pledge'),
  VAULT: Buffer.from('vault'),
} as const;

// Token Program addresses
export const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
);

// Default config values (in basis points)
export const DEFAULT_TREASURY_SPLIT_BPS = 7000; // 70%
export const DEFAULT_PARTIAL_FEE_BPS = 100; // 1%
export const DEFAULT_EDIT_PENALTY_BPS = 1000; // 10%
export const DEFAULT_GRACE_PERIOD_SECONDS = 86400; // 1 day
export const BPS_DENOMINATOR = 10000;
