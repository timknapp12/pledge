what we did on dev and need to do in prod:

supabase:

- added sql tables (also did first migration on prod) ✅
- added jwt secret to edge functions (also did on prod) ✅
- ran sql migration 2 for both dev and prod ✅
- added more vars in supabase/env that need to be added as secrets to both dev/prod supabase
- deploy edge function to both dev and prod ✅
- set up env vars for front end, need to set up in expo for preview/prod ✅
- // TODO set up service key from firebase prod and add to expo
- create and add CRANK_KEYPAIR to supabase/env ✅ (devnet admin: 6F1zqkPXyeJ64e4T4fpREhzgnLW3vwsdstrGqQ8BaVFz)
- add CRANK_KEYPAIR to supabase dev and prod secrets - load with some funds
- run script in prod to create ATAs for treasury and charity pubkeys. there is a script in scripts folder
- this is done on dev - deploy crank to check for forfeited pledges - look at docs/crank.md, get prod project id and set secrets after deploying crank

firebase:

- set up google services for both dev and prod

solana program:

- devnet initialized ✅ (admin: 6F1zqkPXyeJ64e4T4fpREhzgnLW3vwsdstrGqQ8BaVFz) found in ~/.config/solana/pledge-admin-devnet.json
- For mainnet:

  1. Generate a separate keypair: `solana-keygen new -o ~/.config/solana/pledge-admin-mainnet.json`
  2. Fund it with real SOL
  3. Run: `npx ts-node scripts/initialize-program.ts --network mainnet`
  4. pass a treasury wallet address
  5. pass a charity wallet address

  setting vars for supabase through the cli:
  Here's what each Edge Function needs:  
  ┌───────────────────────────┬───────────────────┬───────────────┐
  │ Secret │ Auto-injected? │ Used by │  
  ├───────────────────────────┼───────────────────┼───────────────┤
  │ SUPABASE_URL │ Yes │ all three │  
  ├───────────────────────────┼───────────────────┼───────────────┤  
  │ SUPABASE_SERVICE_ROLE_KEY │ Yes │ all three │
  ├───────────────────────────┼───────────────────┼───────────────┤
  │ JWT_SECRET │ No — set manually │ verify-wallet │
  ├───────────────────────────┼───────────────────┼───────────────┤
  │ HELIUS_API_KEY │ No — set manually │ process-crank │
  ├───────────────────────────┼───────────────────┼───────────────┤
  │ SOLANA_NETWORK │ No — set manually │ process-crank │
  ├───────────────────────────┼───────────────────┼───────────────┤
  │ CRANK_KEYPAIR │ No — set manually │ process-crank │
  └───────────────────────────┴───────────────────┴───────────────┘
  send-notification is fully covered by auto-injected vars. But if you
  haven't already set the others for dev, you need to:

  supabase secrets set JWT_SECRET="Edn0PlygtTgQ+2bbYTLJtdLVBCmX6DUlv4qFti
  rmXJS8fnpOARQDTq3VIvtlLdcl+9xU8N+CjQ4E9Jpg/B+/JA==" --project-ref
  ejgcfgjkwlkblwrqtqbr
  supabase secrets set
  HELIUS_API_KEY="323febce-e3ff-45c0-b23f-38156b46928d" --project-ref
  ejgcfgjkwlkblwrqtqbr
  supabase secrets set SOLANA_NETWORK="devnet" --project-ref
  ejgcfgjkwlkblwrqtqbr
  supabase secrets set CRANK_KEYPAIR="HG3G7DnTkgPZbkSDDeZj7RCuFVz8LgJZau4
  wiF7JUVCMvRvYcLpc9m7egGMZDF4DRrMKppC744VfsxuNxGUCAc4" --project-ref
  ejgcfgjkwlkblwrqtqbr

  PROGRAM_ID and ADMIN_PUBKEY aren't used by any Edge Function currently,
  so they can wait.
