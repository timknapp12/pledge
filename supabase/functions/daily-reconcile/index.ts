// Daily Reconciliation — server-side safety net that runs once per day.
// Fetches all on-chain pledge accounts, compares with Supabase,
// and fixes any mismatches. Catches anything the indexer missed
// (e.g., Helius outage, Supabase downtime, webhook delivery failure).
//
// Triggered by pg_cron or manual invocation.

/// <reference path="../shims.d.ts" />

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

interface DbPledge {
  id: string;
  on_chain_address: string;
  status: string;
  stake_amount: number;
  completion_percentage: number | null;
}
import { Connection, PublicKey } from '@solana/web3.js';

// --- Constants ---
const PROGRAM_ID = new PublicKey('PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp');

// PledgeStatus enum indices (matches Anchor enum order)
const STATUS_MAP: Record<number, string> = {
  0: 'Active',
  1: 'Reported',
  2: 'Completed',
  3: 'Forfeited',
  4: 'Cancelled',
};

// Pledge account layout offsets (after 8-byte discriminator):
//   user: Pubkey(32), mint: Pubkey(32), stake_amount: u64(8),
//   deadline: i64(8), status: u8(1), completion_percentage: Option<u8>(1+1),
//   reported_at: Option<i64>(1+8), created_at: i64(8), bump: u8(1), vault_bump: u8(1)
const OFFSET_USER = 8;
const OFFSET_STAKE = 8 + 32 + 32;
const OFFSET_DEADLINE = 8 + 32 + 32 + 8;
const OFFSET_STATUS = 8 + 32 + 32 + 8 + 8;
const OFFSET_COMPLETION = 8 + 32 + 32 + 8 + 8 + 1; // Option<u8>: 1 byte discriminant + 1 byte value

function readPublicKey(data: Uint8Array, offset: number): string {
  const keyBytes = data.slice(offset, offset + 32);
  return new PublicKey(keyBytes).toBase58();
}

function readU64(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return Number(view.getBigUint64(0, true));
}

function readI64(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return Number(view.getBigInt64(0, true));
}

interface OnChainPledge {
  address: string;
  user: string;
  stakeAmount: number;
  deadline: number; // unix seconds
  status: string;
  completionPercentage: number | null;
}

function deserializePledge(address: PublicKey, data: Uint8Array): OnChainPledge {
  const status = STATUS_MAP[data[OFFSET_STATUS]] || 'Active';

  // completion_percentage is Option<u8>: byte 0 = discriminant (0=None, 1=Some), byte 1 = value
  const hasCompletion = data[OFFSET_COMPLETION] === 1;
  const completionPercentage = hasCompletion ? data[OFFSET_COMPLETION + 1] : null;

  return {
    address: address.toBase58(),
    user: readPublicKey(data, OFFSET_USER),
    stakeAmount: readU64(data, OFFSET_STAKE),
    deadline: readI64(data, OFFSET_DEADLINE),
    status,
    completionPercentage,
  };
}

// --- Main Handler ---
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify shared secret
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

    // --- 1. Fetch ALL on-chain pledge accounts ---
    console.log('[Reconcile] Fetching on-chain pledge accounts...');
    const programAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      commitment: 'confirmed',
    });

    console.log(`[Reconcile] Found ${programAccounts.length} on-chain accounts`);

    // Filter to pledge accounts using the 8-byte Anchor account discriminator.
    // SHA256("account:Pledge")[0..8] — hardcoded, verified against Anchor 0.32.0.
    const PLEDGE_DISCRIMINATOR = new Uint8Array([0xa1, 0xc5, 0x79, 0x2e, 0x63, 0x4b, 0xa9, 0x83]);
    const onChainPledges: OnChainPledge[] = [];

    for (const { pubkey, account } of programAccounts) {
      if (account.data.length < 8) continue;
      // Check first 8 bytes match the Pledge account discriminator
      const disc = account.data.slice(0, 8);
      let match = true;
      for (let i = 0; i < 8; i++) {
        if (disc[i] !== PLEDGE_DISCRIMINATOR[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        try {
          const pledge = deserializePledge(pubkey, account.data);
          onChainPledges.push(pledge);
        } catch {
          // Corrupt data — skip
        }
      }
    }

    console.log(`[Reconcile] Parsed ${onChainPledges.length} pledge accounts`);

    // --- 2. Fetch ALL DB pledges ---
    const { data: dbPledges, error: dbError } = await supabase
      .from('pledges')
      .select('id, on_chain_address, status, stake_amount, completion_percentage');

    if (dbError) {
      throw new Error(`Failed to fetch DB pledges: ${dbError.message}`);
    }

    const dbMap = new Map(
      ((dbPledges || []) as DbPledge[]).map((p) => [p.on_chain_address, p]),
    );

    // --- 3. Reconcile ---
    let statusFixed = 0;
    let completionFixed = 0;
    let missingCreated = 0;
    let alreadyInSync = 0;
    const errors: string[] = [];

    for (const onChain of onChainPledges) {
      const dbRecord = dbMap.get(onChain.address);

      if (!dbRecord) {
        // On-chain exists but not in DB — create recovered record
        // Look up user by wallet address
        const { data: userRecord } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', onChain.user)
          .maybeSingle();

        if (!userRecord) {
          errors.push(`No user found for wallet ${onChain.user} (pledge ${onChain.address})`);
          continue;
        }

        const deadlineDate = new Date(onChain.deadline * 1000);

        const { error: insertError } = await supabase.from('pledges').insert({
          user_id: userRecord.id,
          on_chain_address: onChain.address,
          name: 'Recovered Pledge',
          timeframe_type: 'custom',
          start_date: new Date().toISOString(),
          end_date: deadlineDate.toISOString(),
          deadline: deadlineDate.toISOString(),
          stake_amount: onChain.stakeAmount,
          todos: { goals: [], daily: {} },
          status: onChain.status,
          completion_percentage: onChain.completionPercentage,
        });

        if (insertError) {
          if (insertError.code === '23505') {
            // Race condition — already created (maybe by indexer)
            continue;
          }
          errors.push(`Insert failed for ${onChain.address}: ${insertError.message}`);
          continue;
        }

        missingCreated++;
        console.log(`[Reconcile] Created recovered pledge: ${onChain.address}`);
        continue;
      }

      // Both exist — check for mismatches
      let needsUpdate = false;
      const updates: Record<string, unknown> = {};

      if (dbRecord.status !== onChain.status) {
        updates.status = onChain.status;
        needsUpdate = true;
        statusFixed++;
        console.log(
          `[Reconcile] Status mismatch: ${onChain.address} DB=${dbRecord.status} Chain=${onChain.status}`,
        );
      }

      if (
        onChain.completionPercentage !== null &&
        dbRecord.completion_percentage !== onChain.completionPercentage
      ) {
        updates.completion_percentage = onChain.completionPercentage;
        needsUpdate = true;
        completionFixed++;
      }

      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('pledges')
          .update(updates)
          .eq('on_chain_address', onChain.address);

        if (updateError) {
          errors.push(`Update failed for ${onChain.address}: ${updateError.message}`);
        }
      } else {
        alreadyInSync++;
      }
    }

    const summary = {
      onChainTotal: onChainPledges.length,
      dbTotal: dbPledges?.length || 0,
      alreadyInSync,
      statusFixed,
      completionFixed,
      missingCreated,
      errors,
    };

    console.log('[Reconcile] Summary:', JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('[Reconcile] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
