import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import type { PhantomSessionState } from './types';

const STORAGE_KEY = 'pledge_phantom_session';

// Module-scope cache. Must survive React remounts to keep the dApp keypair
// paired with the sharedSecret derived from Phantom's first `connect`.
let cache: PhantomSessionState | null = null;

const createFresh = (): PhantomSessionState => {
  const kp = nacl.box.keyPair();
  return {
    dappSecretKeyBs58: bs58.encode(kp.secretKey),
    dappPublicKeyBs58: bs58.encode(kp.publicKey),
    phantomPublicKeyBs58: null,
    sharedSecretBs58: null,
    sessionToken: null,
    walletPublicKey: null,
  };
};

export const loadSession = async (): Promise<PhantomSessionState> => {
  if (cache) return cache;
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (raw) {
      cache = JSON.parse(raw) as PhantomSessionState;
      return cache;
    }
  } catch (err) {
    console.error('[Phantom] Failed to read session:', err);
  }
  const fresh = createFresh();
  await persistSession(fresh);
  return fresh;
};

export const persistSession = async (
  next: PhantomSessionState,
): Promise<void> => {
  cache = next;
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error('[Phantom] Failed to persist session:', err);
  }
};

export const clearSession = async (): Promise<void> => {
  cache = null;
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  } catch (err) {
    console.error('[Phantom] Failed to clear session:', err);
  }
};

// Clear only connection state — keep the dApp keypair so future reconnects
// can still decrypt anything still in flight. Used on explicit disconnect.
export const clearConnection = async (): Promise<void> => {
  const session = await loadSession();
  await persistSession({
    ...session,
    phantomPublicKeyBs58: null,
    sharedSecretBs58: null,
    sessionToken: null,
    walletPublicKey: null,
  });
};

export const isConnected = (session: PhantomSessionState): boolean =>
  session.sharedSecretBs58 !== null &&
  session.walletPublicKey !== null &&
  session.sessionToken !== null;
