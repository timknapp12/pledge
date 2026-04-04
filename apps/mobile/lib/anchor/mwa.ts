import { Transaction, Connection } from '@solana/web3.js';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { getConnection, CLUSTER } from './connection';

// App identity for MWA
const APP_IDENTITY = {
  name: 'Pledge',
  uri: 'https://pledge.app',
  icon: 'favicon.ico',
};

export interface SignAndSendResult {
  signature: string;
  confirmed: boolean;
}

/**
 * Sign and send a transaction using Mobile Wallet Adapter
 * Waits for confirmation before returning
 */
export const signAndSendTransaction = async (
  transaction: Transaction,
): Promise<SignAndSendResult> => {
  const connection = getConnection();

  return await transact(async (wallet: Web3MobileWallet) => {
    // Authorize with wallet
    await wallet.authorize({
      cluster: CLUSTER,
      identity: APP_IDENTITY,
    });

    // Sign the transaction
    const signedTransactions = await wallet.signTransactions({
      transactions: [transaction],
    });

    const signedTx = signedTransactions[0];

    // Send the signed transaction
    const signature = await connection.sendRawTransaction(
      signedTx.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );

    // Poll for confirmation (HTTP-only, works through RPC proxy)
    await pollForConfirmation(connection, signature);

    return {
      signature,
      confirmed: true,
    };
  });
};

/**
 * Poll for transaction confirmation using getSignatureStatuses.
 * Works over HTTP — no WebSocket needed.
 */
const pollForConfirmation = async (
  connection: Connection,
  signature: string,
  timeoutMs = 60000,
  intervalMs = 2000,
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
      // 'confirmed' or 'finalized' means success
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

/**
 * Sign a transaction without sending (for inspection or manual send)
 */
export const signTransaction = async (
  transaction: Transaction,
): Promise<Transaction> => {
  return await transact(async (wallet: Web3MobileWallet) => {
    await wallet.authorize({
      cluster: CLUSTER,
      identity: APP_IDENTITY,
    });

    const signedTransactions = await wallet.signTransactions({
      transactions: [transaction],
    });

    return signedTransactions[0];
  });
};

/**
 * Sign multiple transactions in a single MWA session
 */
export const signAllTransactions = async (
  transactions: Transaction[],
): Promise<Transaction[]> => {
  return await transact(async (wallet: Web3MobileWallet) => {
    await wallet.authorize({
      cluster: CLUSTER,
      identity: APP_IDENTITY,
    });

    return await wallet.signTransactions({
      transactions,
    });
  });
};
