/* eslint-disable @typescript-eslint/no-require-imports */
import { Platform } from 'react-native';
import { Transaction } from '@solana/web3.js';
import type { Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { getConnection, CLUSTER } from './connection';
import { pollForConfirmation } from './confirm';

// MWA is an Android-only native module. Importing it on iOS crashes at
// module-load time, so we pull it in lazily via require() behind a Platform
// guard. iOS wallet flows go through the Phantom deep-link signer instead.
type TransactFn =
  typeof import('@solana-mobile/mobile-wallet-adapter-protocol-web3js').transact;

let transact: TransactFn | null = null;
if (Platform.OS === 'android') {
  try {
    transact = require('@solana-mobile/mobile-wallet-adapter-protocol-web3js').transact;
  } catch (error) {
    console.error('[MWA] Failed to load mobile-wallet-adapter:', error);
  }
}

const assertAndroid = (): TransactFn => {
  if (!transact) {
    throw new Error(
      'Mobile Wallet Adapter is Android-only. iOS must route wallet flows through Phantom.',
    );
  }
  return transact;
};

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
 * Android (MWA) path: sign and send a transaction, wait for confirmation.
 * iOS callers should go through `lib/anchor/signer.ts` instead, which
 * branches to the Phantom deep-link signer.
 */
export const signAndSendTransactionMwa = async (
  transaction: Transaction,
): Promise<SignAndSendResult> => {
  const connection = getConnection();
  const mwa = assertAndroid();

  return await mwa(async (wallet: Web3MobileWallet) => {
    await wallet.authorize({
      cluster: CLUSTER,
      identity: APP_IDENTITY,
    });

    const signedTransactions = await wallet.signTransactions({
      transactions: [transaction],
    });

    const signedTx = signedTransactions[0];

    const signature = await connection.sendRawTransaction(
      signedTx.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      },
    );

    await pollForConfirmation(connection, signature);

    return {
      signature,
      confirmed: true,
    };
  });
};

export const signTransactionMwa = async (
  transaction: Transaction,
): Promise<Transaction> => {
  const mwa = assertAndroid();
  return await mwa(async (wallet: Web3MobileWallet) => {
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

export const signAllTransactionsMwa = async (
  transactions: Transaction[],
): Promise<Transaction[]> => {
  const mwa = assertAndroid();
  return await mwa(async (wallet: Web3MobileWallet) => {
    await wallet.authorize({
      cluster: CLUSTER,
      identity: APP_IDENTITY,
    });
    return await wallet.signTransactions({ transactions });
  });
};
