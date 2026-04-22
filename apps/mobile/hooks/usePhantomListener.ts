import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { resolveIncomingUrl } from '@/lib/phantom';

// iOS-only: forward Phantom callback URLs into the Phantom client's
// pending-request resolver. On Android this is a no-op.
export const usePhantomListener = (): void => {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const handle = (url: string | null): void => {
      if (!url) return;
      // Forward unconditionally — resolveIncomingUrl no-ops when no
      // Phantom request is pending, so unrelated deep links pass through.
      resolveIncomingUrl(url);
    };

    // Cold-start: if the app was opened from a Phantom callback, pick it up.
    Linking.getInitialURL().then(handle).catch(() => {});

    const sub = Linking.addEventListener('url', (event) => {
      handle(event.url);
    });

    return () => sub.remove();
  }, []);
};
