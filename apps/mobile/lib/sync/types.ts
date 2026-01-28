/**
 * Types for the sync queue and reconciliation system.
 *
 * When a transaction succeeds but DB write fails, we queue the operation
 * for retry. On app launch, we process the queue and reconcile with on-chain state.
 */

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
  todos: TodoItem[];
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

// Todo item structure (matches Supabase schema)
export interface TodoItem {
  text: string;
  days?: number[] | null; // 0-6 for specific days, null for all days
}

// Result of reconciliation
export interface ReconciliationResult {
  processedQueueItems: number;
  createdInDb: number;
  updatedInDb: number;
  errors: string[];
}
