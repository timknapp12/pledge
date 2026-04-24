import { Platform } from 'react-native';
import { Transaction } from '@solana/web3.js';
import { getConnection } from './connection';
import { pollForConfirmation } from './confirm';
import {
  signAndSendTransactionMwa,
  signTransactionMwa,
  signAllTransactionsMwa,
} from './mwa';
import * as phantom from '@/lib/phantom';

export interface SignAndSendResult {
  signature: string;
  confirmed: boolean;
}

/**
 * Sign and send a transaction. On Android this goes through Mobile Wallet
 * Adapter; on iOS it goes through Phantom deep linking (sign-only, then we
 * broadcast ourselves). Waits for confirmation before returning.
 */
export const signAndSendTransaction = async (
  transaction: Transaction,
): Promise<SignAndSendResult> => {
  if (Platform.OS === 'ios') {
    const signed = await phantom.signTransaction(transaction);
    const connection = getConnection();
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    await pollForConfirmation(connection, signature);
    return { signature, confirmed: true };
  }
  return signAndSendTransactionMwa(transaction);
};

/**
 * Sign a transaction without sending (for inspection or manual send).
 */
export const signTransaction = async (
  transaction: Transaction,
): Promise<Transaction> => {
  if (Platform.OS === 'ios') {
    return phantom.signTransaction(transaction);
  }
  return signTransactionMwa(transaction);
};

/**
 * Sign multiple transactions. On iOS Phantom deep-links one at a time,
 * which is ugly UX — keep this Android-only for now and let callers
 * batch into one tx when possible.
 */
export const signAllTransactions = async (
  transactions: Transaction[],
): Promise<Transaction[]> => {
  if (Platform.OS === 'ios') {
    const signed: Transaction[] = [];
    for (const tx of transactions) {
      signed.push(await phantom.signTransaction(tx));
    }
    return signed;
  }
  return signAllTransactionsMwa(transactions);
};
