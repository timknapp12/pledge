/* eslint-disable @typescript-eslint/no-require-imports */
// Authentication context using Sign in with Solana (SIWS) and Mobile Wallet Adapter
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { SupabaseClient } from '@supabase/supabase-js';
import { PublicKey } from '@solana/web3.js';
import type { Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { toUint8Array } from 'js-base64';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import * as Localization from 'expo-localization';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import {
  createAuthenticatedClient,
  getStoredAuthToken,
  storeAuthToken,
  removeAuthToken,
  getVerifyWalletUrl,
  supabaseAnon,
} from '../lib/supabase';
import { setRpcAuthToken } from '../lib/anchor/connection';
import { queryKeys } from '@/hooks/queryKeys';
import { isUserCancellation, getWalletErrorMessage } from '../lib/errors';
import * as phantom from '../lib/phantom';

// Read cluster from app.config.ts (set based on DEPLOY_ENVIRONMENT)
type SolanaCluster = 'devnet' | 'testnet' | 'mainnet-beta';
const VALID_CLUSTERS: SolanaCluster[] = ['devnet', 'testnet', 'mainnet-beta'];
const rawCluster = Constants.expoConfig?.extra?.solanaNetwork as
  | string
  | undefined;
if (!rawCluster || !VALID_CLUSTERS.includes(rawCluster as SolanaCluster)) {
  throw new Error(
    `Invalid or missing solanaNetwork in app.config.ts extra: "${rawCluster}". ` +
      'Must be one of: devnet, testnet, mainnet-beta.',
  );
}
const solanaCluster = rawCluster as SolanaCluster;

// App identity for MWA
const APP_IDENTITY = {
  name: 'Pledge',
  uri: 'https://pledge.app',
  icon: 'favicon.ico',
};

// MWA is an Android-only native module. Lazy-require it behind a Platform
// guard so the iOS bundle never touches it at load time. iOS auth will go
// through the Phantom deep-link flow (added separately).
type TransactFn =
  typeof import('@solana-mobile/mobile-wallet-adapter-protocol-web3js').transact;

let transact: TransactFn | null = null;
if (Platform.OS === 'android') {
  try {
    transact =
      require('@solana-mobile/mobile-wallet-adapter-protocol-web3js').transact;
  } catch (error) {
    console.error('[MWA] Failed to load mobile-wallet-adapter:', error);
  }
}

interface User {
  id: string;
  wallet_address: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  walletAddress: string | null;
  supabase: SupabaseClient;
  isLoading: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Generate SIWS message
function createSiwsMessage(walletAddress: string, nonce: string): string {
  const domain = 'pledge.app';
  const statement = 'Sign in to Pledge with your Solana wallet.';
  const issuedAt = new Date().toISOString();

  return `${domain} wants you to sign in with your Solana account:
${walletAddress}

${statement}

Nonce: ${nonce}
Issued At: ${issuedAt}`;
}

// Generate a random nonce
function generateNonce(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  // Convert to hex string for simplicity
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert signature Uint8Array to base58 string
function uint8ArrayToBase58(uint8Array: Uint8Array): string {
  return bs58.encode(uint8Array);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient>(supabaseAnon);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store user timezone and initial language in Supabase
  const storeTimezoneAndLanguage = useCallback(
    async (client: SupabaseClient, userId: string) => {
      try {
        const tz =
          Localization.getCalendars()[0]?.timeZone ?? 'America/New_York';

        // Detect device language
        const deviceLang = Localization.getLocales()[0]?.languageCode ?? 'en';

        // Check if user already has a language set (don't overwrite manual choice)
        const { data: userData } = await client
          .from('users')
          .select('language')
          .eq('id', userId)
          .single();

        const updatePayload: Record<string, string> = { timezone: tz };

        // Only set language if not already set (null means first login)
        if (!userData?.language) {
          updatePayload.language = deviceLang;
        }

        await client.from('users').update(updatePayload).eq('id', userId);
      } catch (err) {
        console.error('Failed to store timezone/language:', err);
      }
    },
    [],
  );

  // Prefetch pledges data after authentication
  const prefetchPledges = useCallback(
    async (client: SupabaseClient, wallet: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.pledges(wallet),
        queryFn: async () => {
          const { data, error } = await client
            .from('pledges')
            .select('*')
            .order('created_at', { ascending: false });
          if (error) throw error;
          return data ?? [];
        },
      });
    },
    [queryClient],
  );

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const token = await getStoredAuthToken();
        if (token) {
          // Decode token to get wallet address (without verifying - server will verify)
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expiresAt = payload.exp * 1000;

          if (Date.now() < expiresAt) {
            // Token still valid
            const authenticatedClient = createAuthenticatedClient(token);
            setSupabase(authenticatedClient);
            setRpcAuthToken(token);
            setWalletAddress(payload.wallet_address);
            setUser({
              id: payload.sub,
              wallet_address: payload.wallet_address,
            });
            // Prefetch pledges data and sync timezone
            prefetchPledges(authenticatedClient, payload.sub);
            storeTimezoneAndLanguage(authenticatedClient, payload.sub);
          } else {
            // Token expired, clear it
            await removeAuthToken();
          }
        }
      } catch (err) {
        console.error('Error checking existing session:', err);
        await removeAuthToken();
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingSession();
  }, [prefetchPledges, storeTimezoneAndLanguage]);

  // Exchange a verified SIWS (message, signature, pubkey) for a Supabase
  // JWT and wire up the authenticated client. Shared by the iOS (Phantom)
  // and Android (MWA) paths.
  const exchangeAndFinalize = useCallback(
    async (
      message: string,
      signatureBase58: string,
      walletAddr: string,
    ): Promise<void> => {
      const response = await fetch(getVerifyWalletUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          signature: signatureBase58,
          publicKey: walletAddr,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          'Edge function error response:',
          response.status,
          errorText,
        );
        let errorMessage = 'Wallet verification failed';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const { token, user: userData } = await response.json();

      await storeAuthToken(token);
      const authenticatedClient = createAuthenticatedClient(token);

      setSupabase(authenticatedClient);
      setRpcAuthToken(token);
      setWalletAddress(walletAddr);
      setUser(userData);
      prefetchPledges(authenticatedClient, walletAddr);
      storeTimezoneAndLanguage(authenticatedClient, userData.id);
    },
    [prefetchPledges, storeTimezoneAndLanguage],
  );

  const connectIos = useCallback(async (): Promise<void> => {
    // Phantom handshake (no-op if already connected from a prior session)
    const walletAddr = await phantom.connect(
      solanaCluster === 'mainnet-beta' ? 'mainnet-beta' : 'devnet',
    );

    const nonce = generateNonce();
    const message = createSiwsMessage(walletAddr, nonce);
    const signatureBase58 = await phantom.signMessage(message);

    // Local sanity check before burning the Edge Function request
    const publicKeyBytes = bs58.decode(walletAddr);
    const signatureBytes = bs58.decode(signatureBase58);
    const messageBytes = new TextEncoder().encode(message);
    const isValidLocally = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes,
    );
    if (!isValidLocally) {
      throw new Error('Local signature verification failed');
    }

    await exchangeAndFinalize(message, signatureBase58, walletAddr);
  }, [exchangeAndFinalize]);

  const connectAndroid = useCallback(async (): Promise<void> => {
    if (!transact) {
      throw new Error('Mobile Wallet Adapter failed to load');
    }
    await transact(async (wallet: Web3MobileWallet) => {
      const authResult = await wallet.authorize({
        cluster: solanaCluster,
        identity: APP_IDENTITY,
      });

      const base64Address = authResult.accounts[0].address;
      const publicKeyBytes = toUint8Array(base64Address);
      const publicKey = new PublicKey(publicKeyBytes);
      const walletAddr = publicKey.toBase58();

      const nonce = generateNonce();
      const message = createSiwsMessage(walletAddr, nonce);
      const messageBytes = new TextEncoder().encode(message);

      const signedMessages = await wallet.signMessages({
        addresses: [base64Address],
        payloads: [messageBytes],
      });

      const signatureBytes = signedMessages[0];
      const signatureBase58 = uint8ArrayToBase58(signatureBytes);

      const isValidLocally = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes,
      );
      if (!isValidLocally) {
        throw new Error('Local signature verification failed');
      }

      await exchangeAndFinalize(message, signatureBase58, walletAddr);
    });
  }, [exchangeAndFinalize]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (Platform.OS === 'ios') {
        await connectIos();
      } else {
        await connectAndroid();
      }
    } catch (err: any) {
      if (isUserCancellation(err)) {
        return;
      }
      console.error('Connection error:', err);
      const friendlyMessage = getWalletErrorMessage(err);
      setError(friendlyMessage);
    } finally {
      setIsConnecting(false);
    }
  }, [connectIos, connectAndroid]);

  const disconnect = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        // Clear Phantom's cached shared secret / session token so the next
        // `connect` re-handshakes cleanly. Fire-and-forget; don't block
        // logout on the deep-link round trip.
        phantom.disconnect().catch(() => {});
      }
      await removeAuthToken();
      setRpcAuthToken(null);
      setUser(null);
      setWalletAddress(null);
      setSupabase(supabaseAnon);
      setError(null);
    } catch (err: any) {
      console.error('Disconnect error:', err);
      setError(err.message || 'Failed to disconnect');
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        walletAddress,
        supabase,
        isLoading,
        isConnecting,
        error,
        connect,
        disconnect,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
