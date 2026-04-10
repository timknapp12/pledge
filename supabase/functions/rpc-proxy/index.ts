// RPC Proxy - forwards JSON-RPC requests to Helius, keeping API key server-side
// Deployed with --no-verify-jwt since RPC calls don't require user auth

/// <reference path="../shims.d.ts" />
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const heliusApiKey = Deno.env.get('HELIUS_API_KEY');
  const solanaNetwork = Deno.env.get('SOLANA_NETWORK') || 'mainnet';

  if (!heliusApiKey) {
    console.error('HELIUS_API_KEY not configured');
    return new Response(
      JSON.stringify({ error: 'RPC proxy not configured' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

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
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal proxy error' },
        id: null,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
