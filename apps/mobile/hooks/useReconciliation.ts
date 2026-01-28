import { useEffect, useCallback, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useAuth } from '../contexts/AuthContext';
import { reconcileUserPledges, ReconciliationResult, getQueueStats } from '../lib/sync';

interface UseReconciliationReturn {
  isReconciling: boolean;
  lastResult: ReconciliationResult | null;
  pendingCount: number;
  reconcileNow: () => Promise<void>;
}

/**
 * Hook that handles automatic reconciliation:
 * - On app launch (when wallet connected)
 * - When app returns from background
 * - When network reconnects
 *
 * Also provides manual reconcileNow() for on-demand sync.
 */
export function useReconciliation(): UseReconciliationReturn {
  const { walletAddress, supabase, user } = useAuth();
  const [isReconciling, setIsReconciling] = useState(false);
  const [lastResult, setLastResult] = useState<ReconciliationResult | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

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
      const result = await reconcileUserPledges(supabase, walletAddress);
      setLastResult(result);

      // Update pending count
      const stats = await getQueueStats();
      setPendingCount(stats.total);

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
      setPendingCount(0);
    }
  }, [walletAddress]);

  // Reconcile when app returns from background
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && walletAddress && user) {
        runReconciliation();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
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

  // Update pending count periodically
  useEffect(() => {
    const updatePendingCount = async () => {
      const stats = await getQueueStats();
      setPendingCount(stats.total);
    };

    updatePendingCount();
  }, [lastResult]);

  return {
    isReconciling,
    lastResult,
    pendingCount,
    reconcileNow: runReconciliation,
  };
}
