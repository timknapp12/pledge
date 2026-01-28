what we did on dev and need to do in prod:

supabase:

- added sql tables (also did first migration on prod) ✅
- added jwt secret to edge functions (also did on prod) ✅
- added more vars in supabase/env that need to be added as secrets to both dev/prod supabase
- deploy edge function
- set up env vars for front end, need to set up in expo for preview/prod
- create and add CRANK_KEYPAIR to supabase/env and add to supabase dev and prod secrets - load with some funds

firebase:

- set up google services for both dev and prod
