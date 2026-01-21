// Verify wallet signature and issue JWT for Supabase auth
// This function verifies Sign in with Solana (SIWS) messages

/// <reference path="../shims.d.ts" />

import { serve } from 'std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as ed from 'https://esm.sh/@noble/ed25519@2';
import { decode as decodeBase58 } from 'https://esm.sh/bs58@5';
import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, signature, publicKey } = await req.json();

    if (!message || !signature || !publicKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the signature
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = decodeBase58(signature);
    const publicKeyBytes = decodeBase58(publicKey);

    const isValid = await ed.verifyAsync(signatureBytes, messageBytes, publicKeyBytes);

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Upsert user (create if not exists)
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({ wallet_address: publicKey }, { onConflict: 'wallet_address' })
      .select()
      .single();

    if (userError) {
      console.error('Error upserting user:', userError);
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create custom JWT
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new jose.SignJWT({
      sub: publicKey,
      role: 'authenticated',
      user_id: user.id,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

    return new Response(
      JSON.stringify({ token, user }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
