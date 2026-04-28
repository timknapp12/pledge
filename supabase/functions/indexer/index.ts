// Helius Webhook Indexer — receives enhanced transaction data from Helius,
// parses Anchor events, and syncs on-chain state to Supabase.
//
// Events handled:
//   PledgeCreated, PledgeEdited, CompletionReported, PledgeCompleted, PledgeForfeited
//
// Idempotent: checks processed_transactions before writing.
// Returns 500 on failure so Helius retries.

/// <reference path="../shims.d.ts" />

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

type SupabaseClient = ReturnType<typeof createClient>;

// --- Constants ---
const PROGRAM_ID = 'PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp';

// Anchor event discriminators — SHA256("event:<EventName>")[0..8], hardcoded.
// Verified against Anchor 0.32.0 output. Do NOT compute at runtime.
const EVENT_DISCRIMINATORS: Record<string, string> = {
  PledgeCreated: '8817363943578e1a',
  PledgeEdited: '7cd0d92f9050b193',
  CompletionReported: '4825c6a2702f1144',
  PledgeCompleted: '98f00583c8eb2d91',
  PledgeForfeited: 'da389a3202688f41',
};

// Fetch transaction logs directly from Solana RPC (Helius). Used to verify
// the webhook payload — we don't trust whatever Helius posted us. Even if
// WEBHOOK_SECRET leaks, an attacker can at most trigger reprocessing of a
// real on-chain tx; they can't forge events because we re-read logs from
// the chain.
async function fetchTxLogsFromChain(
  signature: string,
): Promise<{ logs: string[] | null; error?: string }> {
  const apiKey = Deno.env.get('HELIUS_API_KEY');
  if (!apiKey) {
    return { logs: null, error: 'HELIUS_API_KEY not configured' };
  }
  const network = Deno.env.get('SOLANA_NETWORK') || 'mainnet';
  const host =
    network === 'devnet' ? 'devnet.helius-rpc.com' : 'mainnet.helius-rpc.com';
  const url = `https://${host}/?api-key=${apiKey}`;

  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getTransaction',
    params: [
      signature,
      {
        encoding: 'json',
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      },
    ],
  });

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (e) {
    return { logs: null, error: `RPC fetch failed: ${e}` };
  }
  if (!resp.ok) {
    return { logs: null, error: `RPC HTTP ${resp.status}` };
  }

  const json = await resp.json().catch(() => null);
  const tx = (json as { result?: { meta?: { logMessages?: string[] } } })?.result;
  if (!tx) {
    // tx not found yet (race) or signature is bogus — return null so caller
    // can decide to fail (Helius will retry the webhook).
    return { logs: null };
  }

  const logs = tx.meta?.logMessages;
  if (!Array.isArray(logs)) {
    return { logs: null, error: 'No logMessages on tx' };
  }
  return { logs };
}

