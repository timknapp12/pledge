/**
 * Shared error classification and user-friendly message mapping.
 *
 * Converts raw Java/Solana/Anchor exceptions into human-readable strings
 * that are safe to show in the UI. All returned strings are i18n keys.
 */

// ─── User-initiated cancellation detection ─────────────────────────

const CANCELLATION_PATTERNS = [
  'CancellationException',
  'USER_DECLINED',
  'user rejected',
  'User rejected',
  'cancelled',
  'canceled',
] as const;

/**
 * Returns true when the error was triggered by the user intentionally
 * dismissing a wallet prompt or declining a transaction signature.
 */
export const isUserCancellation = (error: unknown): boolean => {
  const msg = extractMessage(error);
  return CANCELLATION_PATTERNS.some((p) => msg.includes(p));
};

// ─── Error → i18n key mapping ──────────────────────────────────────

interface ErrorMapping {
  pattern: string | RegExp;
  key: string;
}

const WALLET_ERROR_MAP: ErrorMapping[] = [
  { pattern: 'No wallet found', key: 'No Solana wallet app found. Please install one to continue.' },
  { pattern: 'NOT_FOUND', key: 'No Solana wallet app found. Please install one to continue.' },
  { pattern: 'NOT_SIGNED', key: 'Wallet did not sign the message. Please try again.' },
  { pattern: 'AUTHORIZATION_FAILED', key: 'Wallet authorization failed. Please try again.' },
  { pattern: 'ATTEST_ORIGIN_ANDROID', key: 'Wallet authorization failed. Please try again.' },
  { pattern: 'verification failed', key: 'Wallet verification failed. Please try again.' },
  { pattern: 'Wallet verification failed', key: 'Wallet verification failed. Please try again.' },
];

// Specific Pledge program errors first (Anchor codes 6000+), then generic
// patterns. Order matters — the first match wins. The previous pattern `0x1`
// caught every Anchor custom error (all start with 0x17xx) and mis-labelled
// them as "Insufficient funds".
const TRANSACTION_ERROR_MAP: ErrorMapping[] = [
  // Pledge program custom errors (decimal → hex):
  // 6008=0x1778 PledgeNotActive, 6009=0x1779 PledgeNotReported,
  // 6010=0x177a DeadlineNotPassed, 6011=0x177b DeadlinePassed,
  // 6012=0x177c GracePeriodNotEnded, 6013=0x177d GracePeriodEnded,
  // 6014=0x177e AlreadyReported, 6015=0x177f InvalidCompletion,
  // 6017=0x1781 NumericOverflow, 6018=0x1782 NumericUnderflow,
  // 6019=0x1783 InvalidTokenMint, 6020=0x1784 InvalidTokenAccountOwner.
  { pattern: /0x1778/i, key: 'This pledge is not active.' },
  { pattern: /0x1779/i, key: 'This pledge has not been reported yet.' },
  { pattern: /0x177a/i, key: 'The deadline has not passed yet.' },
  { pattern: /0x177b/i, key: 'The deadline has already passed.' },
  { pattern: /0x177c/i, key: 'The grace period has not ended.' },
  { pattern: /0x177d/i, key: 'The grace period has ended.' },
  { pattern: /0x177e/i, key: 'This pledge was already reported.' },
  { pattern: /0x177f/i, key: 'Invalid completion percentage.' },
  { pattern: /0x1781/i, key: 'Numeric overflow in transaction.' },
  { pattern: /0x1782/i, key: 'Numeric underflow in transaction.' },
  { pattern: /0x1783/i, key: 'Invalid token mint.' },
  { pattern: /0x1784/i, key: 'Invalid token account owner.' },
  // Fee-payer / source account out of lamports. Solana RPC string is
  // "insufficient funds for instruction" — the leading lowercase is the
  // distinguishing marker vs Anchor custom errors that include "Insufficient"
  // somewhere in account names.
  { pattern: 'insufficient funds for instruction', key: 'Insufficient funds for this transaction.' },
  { pattern: 'insufficient lamports', key: 'Insufficient funds for this transaction.' },
  { pattern: 'confirmation timed out', key: 'Transaction timed out. Please check your connection and try again.' },
  { pattern: 'timed out', key: 'Transaction timed out. Please check your connection and try again.' },
  { pattern: 'blockhash not found', key: 'Transaction expired. Please try again.' },
  { pattern: 'BlockhashNotFound', key: 'Transaction expired. Please try again.' },
  { pattern: 'already been processed', key: 'This transaction was already processed.' },
  { pattern: 'AlreadyInUse', key: 'This transaction was already processed.' },
  { pattern: 'Transaction failed', key: 'Transaction failed. Please try again.' },
  { pattern: 'not found on-chain', key: 'Pledge not found on the blockchain. It may have already been settled.' },
  // Generic Anchor / SPL errors not matched above.
  { pattern: /custom program error: 0x/i, key: 'Transaction rejected by the program. Please try again.' },
  { pattern: /Program.*error/i, key: 'Transaction rejected by the program. Please try again.' },
  { pattern: 'Network request failed', key: 'Network error. Please check your connection and try again.' },
  { pattern: 'Failed to fetch', key: 'Network error. Please check your connection and try again.' },
];

/**
 * Map a wallet-related error to a user-friendly i18n key.
 * Returns null if the error is a user cancellation (should be suppressed).
 * Returns a fallback key for unrecognized errors.
 */
export const getWalletErrorMessage = (error: unknown): string | null => {
  if (isUserCancellation(error)) return null;
  const msg = extractMessage(error);
  return matchErrorMap(msg, WALLET_ERROR_MAP) ?? 'Failed to connect wallet. Please try again.';
};

/**
 * Map a transaction-related error to a user-friendly i18n key.
 * Returns null if the error is a user cancellation (should be suppressed).
 * Returns a fallback key for unrecognized errors.
 */
export const getTransactionErrorMessage = (error: unknown): string | null => {
  if (isUserCancellation(error)) return null;
  const msg = extractMessage(error);
  return matchErrorMap(msg, TRANSACTION_ERROR_MAP) ?? 'Something went wrong. Please try again.';
};

// ─── Helpers ───────────────────────────────────────────────────────

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function matchErrorMap(msg: string, map: ErrorMapping[]): string | null {
  for (const { pattern, key } of map) {
    if (typeof pattern === 'string') {
      if (msg.includes(pattern)) return key;
    } else {
      if (pattern.test(msg)) return key;
    }
  }
  return null;
}
