import { PublicKey } from '@solana/web3.js';
import {
  PROGRAM_ID,
  SEEDS,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from './constants';
import BN from 'bn.js';

/**
 * Derive the program config PDA
 */
export const getConfigPda = (): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync([SEEDS.CONFIG], PROGRAM_ID);
};

/**
 * Derive a pledge PDA from user and creation timestamp
 */
export const getPledgePda = (
  user: PublicKey,
  createdAt: BN | number,
): [PublicKey, number] => {
  const createdAtBn =
    typeof createdAt === 'number' ? new BN(createdAt) : createdAt;
  return PublicKey.findProgramAddressSync(
    [SEEDS.PLEDGE, user.toBuffer(), createdAtBn.toArrayLike(Buffer, 'le', 8)],
    PROGRAM_ID,
  );
};

/**
 * Derive a vault PDA from pledge address
 */
export const getVaultPda = (pledge: PublicKey): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [SEEDS.VAULT, pledge.toBuffer()],
    PROGRAM_ID,
  );
};

/**
 * Derive an Associated Token Account address
 */
export const getAssociatedTokenAddress = (
  owner: PublicKey,
  mint: PublicKey,
): PublicKey => {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
};

/**
 * Get all PDAs needed for creating a pledge
 */
export const getCreatePledgePdas = (
  user: PublicKey,
  mint: PublicKey,
  createdAt: BN | number,
) => {
  const [config] = getConfigPda();
  const [pledge, pledgeBump] = getPledgePda(user, createdAt);
  const [vault, vaultBump] = getVaultPda(pledge);
  const userTokenAccount = getAssociatedTokenAddress(user, mint);

  return {
    config,
    pledge,
    pledgeBump,
    vault,
    vaultBump,
    userTokenAccount,
  };
};

/**
 * Get all PDAs needed for reporting completion
 */
export const getReportCompletionPdas = (
  user: PublicKey,
  createdAt: BN | number,
) => {
  const [config] = getConfigPda();
  const [pledge] = getPledgePda(user, createdAt);

  return {
    config,
    pledge,
  };
};
