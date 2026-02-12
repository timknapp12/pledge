/**
 * Reconciliation logic for syncing on-chain state with Supabase.
 *
 * Called on app launch and after network reconnection.
 * On-chain is source of truth for: status, stake_amount, deadline
 * Supabase is source of truth for: name, todos, daily_progress
 */

import { PublicKey } from '@solana/web3.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { fetchUserPledges, ParsedPledge, PledgeStatus } from '../anchor';
import {
  getPendingOperations,
  removeFromQueue,
  incrementAttempts,
} from './queue';
import {
  PendingSyncOp,
  CreatePledgeSyncData,
  ReportCompletionSyncData,
  EditPledgeSyncData,
  ReconciliationResult,
} from './types';

/**
 * Main reconciliation function - call on app launch and network reconnection.
 *
 * 1. Process any pending sync operations (failed DB writes)
 * 2. Fetch on-chain pledges for user
 * 3. Compare with DB and fix discrepancies
 */
export const reconcileUserPledges = async (
  supabase: SupabaseClient,
  walletAddress: string
): Promise<ReconciliationResult> => {
  const result: ReconciliationResult = {
    processedQueueItems: 0,
    createdInDb: 0,
    updatedInDb: 0,
    errors: [],
  };

  try {
    // 1. Process pending sync queue first
    const queueResult = await processPendingSyncQueue(supabase);
    result.processedQueueItems = queueResult.processed;
    result.errors.push(...queueResult.errors);

    // 2. Fetch on-chain pledges
    const userPubkey = new PublicKey(walletAddress);
    const onChainPledges = await fetchUserPledges(userPubkey);

    // 3. Fetch DB pledges
    const { data: dbPledges, error: dbError } = await supabase
      .from('pledges')
      .select('id, on_chain_address, status, stake_amount, deadline')
      .eq('wallet_address', walletAddress);

    if (dbError) {
      result.errors.push(`Failed to fetch DB pledges: ${dbError.message}`);
      return result;
    }

    // Create map for quick lookup
    const dbPledgeMap = new Map(
      (dbPledges || []).map((p) => [p.on_chain_address, p])
    );

    // 4. Reconcile differences
    for (const onChain of onChainPledges) {
      const address = onChain.address.toBase58();
      const dbRecord = dbPledgeMap.get(address);

      if (!dbRecord) {
        // On-chain exists but not in DB - create minimal record
        // Note: We lose metadata (name, todos) since it's not stored on-chain
        const createResult = await createRecoveredPledge(
          supabase,
          walletAddress,
          onChain
        );
        if (createResult.success) {
          result.createdInDb++;
        } else {
          result.errors.push(createResult.error!);
        }
      } else {
        // Both exist - check if status needs sync
        const onChainStatus = onChain.status;
        if (dbRecord.status !== onChainStatus) {
          const updateResult = await updatePledgeStatus(
            supabase,
            address,
            onChainStatus
          );
          if (updateResult.success) {
            result.updatedInDb++;
          } else {
            result.errors.push(updateResult.error!);
          }
        }
      }
    }

    if (__DEV__) {
      console.log('[Reconcile] Result:', result);
    }
  } catch (err: any) {
    result.errors.push(`Reconciliation failed: ${err.message}`);
  }

  return result;
};

/**
 * Process all pending sync operations from the queue
 */
async function processPendingSyncQueue(
  supabase: SupabaseClient
): Promise<{ processed: number; errors: string[] }> {
  const queue = await getPendingOperations();
  const errors: string[] = [];
  let processed = 0;

  for (const op of queue) {
    try {
      let success = false;

      switch (op.type) {
        case 'CREATE_PLEDGE':
          success = await processCreatePledgeOp(supabase, op);
          break;
        case 'REPORT_COMPLETION':
          success = await processReportCompletionOp(supabase, op);
          break;
        case 'EDIT_PLEDGE':
          success = await processEditPledgeOp(supabase, op);
          break;
      }

      if (success) {
        await removeFromQueue(op.id);
        processed++;
      } else {
        await incrementAttempts(op.id);
      }
    } catch (err: any) {
      errors.push(`Failed to process ${op.type}: ${err.message}`);
      await incrementAttempts(op.id);
    }
  }

  return { processed, errors };
}

