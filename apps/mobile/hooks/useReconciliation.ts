import { useEffect, useCallback, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useAuth } from '../contexts/AuthContext';
import { reconcileUserPledges, ReconciliationResult } from '../lib/sync';

interface UseReconciliationReturn {
  isReconciling: boolean;
  lastResult: ReconciliationResult | null;
  reconcileNow: () => Promise<void>;
}

/**
 * Hook that handles automatic reconciliation:
 * - On app launch (when wallet connected)
 * - When app returns from background
 * - When network reconnects
 *
 * Status sync is primarily handled by the Helius webhook indexer.
 * Reconciliation is a fallback for metadata gaps.
 */
export const useReconciliation = (): UseReconciliationReturn => {
  const { walletAddress, supabase, user } = useAuth();
  const [isReconciling, setIsReconciling] = useState(false);
  const [lastResult, setLastResult] = useState<ReconciliationResult | null>(
    null,
  );

  // Track if we've done initial reconciliation
  const hasReconciled = useRef(false);
  // Track previous network state
  const wasConnected = useRef(true);

  const runReconciliation = useCallback(async () => {
    if (!walletAddress || !user || isReconciling) {
      return;
    }

    setIsReconciling(true);
    try {
      const result = await reconcileUserPledges(supabase, walletAddress, user.id);
      setLastResult(result);

      if (__DEV__) {
        console.log('[useReconciliation] Completed:', result);
      }
    } catch (err) {
      if (__DEV__) {
        console.error('[useReconciliation] Error:', err);
      }
    } finally {
      setIsReconciling(false);
    }
  }, [walletAddress, user, supabase, isReconciling]);

  // Initial reconciliation when wallet connects
  useEffect(() => {
    if (walletAddress && user && !hasReconciled.current) {
      hasReconciled.current = true;
      runReconciliation();
    }
  }, [walletAddress, user, runReconciliation]);

  // Reset flag when wallet disconnects
  useEffect(() => {
    if (!walletAddress) {
      hasReconciled.current = false;
      setLastResult(null);
    }
  }, [walletAddress]);

  // Reconcile when app returns from background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && walletAddress && user) {
        runReconciliation();
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [walletAddress, user, runReconciliation]);

  // Reconcile when network reconnects
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isConnected = state.isConnected ?? false;

      // If we just reconnected (was disconnected, now connected)
      if (isConnected && !wasConnected.current && walletAddress && user) {
        runReconciliation();
      }

      wasConnected.current = isConnected;
    });

    return () => unsubscribe();
  }, [walletAddress, user, runReconciliation]);

  return {
    isReconciling,
    lastResult,
    reconcileNow: runReconciliation,
  };
};
