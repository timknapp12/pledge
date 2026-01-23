// Supabase client for React Native
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

const AUTH_TOKEN_KEY = 'pledge_auth_token';

// Storage adapter using expo-secure-store
const secureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('SecureStore setItem error:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('SecureStore removeItem error:', error);
    }
  },
};

// Create a basic Supabase client (used before authentication)
export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Create an authenticated Supabase client with a custom JWT
export function createAuthenticatedClient(jwt: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });
}

// Store auth token securely
export async function storeAuthToken(token: string): Promise<void> {
  await secureStoreAdapter.setItem(AUTH_TOKEN_KEY, token);
}

// Get stored auth token
export async function getStoredAuthToken(): Promise<string | null> {
  return await secureStoreAdapter.getItem(AUTH_TOKEN_KEY);
}

// Remove auth token
export async function removeAuthToken(): Promise<void> {
  await secureStoreAdapter.removeItem(AUTH_TOKEN_KEY);
}

// Get the Edge Function URL for verify-wallet
export function getVerifyWalletUrl(): string {
  return `${SUPABASE_URL}/functions/v1/verify-wallet`;
}
