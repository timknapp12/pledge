import bs58 from 'bs58';
import Constants from 'expo-constants';
import type { PhantomCluster } from './types';

const APP_URL = 'https://pledge.app';
const PHANTOM_BASE = 'https://phantom.app/ul/v1';

// Use the bare scheme for callbacks (e.g. `pledgedev://?data=...`). Adding
// a path (`pledgedev://phantom/signMessage`) makes Expo Router try to
// match it against a route file and fall through to `+not-found`. The
// pending-request queue in client.ts already knows which response is
// expected, so a distinguishing path is unnecessary.
const redirectLink = (): string => {
  const scheme = Constants.expoConfig?.scheme;
  if (typeof scheme !== 'string') {
    throw new Error('Expo scheme is not configured');
  }
  return `${scheme}://`;
};

export const buildConnectUrl = (
  dappPublicKey: Uint8Array,
  cluster: PhantomCluster,
): string => {
  const params = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(dappPublicKey),
    cluster,
    app_url: APP_URL,
    redirect_link: redirectLink(),
  });
  return `${PHANTOM_BASE}/connect?${params.toString()}`;
};

export const buildSignMessageUrl = (
  dappPublicKey: Uint8Array,
  encryptedPayload: Uint8Array,
  nonce: Uint8Array,
): string => {
  const params = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(dappPublicKey),
    nonce: bs58.encode(nonce),
    redirect_link: redirectLink(),
    payload: bs58.encode(encryptedPayload),
  });
  return `${PHANTOM_BASE}/signMessage?${params.toString()}`;
};

export const buildSignTransactionUrl = (
  dappPublicKey: Uint8Array,
  encryptedPayload: Uint8Array,
  nonce: Uint8Array,
): string => {
  const params = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(dappPublicKey),
    nonce: bs58.encode(nonce),
    redirect_link: redirectLink(),
    payload: bs58.encode(encryptedPayload),
  });
  return `${PHANTOM_BASE}/signTransaction?${params.toString()}`;
};

export const buildDisconnectUrl = (
  dappPublicKey: Uint8Array,
  encryptedPayload: Uint8Array,
  nonce: Uint8Array,
): string => {
  const params = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(dappPublicKey),
    nonce: bs58.encode(nonce),
    redirect_link: redirectLink(),
    payload: bs58.encode(encryptedPayload),
  });
  return `${PHANTOM_BASE}/disconnect?${params.toString()}`;
};
