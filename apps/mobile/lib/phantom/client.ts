import * as Linking from 'expo-linking';
import bs58 from 'bs58';
import { Transaction } from '@solana/web3.js';
import {
  loadSession,
  persistSession,
  clearConnection,
  isConnected,
} from './session';
import {
  buildConnectUrl,
  buildSignMessageUrl,
  buildSignTransactionUrl,
  buildDisconnectUrl,
} from './urls';
import {
  encryptForPhantom,
  decryptFromPhantom,
  deriveSharedSecret,
} from './crypto';
import type { PhantomCluster } from './types';

const REQUEST_TIMEOUT_MS = 120_000;

// One request is in flight at a time. The URL listener calls
// resolveIncomingUrl() to feed the callback URL back to the awaiter.
let pending: {
  resolve: (url: string) => void;
  reject: (err: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
} | null = null;

const awaitCallback = (): Promise<string> =>
  new Promise((resolve, reject) => {
    if (pending) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error('Superseded by a new Phantom request'));
    }
    const timeoutId = setTimeout(() => {
      if (pending) {
        pending.reject(new Error('Phantom request timed out'));
        pending = null;
      }
    }, REQUEST_TIMEOUT_MS);
    pending = { resolve, reject, timeoutId };
  });

const clearPending = (): void => {
  if (pending) {
    clearTimeout(pending.timeoutId);
    pending = null;
  }
};

// Called by the iOS Linking listener for every inbound URL. Gated on
// `pending` so unrelated deep links are ignored.
export const resolveIncomingUrl = (url: string): void => {
  console.log('[Phantom] incoming URL:', url, 'pending?', !!pending);
  if (!pending) return;
  const resolver = pending.resolve;
  clearPending();
  resolver(url);
};

type QueryParams = Record<string, string | undefined>;

const parseQuery = (url: string): QueryParams => {
  // Linking.parse handles custom schemes reliably; URL constructor does not
  // on React Native / Hermes. queryParams values can be string | string[].
  const raw = Linking.parse(url).queryParams ?? {};
  const out: QueryParams = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = Array.isArray(value) ? value[0] : value ?? undefined;
  }
  return out;
};

const openAndAwait = async (url: string): Promise<QueryParams> => {
  const responsePromise = awaitCallback();
  try {
    await Linking.openURL(url);
  } catch (err) {
    clearPending();
    throw new Error(
      `Failed to open Phantom: ${(err as Error).message ?? String(err)}`,
    );
  }
  const responseUrl = await responsePromise;
  const params = parseQuery(responseUrl);
  if (params.errorCode) {
    const errorMessage =
      params.errorMessage ?? `Phantom error ${params.errorCode}`;
    console.log(
      '[Phantom] Phantom returned error',
      params.errorCode,
      errorMessage,
    );
    throw new Error(errorMessage);
  }
  return params;
};

const requireSharedSecret = async (): Promise<{
  sharedSecret: Uint8Array;
  dappPublicKey: Uint8Array;
  sessionToken: string;
}> => {
  const session = await loadSession();
  if (
    !isConnected(session) ||
    !session.sharedSecretBs58 ||
    !session.sessionToken
  ) {
    throw new Error('Phantom is not connected');
  }
  return {
    sharedSecret: bs58.decode(session.sharedSecretBs58),
    dappPublicKey: bs58.decode(session.dappPublicKeyBs58),
    sessionToken: session.sessionToken,
  };
};

/**
 * Open Phantom's connect flow. If Phantom has already been connected and
 * the session is still cached, returns the wallet pubkey without opening
 * Phantom again.
 */
