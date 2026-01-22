import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Pledge } from "../../target/types/pledge";

// Default config values matching constants.rs
export const DEFAULT_TREASURY_SPLIT_BPS = 7000; // 70%
export const DEFAULT_PARTIAL_FEE_BPS = 100; // 1%
export const DEFAULT_EDIT_PENALTY_BPS = 1000; // 10%
export const DEFAULT_GRACE_PERIOD = 86400; // 1 day in seconds

// PDA seeds
export const CONFIG_SEED = "config";
export const PLEDGE_SEED = "pledge";
export const VAULT_SEED = "vault";

// Shared test keypairs (deterministic for consistent testing)
// These are used across all tests to ensure config PDA matches
const SHARED_SEED = Buffer.from("shared-test-seed-for-pledge-program");
export const SHARED_ADMIN = Keypair.fromSeed(SHARED_SEED.slice(0, 32));
export const SHARED_TREASURY = Keypair.fromSeed(Buffer.concat([SHARED_SEED.slice(0, 31), Buffer.from([1])]));
export const SHARED_CHARITY = Keypair.fromSeed(Buffer.concat([SHARED_SEED.slice(0, 31), Buffer.from([2])]));

// Test amounts (USDC has 6 decimals)
export const USDC_DECIMALS = 6;
export const ONE_USDC = 1_000_000;
export const TEN_USDC = 10_000_000;
export const HUNDRED_USDC = 100_000_000;

export interface TestContext {
  program: Program<Pledge>;
  provider: anchor.AnchorProvider;
  admin: Keypair;
  treasury: Keypair;
  charity: Keypair;
  usdcMint: PublicKey;
  configPda: PublicKey;
  configBump: number;
}

export interface UserContext {
  keypair: Keypair;
  tokenAccount: PublicKey;
}

// Shared USDC mint (created once, cached for all tests)
let sharedUsdcMint: PublicKey | null = null;

/**
 * Initialize test context with program, admin, and USDC mint
 * Uses shared keypairs to ensure consistent config PDA across all tests
 */
export async function setupTestContext(): Promise<TestContext> {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Pledge as Program<Pledge>;

  // Use shared keypairs for consistency across tests
  const admin = SHARED_ADMIN;
  const treasury = SHARED_TREASURY;
  const charity = SHARED_CHARITY;

  // Airdrop SOL to shared accounts if needed
  const adminBalance = await provider.connection.getBalance(admin.publicKey);
  if (adminBalance < 5 * LAMPORTS_PER_SOL) {
    await airdrop(provider.connection, admin.publicKey, 10 * LAMPORTS_PER_SOL);
  }

  const treasuryBalance = await provider.connection.getBalance(treasury.publicKey);
  if (treasuryBalance < LAMPORTS_PER_SOL) {
    await airdrop(provider.connection, treasury.publicKey, 1 * LAMPORTS_PER_SOL);
  }

  const charityBalance = await provider.connection.getBalance(charity.publicKey);
  if (charityBalance < LAMPORTS_PER_SOL) {
    await airdrop(provider.connection, charity.publicKey, 1 * LAMPORTS_PER_SOL);
  }

  // Create USDC mint once, reuse across tests
  if (!sharedUsdcMint) {
    sharedUsdcMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      USDC_DECIMALS
    );
  }

  // Derive config PDA
  const [configPda, configBump] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    program.programId
  );

  return {
    program,
    provider,
    admin,
    treasury,
    charity,
    usdcMint: sharedUsdcMint,
    configPda,
    configBump,
  };
}

/**
 * Initialize the program config (skips if already initialized)
 * Always ensures treasury/charity token accounts exist for the current mint
 */
export async function initializeConfig(ctx: TestContext): Promise<void> {
  // Always create treasury and charity token accounts for current mint if they don't exist
  // This is needed because each test run may create a new USDC mint
  try {
    await createAssociatedTokenAccount(
      ctx.provider.connection,
      ctx.admin,
      ctx.usdcMint,
      ctx.treasury.publicKey
    );
  } catch {
    // Already exists - ignore
  }

  try {
    await createAssociatedTokenAccount(
      ctx.provider.connection,
      ctx.admin,
      ctx.usdcMint,
      ctx.charity.publicKey
    );
  } catch {
    // Already exists - ignore
  }

  // Check if config already exists
  try {
    const existingConfig = await ctx.program.account.programConfig.fetch(ctx.configPda);
    if (existingConfig) {
      // Config already initialized - skip
      return;
    }
  } catch {
    // Config doesn't exist - proceed with initialization
  }

  await ctx.program.methods
    .initialize(
      ctx.treasury.publicKey,
      ctx.charity.publicKey,
      DEFAULT_TREASURY_SPLIT_BPS,
      DEFAULT_PARTIAL_FEE_BPS,
      DEFAULT_EDIT_PENALTY_BPS,
      new anchor.BN(DEFAULT_GRACE_PERIOD)
    )
    .accounts({
      admin: ctx.admin.publicKey,
    })
    .signers([ctx.admin])
    .rpc();
}

