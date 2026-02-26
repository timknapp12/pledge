import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { getConnection } from './connection';
import { IDL } from './idl';
import {
  PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  USDC_MINT,
  USDC_DECIMALS,
} from './constants';
import {
  getCreatePledgePdas,
  getReportCompletionPdas,
  getReportAndSettlePdas,
  getConfigPda,
} from './pdas';
import {
  PledgeAccount,
  ProgramConfigAccount,
  ParsedPledge,
  parsePledgeAccount,
} from './types';

// Minimal wallet interface for read-only operations
const readOnlyWallet = {
  publicKey: PublicKey.default,
  signTransaction: async () => {
    throw new Error('Read-only wallet cannot sign');
  },
  signAllTransactions: async () => {
    throw new Error('Read-only wallet cannot sign');
  },
};

/**
 * Get a read-only program instance for fetching data
 */
export const getReadOnlyProgram = () => {
  const connection = getConnection();
  const provider = new AnchorProvider(connection, readOnlyWallet as any, {
    commitment: 'confirmed',
  });

  // Anchor v0.28.0 requires programId as second arg
  return new Program(IDL as any, PROGRAM_ID, provider);
};

/**
 * Fetch the program config
 */
export const fetchProgramConfig = async (): Promise<ProgramConfigAccount> => {
  const program = getReadOnlyProgram();
  const [configPda] = getConfigPda();
  const config = await program.account.programConfig.fetch(configPda);
  return config as unknown as ProgramConfigAccount;
};

/**
 * Fetch a single pledge by address
 */
export const fetchPledge = async (
  pledgeAddress: PublicKey,
): Promise<ParsedPledge | null> => {
  const program = getReadOnlyProgram();
  try {
    const pledge = await program.account.pledge.fetch(pledgeAddress);
    return parsePledgeAccount(
      pledgeAddress,
      pledge as unknown as PledgeAccount,
    );
  } catch {
    return null;
  }
};

/**
 * Fetch all pledges for a user
 */
export const fetchUserPledges = async (
  userAddress: PublicKey,
): Promise<ParsedPledge[]> => {
  const program = getReadOnlyProgram();

  // Use memcmp filter to find pledges where user field matches
  const pledges = await program.account.pledge.all([
    {
      memcmp: {
        offset: 8, // After discriminator
        bytes: userAddress.toBase58(),
      },
    },
  ]);

  return pledges.map((p) =>
    parsePledgeAccount(p.publicKey, p.account as unknown as PledgeAccount),
  );
};

/**
 * Build a createPledge transaction (unsigned)
 * Returns the transaction and the pledge address
 */
export const buildCreatePledgeTransaction = async (
  user: PublicKey,
  stakeAmountUsdc: number,
  deadline: Date,
): Promise<{
  transaction: Transaction;
  pledgeAddress: PublicKey;
  createdAt: BN;
}> => {
  const program = getReadOnlyProgram();
  const connection = getConnection();
  const mint = USDC_MINT;

  // Convert to on-chain values
  const createdAt = new BN(Math.floor(Date.now() / 1000));
  const deadlineTimestamp = new BN(Math.floor(deadline.getTime() / 1000));
  const stakeAmount = new BN(stakeAmountUsdc * 10 ** USDC_DECIMALS);

  // Get PDAs
  const pdas = getCreatePledgePdas(user, mint, createdAt);

  // Build instruction
  const ix = await program.methods
    .createPledge(stakeAmount, deadlineTimestamp, createdAt)
    .accounts({
      user,
      config: pdas.config,
      pledge: pdas.pledge,
      vault: pdas.vault,
      userTokenAccount: pdas.userTokenAccount,
      mint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  // Build transaction
  const transaction = new Transaction();
  transaction.add(ix);

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = user;

  return {
    transaction,
    pledgeAddress: pdas.pledge,
    createdAt,
  };
};

/**
 * Build a reportCompletion transaction (unsigned)
 */
export const buildReportCompletionTransaction = async (
  user: PublicKey,
  pledgeCreatedAt: BN,
  completionPercentage: number,
): Promise<Transaction> => {
  const program = getReadOnlyProgram();
  const connection = getConnection();

  // Validate percentage
  if (completionPercentage < 0 || completionPercentage > 100) {
    throw new Error('Completion percentage must be between 0 and 100');
  }

  // Get PDAs
  const pdas = getReportCompletionPdas(user, pledgeCreatedAt);

  // Build instruction
  const ix = await program.methods
    .reportCompletion(completionPercentage)
    .accounts({
      user,
      config: pdas.config,
      pledge: pdas.pledge,
    })
    .instruction();

  // Build transaction
  const transaction = new Transaction();
  transaction.add(ix);

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = user;

  return transaction;
};

/**
 * Build a combined report_completion + process_completion transaction (unsigned).
 * This lets the user self-settle in a single wallet signature:
 *  - IX 1: reportCompletion (sets status to Reported, records percentage)
 *  - IX 2: processCompletion (transfers funds based on percentage, closes vault)
 * The user's wallet acts as both the "user" signer for report and the "crank" signer for process.
 */
export const buildReportAndSettleTransaction = async (
  user: PublicKey,
  pledgeCreatedAt: BN,
  completionPercentage: number,
): Promise<Transaction> => {
  const program = getReadOnlyProgram();
  const connection = getConnection();

  if (completionPercentage < 0 || completionPercentage > 100) {
    throw new Error('Completion percentage must be between 0 and 100');
  }

  // Fetch config to get treasury/charity addresses
  const config = await fetchProgramConfig();

  const pdas = getReportAndSettlePdas(
    user,
    USDC_MINT,
    pledgeCreatedAt,
    config.treasury,
    config.charity,
  );

  // IX 1: reportCompletion
  const reportIx = await program.methods
    .reportCompletion(completionPercentage)
    .accounts({
      user,
      config: pdas.config,
      pledge: pdas.pledge,
    })
    .instruction();

  // IX 2: processCompletion (user wallet = crank signer)
  const processIx = await program.methods
    .processCompletion()
    .accounts({
      crank: user,
      config: pdas.config,
      pledge: pdas.pledge,
      vault: pdas.vault,
      user,
      userTokenAccount: pdas.userTokenAccount,
      treasuryTokenAccount: pdas.treasuryTokenAccount,
      charityTokenAccount: pdas.charityTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const transaction = new Transaction();
  transaction.add(reportIx);
  transaction.add(processIx);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = user;

  return transaction;
};

/**
 * Convert USDC amount to lamports (smallest unit)
 */
export const usdcToLamports = (usdc: number): BN => {
  return new BN(Math.floor(usdc * 10 ** USDC_DECIMALS));
};

/**
 * Convert lamports to USDC display amount
 */
export const lamportsToUsdc = (lamports: BN | number): number => {
  const value = typeof lamports === 'number' ? lamports : lamports.toNumber();
  return value / 10 ** USDC_DECIMALS;
};
