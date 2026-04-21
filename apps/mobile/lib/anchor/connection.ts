import { Connection, Commitment } from '@solana/web3.js';
import Constants from 'expo-constants';

// Get config from app.config.ts (set based on DEPLOY_ENVIRONMENT)
const extra = Constants.expoConfig?.extra;

// RPC URL configured in app.config.ts based on environment
const RPC_URL = extra?.solanaRpcUrl as string | undefined;

// Supabase publishable (anon) key — required as the `apikey` header by the
// Supabase gateway when calling our rpc-proxy Edge Function.
const SUPABASE_ANON_KEY = extra?.supabasePublishableKey as string | undefined;

// Cluster from app.config.ts (devnet or mainnet-beta)
export type Cluster = 'mainnet-beta' | 'devnet';
export const CLUSTER: Cluster = (extra?.solanaNetwork as Cluster) || 'devnet';

// Fallback to public devnet if no RPC configured
const DEFAULT_RPC_URL = 'https://api.devnet.solana.com';

// Module-level JWT used by the singleton connection. Updated by the auth
// context via setRpcAuthToken() whenever the user signs in / out. Any change
// resets the singleton so subsequent getConnection() calls rebuild with the
// new Authorization header.
let currentAuthToken: string | null = null;

export const setRpcAuthToken = (token: string | null): void => {
  if (token === currentAuthToken) return;
  currentAuthToken = token;
  connectionInstance = null;
};

// Create connection with appropriate RPC
export const createConnection = (
  commitment: Commitment = 'confirmed'
): Connection => {
  const rpcUrl = RPC_URL || DEFAULT_RPC_URL;

  if (__DEV__ && !RPC_URL) {
    console.warn(
      'solanaRpcUrl not configured in app.config.ts, using public devnet RPC.'
    );
  }

  // Only attach auth headers when talking to our own proxy. Public RPCs
  // (the DEFAULT_RPC_URL fallback) don't expect these.
  const httpHeaders: Record<string, string> = {};
  if (RPC_URL && SUPABASE_ANON_KEY) {
    httpHeaders.apikey = SUPABASE_ANON_KEY;
    if (currentAuthToken) {
      httpHeaders.Authorization = `Bearer ${currentAuthToken}`;
    }
  }

  return new Connection(rpcUrl, {
    commitment,
    confirmTransactionInitialTimeout: 60000,
    httpHeaders: Object.keys(httpHeaders).length ? httpHeaders : undefined,
  });
};

// Singleton connection instance
let connectionInstance: Connection | null = null;

export const getConnection = (
  commitment: Commitment = 'confirmed'
): Connection => {
  if (!connectionInstance) {
    connectionInstance = createConnection(commitment);
  }
  return connectionInstance;
};

// Reset connection (useful for testing or switching networks)
export const resetConnection = (): void => {
  connectionInstance = null;
};
