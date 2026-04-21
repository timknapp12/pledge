/**
 * Reconciliation logic for syncing on-chain state with Supabase.
 *
 * Called on app launch and after network reconnection.
 * On-chain is source of truth for: status, stake_amount, deadline
 * Supabase is source of truth for: name, todos, daily_progress
 *
 * NOTE: Status sync is now primarily handled by the Helius webhook indexer.
 * Reconciliation is a fallback that catches metadata gaps (pledges that
 * exist on-chain but are missing from DB).
 */

import { PublicKey } from '@solana/web3.js';
import { SupabaseClient } from '@supabase/supabase-js';
import { fetchUserPledges, ParsedPledge, PledgeStatus } from '../anchor';
import { processRetryQueue } from './retryQueue';

export interface ReconciliationResult {
  processedQueueItems: number;
  createdInDb: number;
  updatedInDb: number;
  errors: string[];
}

/**
 * Main reconciliation function - call on app launch and network reconnection.
 *
 * 1. Process any pending retry queue items (preserves full metadata)
 * 2. Fetch on-chain pledges for user
 * 3. Compare with DB and fix discrepancies
 *
 * The indexer handles status sync, so reconciliation focuses on
 * ensuring every on-chain pledge has a DB record.
 */
export const reconcileUserPledges = async (
  supabase: SupabaseClient,
  walletAddress: string,
  userId: string,
): Promise<ReconciliationResult> => {
  const result: ReconciliationResult = {
    processedQueueItems: 0,
    createdInDb: 0,
    updatedInDb: 0,
    errors: [],
  };

  try {
    // 1. Process any pending retry queue items first
    const queueResult = await processRetryQueue(supabase, userId);
    result.processedQueueItems = queueResult.processed;

    // 2. Fetch on-chain pledges
    const userPubkey = new PublicKey(walletAddress);
    const onChainPledges = await fetchUserPledges(userPubkey);

    // 3. Fetch DB pledges
    const { data: dbPledges, error: dbError } = await supabase
      .from('pledges')
      .select('id, on_chain_address, status, stake_amount, deadline')
      .eq('user_id', userId);

    if (dbError) {
      result.errors.push(`Failed to fetch DB pledges: ${dbError.message}`);
      return result;
    }

    // Create map for quick lookup
    const dbPledgeMap = new Map(
      (dbPledges || []).map((p) => [p.on_chain_address, p]),
    );

    // 4. Reconcile differences
    for (const onChain of onChainPledges) {
      const address = onChain.address.toBase58();
      const dbRecord = dbPledgeMap.get(address);

      if (!dbRecord) {
        // On-chain exists but not in DB — create minimal record.
        // The indexer usually handles this, but this is a fallback.
        const createResult = await createRecoveredPledge(
          supabase,
          userId,
          onChain,
        );
        if (createResult.success) {
          result.createdInDb++;
        } else {
          result.errors.push(createResult.error!);
        }
      } else {
        // Both exist — check if status needs sync (fallback for indexer)
        const onChainStatus = onChain.status;
        if (dbRecord.status !== onChainStatus) {
          const updateResult = await updatePledgeStatus(
            supabase,
            address,
            onChainStatus,
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
 * Create a "recovered" pledge in DB from on-chain data.
 * This is used when a pledge exists on-chain but not in DB.
 * Note: We lose metadata (name, todos) since they're not stored on-chain.
 */
async function createRecoveredPledge(
  supabase: SupabaseClient,
  userId: string,
  onChain: ParsedPledge,
): Promise<{ success: boolean; error?: string }> {
  const deadlineIso = onChain.deadline.toISOString();
  const createdIso = onChain.createdAt.toISOString();

  const { error } = await supabase.from('pledges').insert({
    user_id: userId,
    on_chain_address: onChain.address.toBase58(),
    name: '',
    timeframe_type: 'custom',
    start_date: createdIso,
    end_date: deadlineIso,
    deadline: deadlineIso,
    stake_amount: onChain.stakeAmount,
    todos: { goals: [], daily: {} },
    status: onChain.status,
    completion_percentage: onChain.completionPercentage,
    created_at: createdIso,
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
      onChain.address.toBase58(),
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
  status: PledgeStatus,
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
      status,
    );
  }

  return { success: true };
}
