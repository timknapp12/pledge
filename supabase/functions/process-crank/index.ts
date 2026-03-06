// Crank service - processes expired pledges past deadline + grace period
// Runs periodically via pg_cron or manual invocation
// Uses raw @solana/web3.js (no Anchor — incompatible with Deno Edge Runtime)

/// <reference path="../shims.d.ts" />

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { Buffer } from 'node:buffer';
import { createClient } from '@supabase/supabase-js';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import bs58 from 'bs58';

// --- Constants ---
const PROGRAM_ID = new PublicKey('PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp');
const DEVNET_USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const MAINNET_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const GRACE_PERIOD_SECONDS = 24 * 60 * 60; // 1 day

// Anchor discriminators from IDL
const PROCESS_EXPIRED_DISCRIMINATOR = Uint8Array.from([128, 182, 159, 31, 232, 19, 28, 61]);

// PledgeStatus enum indices
const PLEDGE_STATUS_ACTIVE = 0;
const PLEDGE_STATUS_COMPLETED = 2;
const PLEDGE_STATUS_FORFEITED = 3;

// --- Helpers ---
function i64ToLeBytes(value: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigInt64(0, BigInt(value), true); // little-endian
  return new Uint8Array(buf);
}

function readPublicKey(data: Uint8Array, offset: number): PublicKey {
  return new PublicKey(data.slice(offset, offset + 32));
}

// --- PDA Derivation ---
const getConfigPda = (): PublicKey =>
  PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('config')],
    PROGRAM_ID,
  )[0];

const getPledgePda = (user: PublicKey, createdAtSeconds: number): PublicKey =>
  PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode('pledge'),
      user.toBuffer(),
      i64ToLeBytes(createdAtSeconds),
    ],
    PROGRAM_ID,
  )[0];

const getVaultPda = (pledge: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('vault'), pledge.toBuffer()],
    PROGRAM_ID,
  )[0];

const getAta = (owner: PublicKey, mint: PublicKey): PublicKey =>
  PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];

// --- On-chain account deserialization ---
// ProgramConfig layout (after 8-byte discriminator):
//   admin: pubkey(32), treasury: pubkey(32), charity: pubkey(32),
//   treasury_split_bps: u16, partial_fee_bps: u16, edit_penalty_bps: u16,
//   grace_period_seconds: i64, paused: bool, bump: u8,
//   crank_authority: pubkey(32), allowed_mint: pubkey(32)
function deserializeConfig(data: Uint8Array): { treasury: PublicKey; charity: PublicKey } {
  // Skip 8-byte discriminator + 32-byte admin
  const treasury = readPublicKey(data, 8 + 32);       // offset 40
  const charity = readPublicKey(data, 8 + 32 + 32);   // offset 72
  return { treasury, charity };
}

// Pledge layout (after 8-byte discriminator):
//   user: pubkey(32), mint: pubkey(32), stake_amount: u64(8), deadline: i64(8),
//   status: u8(1), ...
function deserializePledgeStatus(data: Uint8Array): number {
  // 8 (disc) + 32 (user) + 32 (mint) + 8 (stake) + 8 (deadline) = offset 88
  return data[88];
}

// --- Build process_expired instruction ---
function buildProcessExpiredIx(
  completionPercentage: number,
  accounts: {
    crank: PublicKey;
    config: PublicKey;
    pledge: PublicKey;
    vault: PublicKey;
    user: PublicKey;
    userTokenAccount: PublicKey;
    treasuryTokenAccount: PublicKey;
    charityTokenAccount: PublicKey;
  },
): TransactionInstruction {
  // Instruction data: 8-byte discriminator + 1-byte u8 arg
  const instructionData = new Uint8Array(9);
  instructionData.set(PROCESS_EXPIRED_DISCRIMINATOR, 0);
  instructionData[8] = completionPercentage;

  const keys = [
    { pubkey: accounts.crank, isSigner: true, isWritable: false },
    { pubkey: accounts.config, isSigner: false, isWritable: false },
    { pubkey: accounts.pledge, isSigner: false, isWritable: true },
    { pubkey: accounts.vault, isSigner: false, isWritable: true },
    { pubkey: accounts.user, isSigner: false, isWritable: true },
    { pubkey: accounts.userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.treasuryTokenAccount, isSigner: false, isWritable: true },
    { pubkey: accounts.charityTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data: Buffer.from(instructionData),
  });
}

