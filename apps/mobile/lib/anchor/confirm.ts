import { Connection } from '@solana/web3.js';

/**
 * Poll for transaction confirmation using getSignatureStatuses.
 * Works over HTTP — no WebSocket needed (important since our RPC is proxied
 * through a Supabase Edge Function).
 */
export const pollForConfirmation = async (
  connection: Connection,
  signature: string,
  timeoutMs = 60_000,
  intervalMs = 2_000,
): Promise<void> => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value?.[0];

    if (status) {
      if (status.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(status.err)}`,
        );
      }
      if (
        status.confirmationStatus === 'confirmed' ||
        status.confirmationStatus === 'finalized'
      ) {
        return;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Transaction confirmation timed out');
};
