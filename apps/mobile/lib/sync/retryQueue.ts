/**
 * AsyncStorage-backed retry queue for failed DB writes.
 *
 * When an on-chain transaction succeeds but the Supabase insert fails,
 * the full payload is saved here so it can be retried on next app launch,
 * foreground, or network reconnect — preserving all metadata (name, todos,
 * reminders) that would otherwise be lost.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupabaseClient } from '@supabase/supabase-js';
import type { PledgeTodos, ReminderSettings } from '@/hooks/useSupabase';

const QUEUE_KEY = 'pledge_retry_queue';
const MAX_ATTEMPTS = 5;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Types ──────────────────────────────────────────────────────────

export interface RetryPayload {
  on_chain_address: string;
  name: string;
  timeframe_type: string;
  start_date: string;
  end_date: string;
  deadline: string;
  stake_amount: number;
  todos: PledgeTodos;
  reminder_settings: ReminderSettings | null;
}

interface RetryQueueItem {
  id: string;
  on_chain_address: string;
  payload: RetryPayload;
  attempts: number;
  createdAt: number;
  lastAttemptAt: number | null;
}

export interface ProcessResult {
  processed: number;
  failed: number;
}

// ─── Queue operations ───────────────────────────────────────────────

async function readQueue(): Promise<RetryQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: RetryQueueItem[]): Promise<void> {
  if (queue.length === 0) {
    await AsyncStorage.removeItem(QUEUE_KEY);
  } else {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Add a failed DB write to the retry queue.
 * Call this when the on-chain tx succeeded but createPledgeInDb failed.
 */
export async function enqueueRetry(item: {
  on_chain_address: string;
  payload: RetryPayload;
}): Promise<void> {
  try {
    const queue = await readQueue();

    // Don't add duplicates for the same on-chain address
    if (queue.some((q) => q.on_chain_address === item.on_chain_address)) {
      return;
    }

    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      on_chain_address: item.on_chain_address,
      payload: item.payload,
      attempts: 0,
      createdAt: Date.now(),
      lastAttemptAt: null,
    });

    await writeQueue(queue);

    if (__DEV__) {
      console.log('[RetryQueue] Enqueued:', item.on_chain_address);
    }
  } catch (err) {
    console.error('[RetryQueue] Failed to enqueue:', err);
  }
}

/**
 * Process all pending retry queue items.
 * Called during reconciliation (app launch, foreground, network reconnect).
 */
export async function processRetryQueue(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, failed: 0 };
  const queue = await readQueue();

  if (queue.length === 0) return result;

  if (__DEV__) {
    console.log(`[RetryQueue] Processing ${queue.length} item(s)`);
  }

  const remaining: RetryQueueItem[] = [];

  for (const item of queue) {
    // Drop expired items
    if (Date.now() - item.createdAt > MAX_AGE_MS) {
      console.error('[RetryQueue] Dropping expired item:', item.on_chain_address);
      result.failed++;
      continue;
    }

    // Drop items that exceeded max attempts
    if (item.attempts >= MAX_ATTEMPTS) {
      console.error('[RetryQueue] Dropping item after max attempts:', item.on_chain_address);
      result.failed++;
      continue;
    }

    // Idempotency check: does a DB record already exist?
    const { data: existing } = await supabase
      .from('pledges')
      .select('id')
      .eq('on_chain_address', item.on_chain_address)
      .maybeSingle();

    if (existing) {
      // Already in DB (indexer or another retry got it)
      if (__DEV__) {
        console.log('[RetryQueue] Already exists, removing:', item.on_chain_address);
      }
      result.processed++;
      continue;
    }

    // Attempt the insert
    const { data, error } = await supabase
      .from('pledges')
      .insert({
        user_id: userId,
        on_chain_address: item.payload.on_chain_address,
        name: item.payload.name,
        timeframe_type: item.payload.timeframe_type,
        start_date: item.payload.start_date,
        end_date: item.payload.end_date,
        deadline: item.payload.deadline,
        stake_amount: item.payload.stake_amount,
        todos: item.payload.todos,
        reminder_settings: item.payload.reminder_settings,
        status: 'Active',
      })
      .select('id')
      .single();

    if (error) {
      // Unique violation = already exists (race condition)
      if (error.code === '23505') {
        result.processed++;
        continue;
      }

      // Retry later
      console.error('[RetryQueue] Insert failed:', error.message);
      item.attempts++;
      item.lastAttemptAt = Date.now();
      remaining.push(item);
      result.failed++;
      continue;
    }

    // Success — schedule notifications if configured
    if (data && item.payload.reminder_settings?.reminders?.length) {
      const { error: rpcError } = await supabase.rpc(
        'schedule_pledge_notifications',
        { p_pledge_id: data.id, p_user_id: userId },
      );
      if (rpcError) {
        // Non-fatal: pledge was created successfully
        console.error('[RetryQueue] Failed to schedule notifications:', rpcError.message);
      }
    }

    if (__DEV__) {
      console.log('[RetryQueue] Successfully retried:', item.on_chain_address);
    }
    result.processed++;
  }

  await writeQueue(remaining);
  return result;
}

/**
 * Returns the number of items in the retry queue.
 */
export async function getRetryQueueSize(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}
