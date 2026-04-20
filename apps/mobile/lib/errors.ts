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

const TRANSACTION_ERROR_MAP: ErrorMapping[] = [
  { pattern: 'insufficient funds', key: 'Insufficient funds for this transaction.' },
  { pattern: 'Insufficient', key: 'Insufficient funds for this transaction.' },
  { pattern: '0x1', key: 'Insufficient funds for this transaction.' },
  { pattern: 'confirmation timed out', key: 'Transaction timed out. Please check your connection and try again.' },
  { pattern: 'timed out', key: 'Transaction timed out. Please check your connection and try again.' },
  { pattern: 'blockhash not found', key: 'Transaction expired. Please try again.' },
  { pattern: 'BlockhashNotFound', key: 'Transaction expired. Please try again.' },
  { pattern: 'already been processed', key: 'This transaction was already processed.' },
  { pattern: 'AlreadyInUse', key: 'This transaction was already processed.' },
  { pattern: 'Transaction failed', key: 'Transaction failed. Please try again.' },
  { pattern: 'not found on-chain', key: 'Pledge not found on the blockchain. It may have already been settled.' },
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