export const connect = async (cluster: PhantomCluster): Promise<string> => {
  const session = await loadSession();
  if (isConnected(session) && session.walletPublicKey) {
    return session.walletPublicKey;
  }

  const dappPublicKey = bs58.decode(session.dappPublicKeyBs58);
  const params = await openAndAwait(buildConnectUrl(dappPublicKey, cluster));

  const phantomPublicKeyBs58 = params.phantom_encryption_public_key;
  const data = params.data;
  const nonce = params.nonce;
  if (!phantomPublicKeyBs58 || !data || !nonce) {
    throw new Error('Malformed Phantom connect response');
  }

  const dappSecretKey = bs58.decode(session.dappSecretKeyBs58);
  const sharedSecret = deriveSharedSecret(phantomPublicKeyBs58, dappSecretKey);
  const payload = decryptFromPhantom<{ public_key: string; session: string }>(
    data,
    nonce,
    sharedSecret,
  );

  console.log('[Phantom] connect OK — wallet:', payload.public_key);
  console.log('[Phantom] session token length:', payload.session?.length ?? 0);

  await persistSession({
    ...session,
    phantomPublicKeyBs58,
    sharedSecretBs58: bs58.encode(sharedSecret),
    sessionToken: payload.session,
    walletPublicKey: payload.public_key,
  });

  return payload.public_key;
};

/**
 * Prompt the user to sign a UTF-8 message via Phantom. Returns a
 * base58-encoded ed25519 signature.
 */
export const signMessage = async (message: string): Promise<string> => {
  const { sharedSecret, dappPublicKey, sessionToken } =
    await requireSharedSecret();

  const messageBytes = new TextEncoder().encode(message);
  const messageB58 = bs58.encode(messageBytes);
  console.log(
    '[Phantom] signMessage — len:',
    message.length,
    'bytes:',
    messageBytes.length,
    'session.len:',
    sessionToken.length,
    'sharedSecret.len:',
    sharedSecret.length,
  );

  const { encrypted, nonce } = encryptForPhantom(
    {
      message: messageB58,
      session: sessionToken,
      display: 'utf8',
    },
    sharedSecret,
  );

  const params = await openAndAwait(
    buildSignMessageUrl(dappPublicKey, encrypted, nonce),
  );

  const data = params.data;
  const responseNonce = params.nonce;
  if (!data || !responseNonce) {
    throw new Error('Malformed Phantom signMessage response');
  }

  const payload = decryptFromPhantom<{ signature: string }>(
    data,
    responseNonce,
    sharedSecret,
  );
  return payload.signature;
};

/**
 * Prompt the user to sign a transaction via Phantom. Returns the signed
 * transaction; broadcast is the caller's responsibility.
 */
export const signTransaction = async (
  transaction: Transaction,
): Promise<Transaction> => {
  const { sharedSecret, dappPublicKey, sessionToken } =
    await requireSharedSecret();

  const serialized = transaction.serialize({ requireAllSignatures: false });

  const { encrypted, nonce } = encryptForPhantom(
    {
      transaction: bs58.encode(serialized),
      session: sessionToken,
    },
    sharedSecret,
  );

  const params = await openAndAwait(
    buildSignTransactionUrl(dappPublicKey, encrypted, nonce),
  );

  const data = params.data;
  const responseNonce = params.nonce;
  if (!data || !responseNonce) {
    throw new Error('Malformed Phantom signTransaction response');
  }

  const payload = decryptFromPhantom<{ transaction: string }>(
    data,
    responseNonce,
    sharedSecret,
  );
  return Transaction.from(bs58.decode(payload.transaction));
};

/**
 * Tell Phantom to drop its session and forget the local connection state.
 * The dApp keypair is kept so we don't churn the persistent identity.
 */
export const disconnect = async (): Promise<void> => {
  try {
    const session = await loadSession();
    if (
      isConnected(session) &&
      session.sharedSecretBs58 &&
      session.sessionToken
    ) {
      const sharedSecret = bs58.decode(session.sharedSecretBs58);
      const dappPublicKey = bs58.decode(session.dappPublicKeyBs58);
      const { encrypted, nonce } = encryptForPhantom(
        { session: session.sessionToken },
        sharedSecret,
      );
      // Fire-and-forget. We don't need the result — if Phantom never
      // responds we still want local state cleared.
      Linking.openURL(
        buildDisconnectUrl(dappPublicKey, encrypted, nonce),
      ).catch(() => {});
    }
  } finally {
    clearPending();
    await clearConnection();
  }
};

export const getConnectedWallet = async (): Promise<string | null> => {
  const session = await loadSession();
  return isConnected(session) ? session.walletPublicKey : null;
};
