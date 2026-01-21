// Crank service - processes expired pledges
// Runs periodically via pg_cron to handle pledges past deadline + grace period

/// <reference path="../shims.d.ts" />

import { serve } from 'std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  Connection,
  Keypair,
  PublicKey,
} from 'https://esm.sh/@solana/web3.js@1';
import { Program, AnchorProvider } from 'https://esm.sh/@coral-xyz/anchor@0.28.0';

const GRACE_PERIOD_SECONDS = 24 * 60 * 60; // 1 day

serve(async (req) => {
  try {
    // Only allow POST requests (from pg_cron)
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Solana connection
    const rpcUrl = Deno.env.get('HELIUS_RPC_URL')!;
    const connection = new Connection(rpcUrl);

    // Load crank keypair
    const crankKeypairBase58 = Deno.env.get('CRANK_KEYPAIR')!;
    // TODO: Decode base58 and create Keypair

    // Get current time
    const now = Math.floor(Date.now() / 1000);
    const cutoffTime = new Date((now - GRACE_PERIOD_SECONDS) * 1000).toISOString();

    // Query for expired pledges (past deadline + grace period, still Active)
    const { data: expiredPledges, error } = await supabase
      .from('pledges')
      .select('*, daily_progress(*)')
      .eq('status', 'Active')
      .lt('deadline', cutoffTime);

    if (error) {
      console.error('Error fetching expired pledges:', error);
      return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
    }

    console.log(`Processing ${expiredPledges?.length || 0} expired pledges`);

    const results = [];

    for (const pledge of expiredPledges || []) {
      try {
        // TODO: Fetch on-chain state to verify status
        // const onChainPledge = await program.account.pledge.fetch(pledge.on_chain_address);
        // if (onChainPledge.status !== 'Active') continue;

        // Calculate completion percentage from checked items
        const completionPercentage = calculateCompletionPercentage(pledge);

        // TODO: Call appropriate on-chain instruction based on completion
        if (completionPercentage === 100) {
          // 100% completion - full refund, NO FEE
          // await program.methods.processCompletion(100).accounts({...}).rpc();
          console.log(`Pledge ${pledge.id}: 100% completion - full refund`);
        } else if (completionPercentage > 0) {
          // Partial completion - proportional refund MINUS FEE
          // await program.methods.processCompletion(completionPercentage).accounts({...}).rpc();
          console.log(`Pledge ${pledge.id}: ${completionPercentage}% completion - partial refund`);
        } else {
          // 0% completion - full forfeiture
          // await program.methods.processExpiredPledge().accounts({...}).rpc();
          console.log(`Pledge ${pledge.id}: 0% completion - forfeiture`);
        }

        results.push({ pledgeId: pledge.id, completionPercentage, success: true });
      } catch (pledgeError) {
        console.error(`Error processing pledge ${pledge.id}:`, pledgeError);
        results.push({ pledgeId: pledge.id, success: false, error: String(pledgeError) });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Crank error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
});

function calculateCompletionPercentage(pledge: any): number {
  const todos = pledge.todos || [];
  if (todos.length === 0) return 0;

  const dailyProgress = pledge.daily_progress || [];

  // Count total expected completions and actual completions
  // This is a simplified version - real implementation needs to account for
  // day-specific todos and the actual days in the pledge timeframe

  let totalExpected = 0;
  let totalCompleted = 0;

  // For now, just count unique completed todo indices across all days
  const completedSet = new Set<number>();
  for (const day of dailyProgress) {
    for (const idx of day.todos_completed || []) {
      completedSet.add(idx);
    }
  }

  totalExpected = todos.length;
  totalCompleted = completedSet.size;

  if (totalExpected === 0) return 0;
  return Math.round((totalCompleted / totalExpected) * 100);
}
