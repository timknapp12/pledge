import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';

type OTAStatus = 'idle' | 'checking' | 'available' | 'downloading';

export function useOTAUpdates() {
  const [status, setStatus] = useState<OTAStatus>('idle');

  useEffect(() => {
    if (__DEV__) return;

    (async () => {
      try {
        setStatus('checking');
        const update = await Updates.checkForUpdateAsync();
        setStatus(update.isAvailable ? 'available' : 'idle');
      } catch (e) {
        console.warn('OTA update check failed:', e);
        setStatus('idle');
      }
    })();
  }, []);

  const applyUpdate = useCallback(async () => {
    try {
      setStatus('downloading');
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (e) {
      console.warn('OTA update apply failed:', e);
      setStatus('idle');
    }
  }, []);

  return { status, applyUpdate };
}
