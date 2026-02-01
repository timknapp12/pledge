what we did on dev and need to do in prod:

supabase:

- added sql tables (also did first migration on prod) ✅
- added jwt secret to edge functions (also did on prod) ✅
- ran sql migration 2 for both dev and prod ✅
- added more vars in supabase/env that need to be added as secrets to both dev/prod supabase
- deploy edge function to both dev and prod ✅
- set up env vars for front end, need to set up in expo for preview/prod
- create and add CRANK_KEYPAIR to supabase/env ✅ (devnet admin: 6F1zqkPXyeJ64e4T4fpREhzgnLW3vwsdstrGqQ8BaVFz)
- add CRANK_KEYPAIR to supabase dev and prod secrets - load with some funds

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
