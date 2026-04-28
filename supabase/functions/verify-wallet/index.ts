// Verify wallet signature and issue JWT for Supabase auth
// This function verifies Sign in with Solana (SIWS) messages

/// <reference path="../shims.d.ts" />
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import bs58 from 'bs58';
import * as jose from 'jose';

// Configure ed25519 to use the sha512 hash function
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const SIWS_DOMAIN = 'pledge.app';
const SIWS_MAX_AGE_MS = 5 * 60 * 1000;

const errorResponse = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, signature, publicKey } = await req.json();

    if (!message || !signature || !publicKey) {
      return errorResponse(400, 'Missing required fields');
    }

    // Validate message contents BEFORE checking signature.
    // Prevents replay of signatures captured from other dApps / phishing pages.
    const msgText = typeof message === 'string' ? message : '';

    if (!msgText.startsWith(`${SIWS_DOMAIN} wants you to sign in`)) {
      return errorResponse(401, 'Invalid message domain');
    }

    if (!msgText.includes(publicKey)) {
      return errorResponse(401, 'Wallet mismatch');
    }

    const issuedAtMatch = msgText.match(/^Issued At: (.+)$/m);
    if (!issuedAtMatch) {
      return errorResponse(401, 'Missing timestamp');
    }
    const issuedAt = new Date(issuedAtMatch[1]).getTime();
    if (
      Number.isNaN(issuedAt) ||
      Math.abs(Date.now() - issuedAt) > SIWS_MAX_AGE_MS
    ) {
      return errorResponse(401, 'Stale or invalid timestamp');
    }

    // Verify the signature
    const messageBytes = new TextEncoder().encode(msgText);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(publicKey);

    const isValid = ed.verify(signatureBytes, messageBytes, publicKeyBytes);
    if (!isValid) {
      return errorResponse(401, 'Invalid signature');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const jwtSecret = Deno.env.get('JWT_SECRET')!;

    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      return errorResponse(500, 'Server configuration error');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Upsert user (create if not exists)
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({ wallet_address: publicKey }, { onConflict: 'wallet_address' })
      .select()
      .single();

    if (userError) {
      console.error('Error upserting user:', userError);
      return errorResponse(500, 'Failed to create user');
    }

    // Create custom JWT with Supabase-compatible claims
    // NOTE: sub must be a UUID for auth.uid() to work
    // wallet_address is stored as a custom claim for RLS policies
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new jose.SignJWT({
      sub: user.id,
      role: 'authenticated',
      wallet_address: publicKey,
      aud: 'authenticated',
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer('supabase')
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    return new Response(JSON.stringify({ token, user }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse(500, 'Internal server error');
  }
});
