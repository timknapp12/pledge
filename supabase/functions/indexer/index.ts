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
  supabase: SupabaseClient,
  event: PledgeCreatedEvent,
): Promise<void> {
  // Check if pledge already exists in DB (frontend confirm-then-write usually handles this)
  const { data: existing } = await supabase
    .from('pledges')
    .select('id')
    .eq('on_chain_address', event.pledge)
    .maybeSingle();

  if (existing) {
    // Already exists — frontend wrote it first. Nothing to do.
    console.log(`[Indexer] PledgeCreated: already in DB (${event.pledge})`);
    return;
  }

  // Pledge exists on-chain but not in DB — create a minimal recovered record.
  // Metadata (name, todos, reminders) is lost since it's not on-chain.
  // The user's wallet must be looked up from the user pubkey.
  const { data: userRecord } = await supabase
    .from('users')
    .select('id')
    .eq('wallet_address', event.user)
    .maybeSingle();

  if (!userRecord) {
    console.error(`[Indexer] PledgeCreated: no user found for wallet ${event.user}`);
    return;
  }

  const deadlineDate = new Date(Number(event.deadline) * 1000);

  const { error } = await supabase.from('pledges').insert({
    user_id: userRecord.id,
    on_chain_address: event.pledge,
    name: '',
    timeframe_type: 'custom',
    start_date: new Date().toISOString(),
    end_date: deadlineDate.toISOString(),
    deadline: deadlineDate.toISOString(),
    stake_amount: Number(event.stakeAmount),
    todos: { goals: [], daily: {} },
    status: 'Active',
  });

  if (error) {
    if (error.code === '23505') {
      // Unique violation — race condition, already created
      return;
    }
    throw new Error(`PledgeCreated insert failed: ${error.message}`);
  }

  console.log(`[Indexer] PledgeCreated: recovered pledge ${event.pledge}`);
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

    // Verify webhook auth token
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
    if (webhookSecret) {
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      if (token !== webhookSecret) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Initialize Supabase with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Helius webhook payload
    // Helius sends an array of enhanced transaction objects
    const payload = await req.json();
    const transactions = Array.isArray(payload) ? payload : [payload];

    let processedCount = 0;
    let skippedCount = 0;

    for (const tx of transactions) {
      const txSignature = tx.signature;
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
      const logs: string[] =
        tx.meta?.logMessages ??
        tx.transaction?.meta?.logMessages ??
        tx.logMessages ??
        [];

      if (logs.length === 0) {
        console.warn(`[Indexer] No logs in tx ${txSignature}`);
        continue;
      }

      // Parse Anchor events from logs
      const events = parseEventsFromLogs(logs);

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