// Constant-time comparison for the webhook shared secret. Avoids leaking
// the prefix length via early-exit timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// --- Base58 decoder (minimal, no external deps) ---
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes: Uint8Array): string {
  const digits: number[] = [0];
  for (let j = 0; j < bytes.length; j++) {
    let carry = bytes[j];
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = '';
  // Leading zeros
  for (let j = 0; j < bytes.length; j++) {
    if (bytes[j] !== 0) break;
    result += '1';
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

// --- Event data parsing ---
// Anchor events are logged as: "Program data: <base64>"
// The base64 decodes to: [8-byte discriminator][serialized event fields]

interface PledgeCreatedEvent {
  type: 'PledgeCreated';
  pledge: string; // base58 pubkey
  user: string;
  stakeAmount: bigint;
  deadline: bigint; // i64 unix timestamp
}

interface PledgeEditedEvent {
  type: 'PledgeEdited';
  pledge: string;
  penaltyPaid: bigint;
}

interface CompletionReportedEvent {
  type: 'CompletionReported';
  pledge: string;
  completionPercentage: number; // u8
}

interface PledgeCompletedEvent {
  type: 'PledgeCompleted';
  pledge: string;
  completionPercentage: number;
  refundAmount: bigint;
  feeAmount: bigint;
}

interface PledgeForfeitedEvent {
  type: 'PledgeForfeited';
  pledge: string;
  treasuryAmount: bigint;
  charityAmount: bigint;
}

type PledgeEvent =
  | PledgeCreatedEvent
  | PledgeEditedEvent
  | CompletionReportedEvent
  | PledgeCompletedEvent
  | PledgeForfeitedEvent;

function readPubkey(data: Uint8Array, offset: number): string {
  return base58Encode(data.slice(offset, offset + 32));
}

function readU64(data: Uint8Array, offset: number): bigint {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return view.getBigUint64(0, true); // little-endian
}

function readI64(data: Uint8Array, offset: number): bigint {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  return view.getBigInt64(0, true);
}

function readU8(data: Uint8Array, offset: number): number {
  return data[offset];
}

function parseEventData(data: Uint8Array): PledgeEvent | null {
  if (data.length < 8) return null;

  const discHex = bytesToHex(data.slice(0, 8));
  const payload = data.slice(8);

  if (discHex === EVENT_DISCRIMINATORS.PledgeCreated) {
    // pledge: Pubkey(32), user: Pubkey(32), stake_amount: u64(8), deadline: i64(8)
    if (payload.length < 80) return null;
    return {
      type: 'PledgeCreated',
      pledge: readPubkey(payload, 0),
      user: readPubkey(payload, 32),
      stakeAmount: readU64(payload, 64),
      deadline: readI64(payload, 72),
    };
  }

  if (discHex === EVENT_DISCRIMINATORS.PledgeEdited) {
    // pledge: Pubkey(32), penalty_paid: u64(8)
    if (payload.length < 40) return null;
    return {
      type: 'PledgeEdited',
      pledge: readPubkey(payload, 0),
      penaltyPaid: readU64(payload, 32),
    };
  }

  if (discHex === EVENT_DISCRIMINATORS.CompletionReported) {
    // pledge: Pubkey(32), completion_percentage: u8(1)
    if (payload.length < 33) return null;
    return {
      type: 'CompletionReported',
      pledge: readPubkey(payload, 0),
      completionPercentage: readU8(payload, 32),
    };
  }

  if (discHex === EVENT_DISCRIMINATORS.PledgeCompleted) {
    // pledge: Pubkey(32), completion_percentage: u8(1), refund_amount: u64(8), fee_amount: u64(8)
    if (payload.length < 49) return null;
    return {
      type: 'PledgeCompleted',
      pledge: readPubkey(payload, 0),
      completionPercentage: readU8(payload, 32),
      refundAmount: readU64(payload, 33),
      feeAmount: readU64(payload, 41),
    };
  }

  if (discHex === EVENT_DISCRIMINATORS.PledgeForfeited) {
    // pledge: Pubkey(32), treasury_amount: u64(8), charity_amount: u64(8)
    if (payload.length < 48) return null;
    return {
      type: 'PledgeForfeited',
      pledge: readPubkey(payload, 0),
      treasuryAmount: readU64(payload, 32),
      charityAmount: readU64(payload, 40),
    };
  }

  return null;
}

// --- Parse Anchor events from transaction logs ---
// Anchor emits events as "Program data: <base64>" log lines
function parseEventsFromLogs(logs: string[]): PledgeEvent[] {
  const events: PledgeEvent[] = [];
  let inProgram = false;

  for (const log of logs) {
    // Track when we're inside our program's execution
    if (log.includes(`Program ${PROGRAM_ID} invoke`)) {
      inProgram = true;
      continue;
    }
    if (log.includes(`Program ${PROGRAM_ID} success`) ||
        log.includes(`Program ${PROGRAM_ID} failed`)) {
      inProgram = false;
      continue;
    }

    // Anchor events are logged as "Program data: <base64>"
    if (inProgram && log.startsWith('Program data: ')) {
      const base64Data = log.slice('Program data: '.length);
      try {
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const event = parseEventData(bytes);
        if (event) {
          events.push(event);
        }
      } catch {
        // Not a valid event, skip
      }
    }
  }

  return events;
}

// --- DB handlers for each event type ---

async function handlePledgeCreated(
  _supabase: SupabaseClient,
  event: PledgeCreatedEvent,
): Promise<void> {
  // Frontend writes the pledge row immediately after on-chain confirmation,
  // and Helius can fire the webhook before that DB write completes. Inserting
  // a placeholder here would (a) race the frontend (causing 23505 unique-key
  // errors) and (b) be useless to the user — name/todos/reminders live only
  // in the client and would be empty in any indexer-created row.
  //
  // The frontend's reconcile-on-app-load handles the rare case where the
  // tx confirmed but the DB write dropped, so we no-op here. The outer loop
  // still records the tx in processed_transactions so we know the indexer
  // saw the event.
  console.log(`[Indexer] PledgeCreated observed for ${event.pledge} — DB write deferred to client`);
}

async function handlePledgeEdited(
  supabase: SupabaseClient,
  event: PledgeEditedEvent,
): Promise<void> {
  // The event only gives penalty_paid, not the new deadline or stake.
  // Frontend handles the deadline update. We update stake_amount here
  // since it's reduced by the penalty on-chain.
  const { data: pledge } = await supabase
    .from('pledges')
    .select('stake_amount')
    .eq('on_chain_address', event.pledge)
    .maybeSingle();

  if (pledge) {
    const newStake = pledge.stake_amount - Number(event.penaltyPaid);
    const { error } = await supabase
      .from('pledges')
      .update({ stake_amount: newStake })
      .eq('on_chain_address', event.pledge);

    if (error) {
      throw new Error(`PledgeEdited update failed: ${error.message}`);
    }
  }

  console.log(
    `[Indexer] PledgeEdited: ${event.pledge}, penalty=${event.penaltyPaid}`,
  );
}

async function handleCompletionReported(
  supabase: SupabaseClient,
  event: CompletionReportedEvent,
): Promise<void> {
  const { error } = await supabase
    .from('pledges')
    .update({
      status: 'Reported',
      completion_percentage: event.completionPercentage,
    })
    .eq('on_chain_address', event.pledge);

  if (error) {
    throw new Error(`CompletionReported update failed: ${error.message}`);
  }

  console.log(
    `[Indexer] CompletionReported: ${event.pledge} at ${event.completionPercentage}%`,
  );
}

async function handlePledgeCompleted(
  supabase: SupabaseClient,
  event: PledgeCompletedEvent,
  txSignature: string,
): Promise<void> {
  // Calculate points: 1 point per dollar refunded (USDC has 6 decimals)
  const pointsEarned = Number(event.refundAmount / BigInt(1_000_000));

  const { data: pledge, error } = await supabase
    .from('pledges')
    .update({
      status: 'Completed',
      completion_percentage: event.completionPercentage,
      settle_tx_signature: txSignature,
      points_earned: pointsEarned,
    })
    .eq('on_chain_address', event.pledge)
    .select('id, user_id, points_earned')
    .maybeSingle();

  if (error) {
    throw new Error(`PledgeCompleted update failed: ${error.message}`);
  }

  if (pledge) {
    // Award points to user (only if not already awarded by frontend)
    if (pointsEarned > 0 && !pledge.points_earned) {
      // Set points_earned on the pledge
      await supabase
        .from('pledges')
        .update({ points_earned: pointsEarned })
        .eq('id', pledge.id);

      const { error: pointsError } = await supabase.rpc('increment_points', {
        p_user_id: pledge.user_id,
        p_points: pointsEarned,
      });
      if (pointsError) {
        console.error(`[Indexer] Failed to award points: ${pointsError.message}`);
      }
    }

    // Cancel pending notifications for this pledge
    await supabase
      .from('notifications')
      .update({ status: 'cancelled' })
      .eq('pledge_id', pledge.id)
      .eq('status', 'pending');
  }

  console.log(
    `[Indexer] PledgeCompleted: ${event.pledge}, refund=${event.refundAmount}, fee=${event.feeAmount}, points=${pointsEarned}`,
  );
}

async function handlePledgeForfeited(
  supabase: SupabaseClient,
  event: PledgeForfeitedEvent,
  txSignature: string,
): Promise<void> {
  const { data: pledge, error } = await supabase
    .from('pledges')
    .update({
      status: 'Forfeited',
      settle_tx_signature: txSignature,
    })
    .eq('on_chain_address', event.pledge)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`PledgeForfeited update failed: ${error.message}`);
  }

  // Cancel pending notifications for this pledge
  if (pledge) {
    await supabase
      .from('notifications')
      .update({ status: 'cancelled' })
      .eq('pledge_id', pledge.id)
      .eq('status', 'pending');
  }

  console.log(
    `[Indexer] PledgeForfeited: ${event.pledge}, treasury=${event.treasuryAmount}, charity=${event.charityAmount}`,
  );
}

// --- Main Handler ---
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify webhook auth token. Prefer the X-Webhook-Secret header so the
    // secret never appears in URL access logs. Fall back to the legacy
    // ?webhook_secret query param so an in-flight Helius config swap doesn't
    // drop events; remove that branch once the Helius webhook is updated.
    // Fail closed: missing env var is a misconfiguration, not a bypass.
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('[Indexer] WEBHOOK_SECRET not configured');
      return new Response('Server misconfigured', { status: 500 });
    }
    const provided =
      req.headers.get('x-webhook-secret') ??
      new URL(req.url).searchParams.get('webhook_secret') ??
      '';
    if (!timingSafeEqual(provided, webhookSecret)) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Initialize Supabase with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Helius webhook payload. Helius sends an array of transaction
    // objects. Two payload shapes exist:
    //   - "Enhanced": top-level `signature` and parsed event fields
    //   - "Raw": signature lives at `transaction.signatures[0]`,
    //     logs at `meta.logMessages`
    // We support both so a webhook config swap doesn't break this function.
    const payload = await req.json();
    const transactions = Array.isArray(payload) ? payload : [payload];

    let processedCount = 0;
    let skippedCount = 0;

    for (const tx of transactions) {
      const txSignature: string | undefined =
        tx.signature ??
        tx.transaction?.signatures?.[0] ??
        tx.signatures?.[0];

      if (!txSignature) {
        console.warn('[Indexer] Transaction missing signature, skipping');
        continue;
      }

      // Idempotency check
      const { data: alreadyProcessed } = await supabase
        .from('processed_transactions')
        .select('tx_signature')
        .eq('tx_signature', txSignature)
        .maybeSingle();

      if (alreadyProcessed) {
        skippedCount++;
        continue;
      }

      // Extract logs from the transaction
      // Helius enhanced transactions have logs in tx.meta.logMessages
      // or in tx.transaction.meta.logMessages depending on the format
      // Re-fetch logs from Solana RPC by signature instead of trusting
      // whatever Helius posted us. Defends against a leaked WEBHOOK_SECRET
      // being used to forge fake events: the worst an attacker can do is
      // ask us to reprocess a real on-chain tx (which is idempotent).
      const { logs: chainLogs, error: rpcError } =
        await fetchTxLogsFromChain(txSignature);

      if (rpcError) {
        console.error(`[Indexer] RPC fetch failed for ${txSignature}:`, rpcError);
        // Return 500 so Helius retries — likely a transient RPC blip.
        return new Response('Upstream RPC error', { status: 500 });
      }
      if (!chainLogs) {
        // Tx not yet visible on-chain (rare race) — let Helius retry.
        console.warn(`[Indexer] tx ${txSignature} not found on-chain yet, will retry`);
        return new Response('Transaction not yet visible', { status: 500 });
      }
      if (chainLogs.length === 0) {
        console.warn(`[Indexer] No logs in tx ${txSignature}`);
        continue;
      }

      // Parse Anchor events from the on-chain logs (not the webhook payload).
      const events = parseEventsFromLogs(chainLogs);

      if (events.length === 0) {
        // Transaction involved our program but had no recognizable events
        continue;
      }

      // Process each event
      const eventTypes: string[] = [];
      for (const event of events) {
        switch (event.type) {
          case 'PledgeCreated':
            await handlePledgeCreated(supabase, event);
            break;
          case 'PledgeEdited':
            await handlePledgeEdited(supabase, event);
            break;
          case 'CompletionReported':
            await handleCompletionReported(supabase, event);
            break;
          case 'PledgeCompleted':
            await handlePledgeCompleted(supabase, event, txSignature);
            break;
          case 'PledgeForfeited':
            await handlePledgeForfeited(supabase, event, txSignature);
            break;
        }
        eventTypes.push(event.type);
      }

      // Record processed transaction (one row per tx, all event types joined)
      const { error: insertError } = await supabase
        .from('processed_transactions')
        .insert({
          tx_signature: txSignature,
          event_type: eventTypes.join(','),
        });

      if (insertError && insertError.code !== '23505') {
        console.error(`[Indexer] Failed to record processed tx: ${insertError.message}`);
      }

      processedCount++;
    }

    return new Response(
      JSON.stringify({
        processed: processedCount,
        skipped: skippedCount,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    console.error('[Indexer] Error:', error);
    // Return generic error to caller, keep details server-side
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