// --- Completion Calculation (mirrors frontend logic) ---
interface PledgeTodos {
  goals: string[];
  daily: Record<string, string[]>;
}

interface DailyProgressRow {
  date: string;
  todos_completed: number[];
}

function toLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateCompletionPercentage(
  todos: PledgeTodos,
  dailyProgress: DailyProgressRow[],
  startDate: Date,
  endDate: Date,
): number {
  let totalExpectedCompletions = 0;
  let actualCompletions = 0;

  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const end = new Date(Math.min(endDate.getTime(), now.getTime()));

  const goalCount = todos.goals.length;
  const todayStr = toLocalDateStr(new Date());

  while (currentDate <= end) {
    const dateStr = toLocalDateStr(currentDate);
    const dayProgress = dailyProgress.find((p) => p.date === dateStr);
    const completedIndices = dayProgress?.todos_completed ?? [];

    const dayTasks = todos.daily[dateStr] || [];
    totalExpectedCompletions += dayTasks.length;
    actualCompletions += completedIndices.filter(
      (i) => i >= 0 && i < dayTasks.length,
    ).length;

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Goals count once — stored after daily task indices in today's progress
  if (goalCount > 0) {
    totalExpectedCompletions += goalCount;
    const todayProgress = dailyProgress.find((p) => p.date === todayStr);
    const todayDayTasks = todos.daily[todayStr] || [];
    const completedIndices = todayProgress?.todos_completed ?? [];
    actualCompletions += completedIndices.filter(
      (i) => i >= todayDayTasks.length && i < todayDayTasks.length + goalCount,
    ).length;
  }

  if (totalExpectedCompletions === 0) return 0;
  return Math.round((actualCompletions / totalExpectedCompletions) * 100);
}

// --- Main Handler ---
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify shared secret (if FUNCTION_SECRET is set)
    const functionSecret = Deno.env.get('FUNCTION_SECRET');
    if (functionSecret) {
      const authHeader = req.headers.get('Authorization');
      const providedSecret = authHeader?.replace('Bearer ', '');
      if (providedSecret !== functionSecret) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // --- Initialize clients ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const heliusApiKey = Deno.env.get('HELIUS_API_KEY')!;
    const solanaNetwork = Deno.env.get('SOLANA_NETWORK') || 'mainnet';
    const rpcUrl = `https://${solanaNetwork}.helius-rpc.com/?api-key=${heliusApiKey}`;
    const connection = new Connection(rpcUrl, 'confirmed');

    const USDC_MINT = new PublicKey(
      solanaNetwork === 'devnet' ? DEVNET_USDC : MAINNET_USDC,
    );

    // Decode crank keypair from base58
    const crankKeypairBase58 = Deno.env.get('CRANK_KEYPAIR')!;
    const crankKeypair = Keypair.fromSecretKey(bs58.decode(crankKeypairBase58));

    // Fetch on-chain config (for treasury/charity addresses)
    const configPda = getConfigPda();
    const configAccountInfo = await connection.getAccountInfo(configPda);
    if (!configAccountInfo) {
      return new Response(JSON.stringify({ error: 'Config account not found' }), { status: 500 });
    }
    const config = deserializeConfig(configAccountInfo.data);

    // --- Query expired pledges ---
    const now = Math.floor(Date.now() / 1000);
    const cutoffTime = new Date((now - GRACE_PERIOD_SECONDS) * 1000).toISOString();

    const { data: expiredPledges, error: queryError } = await supabase
      .from('pledges')
      .select('*, daily_progress(*), users!inner(wallet_address)')
      .eq('status', 'Active')
      .lt('deadline', cutoffTime);

    if (queryError) {
      console.error('Error fetching expired pledges:', queryError);
      return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
    }

    console.log(`Processing ${expiredPledges?.length || 0} expired pledges`);

    const results: any[] = [];

    for (const pledge of expiredPledges || []) {
      try {
        // --- 1. Derive PDA and verify on-chain status ---
        const walletAddress = (pledge as any).users?.wallet_address || pledge.wallet_address;
        if (!walletAddress) {
          console.error(`Pledge ${pledge.id}: No wallet address found`);
          results.push({ pledgeId: pledge.id, success: false, error: 'No wallet address' });
          continue;
        }
        const userPubkey = new PublicKey(walletAddress);
        const createdAtTimestamp = Math.floor(new Date(pledge.created_at).getTime() / 1000);

        let pledgePda = getPledgePda(userPubkey, createdAtTimestamp);
        let pledgeAccountInfo = await connection.getAccountInfo(pledgePda);

        // Fallback to on_chain_address if PDA derivation doesn't match
        if (!pledgeAccountInfo && pledge.on_chain_address) {
          pledgePda = new PublicKey(pledge.on_chain_address);
          pledgeAccountInfo = await connection.getAccountInfo(pledgePda);
        }

        if (!pledgeAccountInfo) {
          console.error(`Pledge ${pledge.id}: Cannot fetch on-chain account`);
          results.push({ pledgeId: pledge.id, success: false, error: 'On-chain account not found' });
          continue;
        }

        const onChainStatus = deserializePledgeStatus(pledgeAccountInfo.data);

        // Skip if already processed on-chain
        if (onChainStatus !== PLEDGE_STATUS_ACTIVE) {
          console.log(`Pledge ${pledge.id}: Already processed on-chain (status=${onChainStatus}), updating DB`);
          const dbStatus = onChainStatus === PLEDGE_STATUS_COMPLETED
            ? 'Completed'
            : onChainStatus === PLEDGE_STATUS_FORFEITED
              ? 'Forfeited'
              : 'Active';
          if (dbStatus !== 'Active') {
            await supabase
              .from('pledges')
              .update({ status: dbStatus })
              .eq('id', pledge.id);
          }
          results.push({ pledgeId: pledge.id, success: true, skipped: true, dbStatus });
          continue;
        }

        // --- 2. Calculate completion percentage ---
        const todos: PledgeTodos = pledge.todos || { goals: [], daily: {} };
        const dailyProgress: DailyProgressRow[] = pledge.daily_progress || [];
        const completionPct = calculateCompletionPercentage(
          todos,
          dailyProgress,
          new Date(pledge.start_date),
          new Date(pledge.end_date),
        );

        console.log(`Pledge ${pledge.id}: ${completionPct}% completion`);

        // --- 3. Derive all accounts ---
        const vaultPda = getVaultPda(pledgePda);
        const userTokenAccount = getAta(userPubkey, USDC_MINT);
        const treasuryTokenAccount = getAta(config.treasury, USDC_MINT);
        const charityTokenAccount = getAta(config.charity, USDC_MINT);

        // --- 4. Build and send transaction ---
        const ix = buildProcessExpiredIx(completionPct, {
          crank: crankKeypair.publicKey,
          config: configPda,
          pledge: pledgePda,
          vault: vaultPda,
          user: userPubkey,
          userTokenAccount,
          treasuryTokenAccount,
          charityTokenAccount,
        });

        const tx = new Transaction().add(ix);
        tx.feePayer = crankKeypair.publicKey;
        tx.recentBlockhash = (await connection.getLatestBlockhash('confirmed')).blockhash;
        tx.sign(crankKeypair);

        const txSignature = await connection.sendRawTransaction(tx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });

        console.log(`Pledge ${pledge.id}: TX ${txSignature}`);

        // --- 5. Wait for confirmation ---
        await connection.confirmTransaction(txSignature, 'confirmed');

        // --- 6. Update DB status ---
        const finalStatus = completionPct > 0 ? 'Completed' : 'Forfeited';
        await supabase
          .from('pledges')
          .update({
            status: finalStatus,
            completion_percentage: completionPct,
            settle_tx_signature: txSignature,
          })
          .eq('id', pledge.id);

        // --- 7. Cancel pending notifications ---
        await supabase
          .from('notifications')
          .update({ status: 'cancelled' })
          .eq('pledge_id', pledge.id)
          .eq('status', 'pending');

        results.push({
          pledgeId: pledge.id,
          completionPercentage: completionPct,
          status: finalStatus,
          txSignature,
          success: true,
        });
      } catch (pledgeError: any) {
        console.error(`Error processing pledge ${pledge.id}:`, pledgeError);
        results.push({
          pledgeId: pledge.id,
          success: false,
          error: pledgeError.message || String(pledgeError),
        });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('Crank error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
