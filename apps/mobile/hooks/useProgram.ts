import { useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchUserPledges,
  fetchPledge,
  fetchProgramConfig,
  buildCreatePledgeTransaction,
  buildReportCompletionTransaction,
  signAndSendTransaction,
  ParsedPledge,
  ProgramConfigAccount,
} from '../lib/anchor';

export interface UseProgramReturn {
  // State
  isLoading: boolean;
  error: string | null;

  // Read operations
  fetchMyPledges: () => Promise<ParsedPledge[]>;
  fetchPledgeByAddress: (address: PublicKey) => Promise<ParsedPledge | null>;
  fetchConfig: () => Promise<ProgramConfigAccount>;

  // Write operations
  createPledge: (
    stakeAmountUsdc: number,
    deadline: Date
  ) => Promise<{ signature: string; pledgeAddress: PublicKey }>;
  reportCompletion: (
    pledgeCreatedAt: BN,
    completionPercentage: number
  ) => Promise<string>;

  // Utilities
  clearError: () => void;
}

export const useProgram = (): UseProgramReturn => {
  const { walletAddress } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Fetch all pledges for the connected user FROM THE CHAIN.
   * Use for RECONCILIATION only - comparing chain state vs Supabase.
   * For day-to-day UI reads, fetch from Supabase instead (faster, has metadata like name/todos).
   */
  const fetchMyPledges = useCallback(async (): Promise<ParsedPledge[]> => {
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const userPubkey = new PublicKey(walletAddress);
      return await fetchUserPledges(userPubkey);
    } catch (err: any) {
      const message = err.message || 'Failed to fetch pledges';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  /**
   * Fetch a single pledge by address FROM THE CHAIN.
   * Use to verify on-chain state before/after transactions.
   * For day-to-day UI reads, fetch from Supabase instead.
   */
  const fetchPledgeByAddress = useCallback(
    async (address: PublicKey): Promise<ParsedPledge | null> => {
      setIsLoading(true);
      setError(null);

      try {
        return await fetchPledge(address);
      } catch (err: any) {
        const message = err.message || 'Failed to fetch pledge';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Fetch program config FROM THE CHAIN.
   * Contains fee percentages, grace period, treasury/charity addresses.
   * Can cache this - it rarely changes.
   */
  const fetchConfig = useCallback(async (): Promise<ProgramConfigAccount> => {
    setIsLoading(true);
    setError(null);

    try {
      return await fetchProgramConfig();
    } catch (err: any) {
      const message = err.message || 'Failed to fetch config';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new pledge ON-CHAIN via MWA.
   * After success, caller should write to Supabase (confirm-then-write pattern).
   * Returns the signature and pledge address for DB storage.
   */
  const createPledge = useCallback(
    async (
      stakeAmountUsdc: number,
      deadline: Date
    ): Promise<{ signature: string; pledgeAddress: PublicKey }> => {
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      setIsLoading(true);
      setError(null);

      try {
        const userPubkey = new PublicKey(walletAddress);

        // Build the transaction
        const { transaction, pledgeAddress } =
          await buildCreatePledgeTransaction(userPubkey, stakeAmountUsdc, deadline);

        // Sign and send via MWA
        const { signature } = await signAndSendTransaction(transaction);

        return { signature, pledgeAddress };
      } catch (err: any) {
        const message = err.message || 'Failed to create pledge';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [walletAddress]
  );

  /**
   * Report completion percentage ON-CHAIN via MWA.
   * Called when user submits their completion report within the grace period.
   * After success, caller should update Supabase status.
   */
  const reportCompletion = useCallback(
    async (pledgeCreatedAt: BN, completionPercentage: number): Promise<string> => {
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      setIsLoading(true);
      setError(null);

      try {
        const userPubkey = new PublicKey(walletAddress);

        // Build the transaction
        const transaction = await buildReportCompletionTransaction(
          userPubkey,
          pledgeCreatedAt,
          completionPercentage
        );

        // Sign and send via MWA
        const { signature } = await signAndSendTransaction(transaction);

        return signature;
      } catch (err: any) {
        const message = err.message || 'Failed to report completion';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [walletAddress]
  );

  return {
    isLoading,
    error,
    fetchMyPledges,
    fetchPledgeByAddress,
    fetchConfig,
    createPledge,
    reportCompletion,
    clearError,
  };
};