/**
 * Process a CREATE_PLEDGE operation from the queue
 */
async function processCreatePledgeOp(
  supabase: SupabaseClient,
  op: PendingSyncOp
): Promise<boolean> {
  const data = op.data as unknown as CreatePledgeSyncData;

  const { error } = await supabase.from('pledges').insert({
    on_chain_address: data.onChainAddress,
    wallet_address: data.walletAddress,
    name: data.name,
    stake_amount: data.stakeAmount,
    deadline: data.deadline,
    todos: data.todos,
    timeframe_type: data.timeframeType,
    start_date: data.startDate,
    status: 'active',
    created_at: data.createdAt,
  });

  if (error) {
    // Check if it's a duplicate (already synced somehow)
    if (error.code === '23505') {
      // Unique violation - already exists, consider it success
      return true;
    }
    if (__DEV__) {
      console.error('[Sync Queue] CREATE_PLEDGE failed:', error);
    }
    return false;
  }

  return true;
}

/**
 * Process a REPORT_COMPLETION operation from the queue
 */
async function processReportCompletionOp(
  supabase: SupabaseClient,
  op: PendingSyncOp
): Promise<boolean> {
  const data = op.data as unknown as ReportCompletionSyncData;

  const { error } = await supabase
    .from('pledges')
    .update({
      status: 'reported',
      completion_percentage: data.completionPercentage,
      reported_at: data.reportedAt,
    })
    .eq('on_chain_address', data.onChainAddress);

  if (error) {
    if (__DEV__) {
      console.error('[Sync Queue] REPORT_COMPLETION failed:', error);
    }
    return false;
  }

  return true;
}

/**
 * Process an EDIT_PLEDGE operation from the queue
 */
async function processEditPledgeOp(
  supabase: SupabaseClient,
  op: PendingSyncOp
): Promise<boolean> {
  const data = op.data as unknown as EditPledgeSyncData;

  const updateData: Record<string, unknown> = {};
  if (data.newDeadline) {
    updateData.deadline = data.newDeadline;
  }

  if (Object.keys(updateData).length === 0) {
    // Nothing to update
    return true;
  }

  const { error } = await supabase
    .from('pledges')
    .update(updateData)
    .eq('on_chain_address', data.onChainAddress);

  if (error) {
    if (__DEV__) {
      console.error('[Sync Queue] EDIT_PLEDGE failed:', error);
    }
    return false;
  }

  return true;
}

/**
 * Create a "recovered" pledge in DB from on-chain data.
 * This is used when a pledge exists on-chain but not in DB.
 * Note: We lose metadata (name, todos) since they're not stored on-chain.
 */
async function createRecoveredPledge(
  supabase: SupabaseClient,
  walletAddress: string,
  onChain: ParsedPledge
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('pledges').insert({
    on_chain_address: onChain.address.toBase58(),
    wallet_address: walletAddress,
    name: 'Recovered Pledge', // Metadata lost
    stake_amount: onChain.stakeAmount,
    deadline: onChain.deadline.toISOString(),
    todos: [], // Metadata lost
    status: onChain.status,
    completion_percentage: onChain.completionPercentage,
    created_at: onChain.createdAt.toISOString(),
  });

  if (error) {
    // Unique violation means it already exists
    if (error.code === '23505') {
      return { success: true };
    }
    return {
      success: false,
      error: `Failed to create recovered pledge: ${error.message}`,
    };
  }

  if (__DEV__) {
    console.log(
      '[Reconcile] Created recovered pledge:',
      onChain.address.toBase58()
    );
  }

  return { success: true };
}

/**
 * Update a pledge's status in DB to match on-chain
 */
async function updatePledgeStatus(
  supabase: SupabaseClient,
  onChainAddress: string,
  status: PledgeStatus
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('pledges')
    .update({ status })
    .eq('on_chain_address', onChainAddress);

  if (error) {
    return {
      success: false,
      error: `Failed to update status: ${error.message}`,
    };
  }

  if (__DEV__) {
    console.log(
      '[Reconcile] Updated pledge status:',
      onChainAddress,
      '->',
      status
    );
  }

  return { success: true };
}
