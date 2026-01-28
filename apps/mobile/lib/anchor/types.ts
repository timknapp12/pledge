import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

// Pledge status enum matching on-chain
export enum PledgeStatus {
  Active = 'active',
  Reported = 'reported',
  Completed = 'completed',
  Forfeited = 'forfeited',
  Cancelled = 'cancelled',
}

// On-chain Pledge account data
export interface PledgeAccount {
  user: PublicKey;
  mint: PublicKey;
  stakeAmount: BN;
  deadline: BN;
  status: PledgeStatusType;
  completionPercentage: number | null;
  reportedAt: BN | null;
  createdAt: BN;
  bump: number;
  vaultBump: number;
}

// Status type as returned by Anchor (object with single key)
export type PledgeStatusType =
  | { active: Record<string, never> }
  | { reported: Record<string, never> }
  | { completed: Record<string, never> }
  | { forfeited: Record<string, never> }
  | { cancelled: Record<string, never> };

// Helper to convert status object to enum
export const statusToEnum = (status: PledgeStatusType): PledgeStatus => {
  if ('active' in status) return PledgeStatus.Active;
  if ('reported' in status) return PledgeStatus.Reported;
  if ('completed' in status) return PledgeStatus.Completed;
  if ('forfeited' in status) return PledgeStatus.Forfeited;
  if ('cancelled' in status) return PledgeStatus.Cancelled;
  throw new Error('Unknown pledge status');
};

// On-chain ProgramConfig account data
export interface ProgramConfigAccount {
  admin: PublicKey;
  treasury: PublicKey;
  charity: PublicKey;
  treasurySplitBps: number;
  partialFeeBps: number;
  editPenaltyBps: number;
  gracePeriodSeconds: BN;
  paused: boolean;
  bump: number;
}

// Args for createPledge instruction
export interface CreatePledgeArgs {
  stakeAmount: BN;
  deadline: BN;
  createdAt: BN;
}

// Args for editPledge instruction
export interface EditPledgeArgs {
  newDeadline: BN | null;
}

// Args for reportCompletion instruction
export interface ReportCompletionArgs {
  completionPercentage: number;
}

// Parsed pledge with helper fields
export interface ParsedPledge {
  address: PublicKey;
  user: PublicKey;
  mint: PublicKey;
  stakeAmount: number; // In USDC (converted from lamports)
  deadline: Date;
  status: PledgeStatus;
  completionPercentage: number | null;
  reportedAt: Date | null;
  createdAt: Date;
}

// Convert raw on-chain data to parsed format
export const parsePledgeAccount = (
  address: PublicKey,
  account: PledgeAccount,
): ParsedPledge => {
  return {
    address,
    user: account.user,
    mint: account.mint,
    stakeAmount: account.stakeAmount.toNumber() / 1_000_000, // USDC has 6 decimals
    deadline: new Date(account.deadline.toNumber() * 1000),
    status: statusToEnum(account.status),
    completionPercentage: account.completionPercentage,
    reportedAt: account.reportedAt
      ? new Date(account.reportedAt.toNumber() * 1000)
      : null,
    createdAt: new Date(account.createdAt.toNumber() * 1000),
  };
};