/**
 * Create a test user with USDC tokens
 */
export async function createTestUser(
  ctx: TestContext,
  usdcAmount: number = HUNDRED_USDC
): Promise<UserContext> {
  const keypair = Keypair.generate();

  // Airdrop SOL
  await airdrop(ctx.provider.connection, keypair.publicKey, 5 * LAMPORTS_PER_SOL);

  // Create token account
  const tokenAccount = await createAssociatedTokenAccount(
    ctx.provider.connection,
    ctx.admin,
    ctx.usdcMint,
    keypair.publicKey
  );

  // Mint USDC to user
  await mintTo(
    ctx.provider.connection,
    ctx.admin,
    ctx.usdcMint,
    tokenAccount,
    ctx.admin,
    usdcAmount
  );

  return { keypair, tokenAccount };
}

/**
 * Derive pledge PDA from user and created_at timestamp
 */
export function derivePledgePda(
  programId: PublicKey,
  user: PublicKey,
  createdAt: anchor.BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(PLEDGE_SEED),
      user.toBuffer(),
      createdAt.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
}

/**
 * Derive vault PDA from pledge
 */
export function deriveVaultPda(
  programId: PublicKey,
  pledge: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED), pledge.toBuffer()],
    programId
  );
}

/**
 * Get current timestamp from the cluster
 */
export async function getCurrentTimestamp(
  connection: anchor.web3.Connection
): Promise<number> {
  const slot = await connection.getSlot();
  const timestamp = await connection.getBlockTime(slot);
  return timestamp || Math.floor(Date.now() / 1000);
}

/**
 * Airdrop SOL to an account
 */
export async function airdrop(
  connection: anchor.web3.Connection,
  publicKey: PublicKey,
  amount: number
): Promise<void> {
  const signature = await connection.requestAirdrop(publicKey, amount);
  await connection.confirmTransaction(signature, "confirmed");
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Advance time on localnet by creating empty transactions
 * Note: This only works on localnet and is approximate
 */
export async function advanceTime(
  connection: anchor.web3.Connection,
  payer: Keypair,
  seconds: number
): Promise<void> {
  // On localnet, each slot is ~400ms, so we need to create transactions
  // to advance the clock. This is approximate.
  const iterations = Math.ceil(seconds / 2);
  for (let i = 0; i < iterations; i++) {
    const tx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: payer.publicKey,
        lamports: 1,
      })
    );
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [payer]);
  }
}

/**
 * Get token account balance
 */
export async function getTokenBalance(
  connection: anchor.web3.Connection,
  tokenAccount: PublicKey
): Promise<bigint> {
  const info = await connection.getTokenAccountBalance(tokenAccount);
  return BigInt(info.value.amount);
}

/**
 * Create a pledge and return its PDA
 */
export async function createPledge(
  ctx: TestContext,
  user: UserContext,
  stakeAmount: number,
  deadlineOffset: number = 3600 // 1 hour from now
): Promise<{ pledgePda: PublicKey; vaultPda: PublicKey; createdAt: anchor.BN }> {
  const currentTimestamp = await getCurrentTimestamp(ctx.provider.connection);
  const createdAt = new anchor.BN(currentTimestamp);
  const deadline = new anchor.BN(currentTimestamp + deadlineOffset);

  const [pledgePda] = derivePledgePda(
    ctx.program.programId,
    user.keypair.publicKey,
    createdAt
  );
  const [vaultPda] = deriveVaultPda(ctx.program.programId, pledgePda);

  await ctx.program.methods
    .createPledge(new anchor.BN(stakeAmount), deadline)
    .accounts({
      user: user.keypair.publicKey,
      pledge: pledgePda,
      vault: vaultPda,
      userTokenAccount: user.tokenAccount,
      mint: ctx.usdcMint,
    })
    .signers([user.keypair])
    .rpc();

  return { pledgePda, vaultPda, createdAt };
}

/**
 * Get treasury token account
 */
export async function getTreasuryTokenAccount(
  ctx: TestContext
): Promise<PublicKey> {
  return getAssociatedTokenAddress(ctx.usdcMint, ctx.treasury.publicKey);
}

/**
 * Get charity token account
 */
export async function getCharityTokenAccount(
  ctx: TestContext
): Promise<PublicKey> {
  return getAssociatedTokenAddress(ctx.usdcMint, ctx.charity.publicKey);
}
