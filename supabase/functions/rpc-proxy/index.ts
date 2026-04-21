// RPC Proxy - forwards JSON-RPC requests to Helius, keeping API key server-side.
// Requires a valid Supabase JWT (verify_jwt = true in config.toml).
// Rate-limits per wallet + applies a global circuit breaker.

/// <reference path="../shims.d.ts" />
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Defaults sized for a paid Helius plan and a Seeker-scale launch (thousands
// of concurrent users). Tuned to catch only runaway loops, compromised
// clients, or coordinated abuse — not legit heavy use.
// Override via Edge Function secrets if needed.
const PER_WALLET_PER_MINUTE = Number(
  Deno.env.get('RPC_PER_WALLET_PER_MINUTE') ?? '300',
);
const PER_WALLET_PER_HOUR = Number(
  Deno.env.get('RPC_PER_WALLET_PER_HOUR') ?? '10000',
);
const GLOBAL_PER_MINUTE = Number(
  Deno.env.get('RPC_GLOBAL_PER_MINUTE') ?? '50000',
);
const GLOBAL_PER_HOUR = Number(
  Deno.env.get('RPC_GLOBAL_PER_HOUR') ?? '1000000',
);

interface JwtPayload {
  sub?: string;
  wallet_address?: string;
  exp?: number;
}

// Decode JWT without verifying — the Supabase gateway already verified it
// because this function is deployed with verify_jwt = true.
function decodeJwt(authHeader: string | null): JwtPayload | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const parts = match[1].split('.');
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    return JSON.parse(atob(padded + pad));
  } catch {
    return null;
  }
}

async function checkLimit(
  supabase: ReturnType<typeof createClient>,
  key: string,
  windowSeconds: 60 | 3600,
  limit: number,
): Promise<{ allowed: boolean; count: number }> {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const { data, error } = await supabase.rpc('increment_rpc_rate_limit', {
    p_key: `${key}:${windowSeconds}s`,
    p_window: window,
    p_limit: limit,
  });

  if (error) {
    // Fail open on DB errors so availability isn't tied to the rate-limit table.
    console.error('rate_limit_rpc_error', { key, windowSeconds, error });
    return { allowed: true, count: 0 };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: row?.allowed ?? true,
    count: row?.current_count ?? 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const heliusApiKey = Deno.env.get('HELIUS_API_KEY');
  if (!heliusApiKey) {
    console.error('HELIUS_API_KEY not configured');
    return jsonResponse({ error: 'RPC proxy not configured' }, 500);
  }

  // Gateway already verified the JWT; we just read the claims.
  const payload = decodeJwt(req.headers.get('authorization'));
  const walletAddress = payload?.wallet_address;
  if (!walletAddress) {
    return jsonResponse({ error: 'Missing wallet claim' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Per-wallet minute + hour limits, then global minute + hour limits.
  // Global limits protect against many-wallet coordinated abuse.
  const walletKey = `wallet:${walletAddress}`;
  const minute = await checkLimit(supabase, walletKey, 60, PER_WALLET_PER_MINUTE);
  if (!minute.allowed) {
    return jsonResponse(
      { error: 'Rate limit exceeded (per-wallet, minute)' },
      429,
    );
  }
  const hour = await checkLimit(supabase, walletKey, 3600, PER_WALLET_PER_HOUR);
  if (!hour.allowed) {
    return jsonResponse(
      { error: 'Rate limit exceeded (per-wallet, hour)' },
      429,
    );
  }
  const globalMinute = await checkLimit(supabase, 'global', 60, GLOBAL_PER_MINUTE);
  if (!globalMinute.allowed) {
    console.warn('global_rate_limit_tripped', { window: 'minute', count: globalMinute.count });
    return jsonResponse({ error: 'Service busy, try again shortly' }, 503);
  }
  const globalHour = await checkLimit(supabase, 'global', 3600, GLOBAL_PER_HOUR);
  if (!globalHour.allowed) {
    console.warn('global_rate_limit_tripped', { window: 'hour', count: globalHour.count });
    return jsonResponse({ error: 'Service busy, try again later' }, 503);
  }

  const solanaNetwork = Deno.env.get('SOLANA_NETWORK') || 'mainnet';
  const heliusHost =
    solanaNetwork === 'devnet'
      ? 'devnet.helius-rpc.com'
      : 'mainnet.helius-rpc.com';
  const heliusUrl = `https://${heliusHost}/?api-key=${heliusApiKey}`;

  try {
    const body = await req.text();
    const resp = await fetch(heliusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await resp.text();
    return new Response(data, {
      status: resp.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('RPC proxy error:', error);
    return jsonResponse(
      { jsonrpc: '2.0', error: { code: -32603, message: 'Internal proxy error' }, id: null },
      502,
    );
  }
});
