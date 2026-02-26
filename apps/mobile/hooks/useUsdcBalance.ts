import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useAuth } from '@/contexts/AuthContext';
import { getConnection } from '@/lib/anchor/connection';
import { USDC_MINT, TOKEN_PROGRAM_ID, USDC_DECIMALS } from '@/lib/anchor/constants';

export const useUsdcBalance = () => {
  const { walletAddress } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      setBalance(null);
      return;
    }

    setIsLoading(true);
    try {
      const connection = getConnection();
      const owner = new PublicKey(walletAddress);

      const tokenAccounts = await connection.getTokenAccountsByOwner(owner, {
        mint: USDC_MINT,
        programId: TOKEN_PROGRAM_ID,
      });

      if (tokenAccounts.value.length === 0) {
        setBalance(0);
        return;
      }

      // Sum balances across all USDC token accounts (usually just one)
      let total = 0;
      for (const { account } of tokenAccounts.value) {
        // Token account data layout: mint (32) + owner (32) + amount (8)
        const amount = account.data.readBigUInt64LE(64);
        total += Number(amount) / 10 ** USDC_DECIMALS;
      }

      setBalance(total);
    } catch (err) {
      console.error('Failed to fetch USDC balance:', err);
      setBalance(null);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, isLoading, refetch: fetchBalance };
};
