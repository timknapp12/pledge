/**
 * AsyncStorage-based queue for failed DB writes.
 *
 * When a transaction succeeds but the Supabase write fails, we store the
 * operation here for retry on next app launch or network reconnection.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PendingSyncOp, SyncOperationType } from './types';

const PENDING_SYNC_KEY = 'pending_sync_operations';
const MAX_ATTEMPTS = 5;

/**
 * Add an operation to the retry queue
 */
export async function queueForRetry(
  type: SyncOperationType,
  txSignature: string,
  data: Record<string, unknown>,
): Promise<void> {
  const op: PendingSyncOp = {
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type,
    txSignature,
    data,
    createdAt: Date.now(),
    attempts: 0,
  };

  const existing = await AsyncStorage.getItem(PENDING_SYNC_KEY);
  const queue: PendingSyncOp[] = existing ? JSON.parse(existing) : [];
  queue.push(op);
  await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));

  if (__DEV__) {
    console.log(`[Sync Queue] Added ${type} operation to retry queue:`, op.id);
  }
}

/**
 * Get all pending operations from the queue
 */
export async function getPendingOperations(): Promise<PendingSyncOp[]> {
  const stored = await AsyncStorage.getItem(PENDING_SYNC_KEY);
  if (!stored) return [];
  return JSON.parse(stored);
}

/**
 * Remove a successfully processed operation from the queue
 */
export async function removeFromQueue(opId: string): Promise<void> {
  const queue = await getPendingOperations();
  const filtered = queue.filter((op) => op.id !== opId);

  if (filtered.length > 0) {
    await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(filtered));
  } else {
    await AsyncStorage.removeItem(PENDING_SYNC_KEY);
  }

  if (__DEV__) {
    console.log(`[Sync Queue] Removed operation from queue:`, opId);
  }
}

/**
 * Update an operation's attempt count (for retry tracking)
 */
export async function incrementAttempts(opId: string): Promise<boolean> {
  const queue = await getPendingOperations();
  const opIndex = queue.findIndex((op) => op.id === opId);

  if (opIndex === -1) return false;

  queue[opIndex].attempts += 1;

  // If max attempts reached, remove from queue (give up)
  if (queue[opIndex].attempts >= MAX_ATTEMPTS) {
    if (__DEV__) {
      console.warn(`[Sync Queue] Max attempts reached for operation:`, opId);
    }
    queue.splice(opIndex, 1);
  }

  if (queue.length > 0) {
    await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
  } else {
    await AsyncStorage.removeItem(PENDING_SYNC_KEY);
  }

  return true;
}

/**
 * Clear the entire queue (use with caution)
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_SYNC_KEY);
  if (__DEV__) {
    console.log(`[Sync Queue] Queue cleared`);
  }
}

/**
 * Get queue statistics for debugging
 */
export async function getQueueStats(): Promise<{
  total: number;
  byType: Record<SyncOperationType, number>;
  oldestTimestamp: number | null;
}> {
  const queue = await getPendingOperations();

  const byType: Record<SyncOperationType, number> = {
    CREATE_PLEDGE: 0,
    REPORT_COMPLETION: 0,
    EDIT_PLEDGE: 0,
  };

  let oldestTimestamp: number | null = null;

  for (const op of queue) {
    byType[op.type]++;
    if (oldestTimestamp === null || op.createdAt < oldestTimestamp) {
      oldestTimestamp = op.createdAt;
    }
  }

  return {
    total: queue.length,
    byType,
    oldestTimestamp,
  };
}
