# Verified Build + security.txt Runbook

One-shot recipe for uploading the **Security** tab and **Verified Build** badge to Solana Explorer. Both require signing by the program's upgrade authority, so we do them together in a single authority-rotation window.

**Do this once, when the program is stable (ideally right before launch).** Every subsequent program redeploy invalidates the verified build and requires re-running steps 6–8.

---

## Context

- **Program ID:** `PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp`
- **Upgrade authority (as of 2026-04-20):** `C8c6giSNnQHt7sK7YQi5jw3VrUiY5spriyHc9wFRWJia` (Ledger, via Phantom)
- **Repo:** `https://github.com/timknapp12/pledge` (must be **public** on GitHub)
- **Program workspace:** `packages/anchor`, library name `pledge`
- **Metadata files:**
  - `packages/anchor/security.json` — keep `source_revision` and `source_release` in sync with the commit you're verifying

---

## Why authority rotation

The current `solana-verify` tool (v0.4+) requires on-chain PDA upload signed by the upgrade authority before OtterSec will accept a remote verification job. Phantom/Ledger can't sign via the CLI, so we temporarily rotate upgrade authority to a local hot keypair, do all the work, then rotate back.

Tested and confirmed: the previously-available `--remote` flag that bypassed this is now deprecated.

---

## Prerequisites

- [ ] Docker Desktop running
- [ ] `cargo install solana-verify` (tested with v0.4.15)
- [ ] Main wallet has ~0.3 SOL on mainnet to fund the temp keypair and cover fees
- [ ] Commit you want to verify is pushed to `origin/main`
- [ ] `packages/anchor/security.json` has the **exact commit hash** you're verifying in `source_revision`
- [ ] No Rust program changes pending — the code at that commit is what goes on-chain

---

## Steps

### 1. Freeze + push the commit

```bash
git checkout main
git pull
COMMIT=$(git rev-parse HEAD)
echo "Verifying commit: $COMMIT"
```

Update `packages/anchor/security.json` → `source_revision` to `$COMMIT`, commit, push.

### 2. Create + persist the temp keypair

**Save to a real path, not `/tmp` or browser memory.** Last time a browser-held keypair was lost on refresh, $200 SOL with it.

```bash
TEMP_KEYPAIR=~/.config/solana/pledge-temp-authority-$(date +%Y-%m-%d).json
solana-keygen new --no-bip39-passphrase -o "$TEMP_KEYPAIR"
TEMP_PUBKEY=$(solana-keygen pubkey "$TEMP_KEYPAIR")
echo "Temp authority: $TEMP_PUBKEY"
echo "Keypair file:   $TEMP_KEYPAIR"
```

Keep this file until step 10 confirms funds are drained. **Back it up somewhere safe in case of interrupted flow.**

### 3. Fund the temp keypair

From your main wallet (or any funded wallet) on mainnet, send ~0.2 SOL to `$TEMP_PUBKEY`. Verify:

```bash
solana balance "$TEMP_PUBKEY" -u mainnet-beta
```

### 4. Transfer upgrade authority → temp keypair

Open `apps/web/deploy.html` locally (`open apps/web/deploy.html`), connect Phantom (which should be connected to Ledger), and use the **SetAuthority** function to set the program's upgrade authority to `$TEMP_PUBKEY`. Confirm on Explorer:

```bash
solana program show PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp -u mainnet-beta
# Authority should now be $TEMP_PUBKEY
```

### 5. Deterministic build

```bash
cd packages/anchor
solana-verify build --library-name pledge
```

This builds inside Docker (~3–5 min). Output: `target/deploy/pledge.so` with a reproducible hash.

### 6. Redeploy the deterministic `.so`

The current on-chain binary was built with `anchor build` and its hash won't match the Docker build. Redeploy so the verifier sees matching bytecode:

```bash
solana program deploy \
  -u mainnet-beta \
  --keypair "$TEMP_KEYPAIR" \
  --program-id PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp \
  --with-compute-unit-price 50000 \
  --use-rpc \
  target/deploy/pledge.so
```

