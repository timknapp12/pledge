/**
 * Types for the sync queue and reconciliation system.
 *
 * When a transaction succeeds but DB write fails, we queue the operation
 * for retry. On app launch, we process the queue and reconcile with on-chain state.
 */

import { PledgeTodos } from '@/hooks/useSupabase';

export type SyncOperationType =
  | 'CREATE_PLEDGE'
  | 'REPORT_COMPLETION'
  | 'EDIT_PLEDGE';

export interface PendingSyncOp {
  id: string;
  type: SyncOperationType;
  txSignature: string;
  data: Record<string, unknown>;
  createdAt: number;
  attempts: number;
}

// Data shape for CREATE_PLEDGE operations
export interface CreatePledgeSyncData {
  onChainAddress: string;
  walletAddress: string;
  name: string;
  stakeAmount: number; // In USDC (not lamports)
  deadline: string; // ISO timestamp
  todos: PledgeTodos;
  timeframeType?: string;
  startDate?: string;
  createdAt: string; // On-chain createdAt as ISO timestamp
}

// Data shape for REPORT_COMPLETION operations
export interface ReportCompletionSyncData {
  onChainAddress: string;
  completionPercentage: number;
  reportedAt: string; // ISO timestamp
}

// Data shape for EDIT_PLEDGE operations
export interface EditPledgeSyncData {
  onChainAddress: string;
  newDeadline?: string; // ISO timestamp
}

// Result of reconciliation
export interface ReconciliationResult {
  processedQueueItems: number;
  createdInDb: number;
  updatedInDb: number;
  errors: string[];
}
