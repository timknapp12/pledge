// Issue a single-use SIWS nonce bound to a wallet, with 5-minute TTL.
// Client calls this BEFORE generating the SIWS message to sign.
//
// Pairs with verify-wallet, which atomically claims the nonce after
// signature verification.

/// <reference path="../shims.d.ts" />
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const NONCE_TTL_SECONDS = 5 * 60;

const errorResponse = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Solana base58 pubkey: 32 bytes → 43-44 base58 chars. Reject anything else
// before we touch the DB.
const SOLANA_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  let body: { walletAddress?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'Invalid JSON body');
  }

  const walletAddress = body.walletAddress;
  if (typeof walletAddress !== 'string' || !SOLANA_PUBKEY_RE.test(walletAddress)) {
    return errorResponse(400, 'Invalid walletAddress');
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const nonce = generateNonce();
  const expiresAt = new Date(Date.now() + NONCE_TTL_SECONDS * 1000);

  const { error } = await supabase.from('siws_nonces').insert({
    nonce,
    wallet_address: walletAddress,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error('issue-siws-nonce insert failed', error);
    return errorResponse(500, 'Failed to issue nonce');
  }

  return new Response(
    JSON.stringify({ nonce, expiresAt: expiresAt.toISOString() }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
});