If the deploy stalls or fails, see the "Recovering a stuck buffer" section at the bottom.

### 7. Upload the verification PDA on-chain

```bash
solana-verify verify-from-repo \
  -u mainnet-beta \
  --keypair "$TEMP_KEYPAIR" \
  --program-id PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp \
  --library-name pledge \
  --mount-path packages/anchor \
  --commit-hash "$COMMIT" \
  https://github.com/timknapp12/pledge
```

Answer **YES** when prompted to upload verification data on-chain.

### 8. Submit the remote OtterSec job

```bash
solana-verify remote submit-job \
  --program-id PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp \
  --uploader "$TEMP_PUBKEY"
```

This queues OtterSec to rebuild from the public repo and compare hashes. Takes ~10–20 min. Monitor:

```bash
solana-verify remote list-job --program-id PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp
```

### 9. Write security.txt metadata

```bash
cd packages/anchor
npx @solana-program/program-metadata@latest write security \
  PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp \
  ./security.json \
  --keypair "$TEMP_KEYPAIR" \
  --rpc https://api.mainnet-beta.solana.com
```

### 10. Transfer upgrade authority back → Ledger

Back in `apps/web/deploy.html`, connect with the **temp keypair** this time (you'll need to import `$TEMP_KEYPAIR` into Phantom temporarily, or write a small signed-tx flow). SetAuthority back to `C8c6giSNnQHt7sK7YQi5jw3VrUiY5spriyHc9wFRWJia`.

Alternative — do it from the CLI while the temp keypair is still authority:

```bash
solana program set-upgrade-authority \
  -u mainnet-beta \
  --keypair "$TEMP_KEYPAIR" \
  --new-upgrade-authority C8c6giSNnQHt7sK7YQi5jw3VrUiY5spriyHc9wFRWJia \
  --skip-new-upgrade-authority-signer-check \
  PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp
```

Verify:

```bash
solana program show PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp -u mainnet-beta
# Authority must be C8c6giSNnQHt7sK7YQi5jw3VrUiY5spriyHc9wFRWJia
```

### 11. Drain + archive the temp keypair

```bash
# Send remaining SOL back to your main wallet
solana transfer <your-main-wallet-pubkey> ALL \
  -u mainnet-beta \
  --keypair "$TEMP_KEYPAIR" \
  --allow-unfunded-recipient

# Confirm empty
solana balance "$TEMP_KEYPAIR" -u mainnet-beta
```

Don't delete the keypair file until the balance is confirmed 0 and the authority-transfer tx is confirmed on Explorer. After that, you can either archive it (move to `~/archive/`) or `shred && rm`.

### 12. Verify on Explorer

Visit https://explorer.solana.com/address/PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp

- **Security tab** — should show contacts, policy, source link (appears within a few minutes)
- **Verified Build tab** — green badge appears after OtterSec finishes (up to ~20 min after step 8)

---

## Recovering a stuck buffer

If `solana program deploy` fails midway, it leaves behind a buffer account holding ~2.5 SOL of rent. `apps/web/deploy.html` has a "Scan for Buffers" / "Close Buffer" utility — use it with the temp keypair authority to reclaim the SOL before transferring authority back.

---

## For future redeploys

After the initial setup, each program redeploy requires repeating **steps 1, 4, 5, 6, 7, 8, 10, 11** (skip security.txt unless fields changed). That's still ~20 min of authority-rotation overhead per deploy. Options to reduce it:

- Move upgrade authority to a Squads multisig once live; sign verify PDA from Squads (no rotation needed).
- Keep upgrade authority on a hot keypair permanently in CI (simpler, but larger blast radius if CI is compromised).

---

## References

- [Solana Verified Builds docs](https://solana.com/docs/programs/verified-builds)
- [`@solana-program/program-metadata`](https://github.com/solana-program/program-metadata)
- `apps/web/deploy.html` — local Phantom+Ledger deploy + authority tool
