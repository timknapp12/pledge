#!/usr/bin/env bash
# Mainnet verified-build deploy for the Pledge anchor program.
# Runs steps 5–9 of docs/verified-build-runbook.md (build → deploy → verify → security.txt).
#
# Top priority: never strand SOL.
#   - Refuses temp keypairs in /tmp (macOS daily cleanup deletes them).
#   - Refuses to start if the temp keypair already has orphaned buffers (recover first).
#   - On deploy failure or Ctrl+C, automatically closes any leaked buffer and
#     returns rent (~3 SOL each) to the temp keypair pubkey.
#
# Manual steps you must do BEFORE running this:
#   1. git: freeze + push the commit you want verified (runbook §1)
#   2. update packages/anchor/security.json source_revision if needed
#   3. solana-keygen new -o ~/.config/solana/pledge-temp-authority-$(date +%Y-%m-%d).json   (NOT /tmp)
#   4. fund that pubkey with ~3.5 SOL on mainnet
#   5. via apps/web/deploy.html (Phantom→Ledger only signs, no keypair entered):
#      SetAuthority on $PROGRAM_ID → temp keypair pubkey
#
# After this script finishes (rotation + drain are CLI-only — never import the
# temp keypair into a browser tool; browser-held keys can vanish on refresh):
#   - solana program set-upgrade-authority --keypair $TEMP_KEYPAIR ... → Ledger
#   - solana transfer ALL --keypair $TEMP_KEYPAIR → your main wallet
#   - confirm Verified Build + Security badges on Explorer
#
# Usage:
#   TEMP_KEYPAIR=~/.config/solana/pledge-temp-authority-2026-04-28.json \
#     ./scripts/deploy-mainnet-verified.sh

set -euo pipefail

# === Config ===
PROGRAM_ID="PLDG12YsnCxRHa9CkWDnzkA9vsbEFpThXHR9zgnDTDp"
LEDGER_AUTHORITY="C8c6giSNnQHt7sK7YQi5jw3VrUiY5spriyHc9wFRWJia"
LIBRARY_NAME="pledge"
MOUNT_PATH="packages/anchor"
REPO_URL="https://github.com/timknapp12/pledge"
RPC_URL="${RPC_URL:-https://api.mainnet-beta.solana.com}"
COMPUTE_UNIT_PRICE="${COMPUTE_UNIT_PRICE:-200000}"
MAX_SIGN_ATTEMPTS="${MAX_SIGN_ATTEMPTS:-100}"
MIN_SOL=3.5

# === Inputs ===
TEMP_KEYPAIR="${TEMP_KEYPAIR:-}"
COMMIT="${COMMIT:-$(git -C "$(dirname "$0")/.." rev-parse HEAD)}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANCHOR_DIR="$REPO_ROOT/$MOUNT_PATH"
STATE_FILE="$HOME/.config/solana/pledge-deploy-state.json"

bold()  { printf "\n\033[1m== %s ==\033[0m\n" "$1"; }
info()  { printf "  %s\n" "$1"; }
warn()  { printf "  \033[33mWARN:\033[0m %s\n" "$1"; }
fail()  { printf "\n\033[31mERROR:\033[0m %s\n" "$1" >&2; exit 1; }

# Persist enough state to recover SOL even if the terminal dies, the script
# crashes, or the user loses track of which temp keypair was used.
write_state_file() {
  mkdir -p "$(dirname "$STATE_FILE")"
  cat > "$STATE_FILE" <<JSON
{
  "timestamp_utc":      "$(date -u +%FT%TZ)",
  "program_id":         "$PROGRAM_ID",
  "rpc":                "$RPC_URL",
  "temp_keypair_path":  "$TEMP_KEYPAIR",
  "temp_pubkey":        "$TEMP_PUBKEY",
  "ledger_authority":   "$LEDGER_AUTHORITY",
  "commit":             "$COMMIT",
  "recovery_command":   "solana program close --buffers --keypair '$TEMP_KEYPAIR' --recipient $TEMP_PUBKEY --bypass-warning -u $RPC_URL"
}
JSON
  chmod 600 "$STATE_FILE"
}

# Big visible banner — printed before deploy and on any failure.
# All commands here are CLI-only; never put the temp keypair in a browser tool.
print_recovery_banner() {
  cat <<BANNER

\033[1;33m┌─────────────────────────────────────────────────────────────────────┐
│ RECOVERY INSTRUCTIONS — keep handy, written to disk too             │
└─────────────────────────────────────────────────────────────────────┘\033[0m

  Temp keypair file:    $TEMP_KEYPAIR
  Temp keypair pubkey:  $TEMP_PUBKEY
  Program:              $PROGRAM_ID
  State file:           $STATE_FILE

  If anything fails (network drop, Docker crash, Ctrl+C, terminal close),
  recover stranded buffer SOL by running ONE of these:

    A) Use the helper script (reads state file, no args needed):
         ./scripts/recover-buffers.sh

    B) Or run the CLI directly:
         solana program close --buffers \\
           --keypair "$TEMP_KEYPAIR" \\
           --recipient $TEMP_PUBKEY \\
           --bypass-warning \\
           -u $RPC_URL

  The buffer authority in this flow is the temp keypair (a file on disk),
  NOT your Ledger. CLI close works. \033[1mDo NOT use a browser tool to
  recover buffers — that's how SOL got stranded last time.\033[0m

BANNER
}

# List buffer accounts whose authority is the temp keypair.
# Returns one buffer pubkey per line; empty output = none found.
list_buffers() {
  solana program show --buffers \
    --buffer-authority "$TEMP_PUBKEY" \
    -u "$RPC_URL" 2>/dev/null \
    | awk 'NR>1 && $1 ~ /^[1-9A-HJ-NP-Za-km-z]{32,44}$/ {print $1}'
}

# Close every buffer owned by the temp keypair, returning rent (~3 SOL each)
# back to the temp keypair. Idempotent — safe to call when no buffers exist.
cleanup_buffers() {
  local buffers
  buffers="$(list_buffers || true)"
  if [ -z "$buffers" ]; then
    info "No leftover buffer accounts to recover."
    return 0
  fi
  warn "Found leftover buffer account(s) owned by $TEMP_PUBKEY:"
  echo "$buffers" | sed 's/^/    /'
  info "Closing them and returning rent to $TEMP_PUBKEY..."
  if solana program close --buffers \
       --keypair "$TEMP_KEYPAIR" \
       --recipient "$TEMP_PUBKEY" \
       --bypass-warning \
       -u "$RPC_URL"; then
    info "Buffer rent recovered. Final balance:"
    solana balance "$TEMP_PUBKEY" -u "$RPC_URL" | sed 's/^/    /'
  else
    warn "Automatic buffer close failed. Recover manually with:"
    cat <<MANUAL
      solana program close --buffers \\
        --keypair "$TEMP_KEYPAIR" \\
        --recipient "$TEMP_PUBKEY" \\
        --bypass-warning \\
        -u "$RPC_URL"

    Or use apps/web/deploy.html "Scan for Buffers" with the temp keypair authority.
MANUAL
  fi
}

# Trap: if the deploy step started but didn't complete cleanly, attempt to
# close any leaked buffer so SOL isn't stranded. Top priority.
DEPLOY_STARTED=0
DEPLOY_DONE=0
on_exit() {
  local rc=$?
  trap - EXIT INT TERM
  if [ "$DEPLOY_STARTED" -eq 1 ] && [ "$DEPLOY_DONE" -eq 0 ]; then
    bold "Deploy did not complete (exit code $rc) — recovering buffer SOL"
    cleanup_buffers || true
    print_recovery_banner
    warn "If automatic recovery above failed, the state file at $STATE_FILE"
    warn "has everything you need. Run ./scripts/recover-buffers.sh to retry."
  fi
  exit "$rc"
}
trap on_exit EXIT INT TERM

# === Preflight ===
bold "Preflight"

[ -n "$TEMP_KEYPAIR" ]                                       || fail "Set TEMP_KEYPAIR=<path-to-temp-keypair.json>"
[ -f "$TEMP_KEYPAIR" ]                                       || fail "Temp keypair file not found: $TEMP_KEYPAIR"
[[ "$TEMP_KEYPAIR" == /tmp/* || "$TEMP_KEYPAIR" == /private/tmp/* ]] && fail "Refusing to use a /tmp keypair (macOS daily cleanup will delete it). Move to ~/.config/solana/."
command -v solana-verify >/dev/null                          || fail "solana-verify not installed (cargo install solana-verify)"
command -v solana >/dev/null                                 || fail "solana CLI not installed"
command -v docker >/dev/null                                 || fail "docker not installed"
docker info >/dev/null 2>&1                                  || fail "Docker daemon is not running"
[ -f "$ANCHOR_DIR/security.json" ]                           || fail "security.json not found at $ANCHOR_DIR/security.json"

TEMP_PUBKEY="$(solana-keygen pubkey "$TEMP_KEYPAIR")"
info "Temp keypair pubkey: $TEMP_PUBKEY"
info "Commit:              $COMMIT"

# Confirm the on-chain upgrade authority is the temp keypair (i.e., manual rotation happened)
ON_CHAIN_AUTH="$(solana program show "$PROGRAM_ID" -u "$RPC_URL" | awk '/Authority:/ {print $2}')"
info "On-chain authority:  $ON_CHAIN_AUTH"
[ "$ON_CHAIN_AUTH" = "$TEMP_PUBKEY" ] || fail "On-chain upgrade authority is $ON_CHAIN_AUTH, not the temp keypair. Run SetAuthority via apps/web/deploy.html first."

# Balance check
BALANCE_LINE="$(solana balance "$TEMP_PUBKEY" -u "$RPC_URL")"
BALANCE_SOL="$(echo "$BALANCE_LINE" | awk '{print $1}')"
info "Temp keypair balance: $BALANCE_LINE"
awk -v b="$BALANCE_SOL" -v m="$MIN_SOL" 'BEGIN { exit !(b+0 >= m+0) }' \
  || fail "Temp keypair has $BALANCE_SOL SOL; need at least $MIN_SOL SOL for buffer + rent."

# Verify commit pushed to origin
git -C "$REPO_ROOT" fetch origin --quiet || true
if ! git -C "$REPO_ROOT" branch -r --contains "$COMMIT" | grep -q "origin/"; then
  fail "Commit $COMMIT is not on any origin branch. Push it before verifying (OtterSec rebuilds from GitHub)."
fi

# Scan for any pre-existing orphaned buffers (from a prior failed run)
PRE_BUFFERS="$(list_buffers || true)"
if [ -n "$PRE_BUFFERS" ]; then
  warn "Found pre-existing buffer account(s) owned by the temp keypair:"
  echo "$PRE_BUFFERS" | sed 's/^/    /'
  printf "  Close them now and recover SOL before continuing? [y/N] "
  read -r ans
  if [ "$ans" = "y" ]; then
    cleanup_buffers
  else
    fail "Aborting. Recover or reuse the existing buffer manually before re-running."
  fi
fi

# Confirm security.json source_revision matches (warn only)
SR="$(grep -E '"source_revision"' "$ANCHOR_DIR/security.json" | sed -E 's/.*"source_revision": *"([^"]+)".*/\1/')"
if [ "$SR" != "$COMMIT" ]; then
  printf "  \033[33mWARN:\033[0m security.json source_revision is %s, but you're verifying %s.\n" "$SR" "$COMMIT"
  printf "  Continue anyway? [y/N] "
  read -r ans; [ "$ans" = "y" ] || exit 1
fi

bold "Plan"
cat <<EOF
  Program ID:      $PROGRAM_ID
  Repo:            $REPO_URL @ $COMMIT
  Build:           solana-verify build (Docker, deterministic)
  Deploy via:      $TEMP_KEYPAIR
  After deploy:    upload verify PDA → submit OtterSec job → write security.txt
  Final auth:      $LEDGER_AUTHORITY  (you rotate back manually after)

EOF
printf "Proceed? [y/N] "
read -r ans; [ "$ans" = "y" ] || exit 0

# Persist recovery state BEFORE any risky step. From here on, even if the
# terminal dies, the file at $STATE_FILE contains everything needed to recover.
write_state_file
info "Recovery state written to: $STATE_FILE"
print_recovery_banner

# === Step 5: Deterministic build ===
bold "Building deterministic .so (Docker, ~3–5 min)"
( cd "$ANCHOR_DIR" && solana-verify build --library-name "$LIBRARY_NAME" )

SO_PATH="$ANCHOR_DIR/target/deploy/${LIBRARY_NAME}.so"
[ -f "$SO_PATH" ] || fail "Build produced no .so at $SO_PATH"
info ".so size: $(ls -lh "$SO_PATH" | awk '{print $5}')"

# === Step 6: Deploy ===
bold "Deploying to mainnet"
DEPLOY_STARTED=1
solana program deploy \
  -u "$RPC_URL" \
  --keypair "$TEMP_KEYPAIR" \
  --program-id "$PROGRAM_ID" \
  --with-compute-unit-price "$COMPUTE_UNIT_PRICE" \
  --max-sign-attempts "$MAX_SIGN_ATTEMPTS" \
  --use-rpc \
  "$SO_PATH"
DEPLOY_DONE=1
info "Deploy succeeded. Sanity-checking for orphaned buffers..."
cleanup_buffers   # idempotent; should find none on a clean success

# === Step 7: Upload verify PDA ===
bold "Uploading verification PDA on-chain"
solana-verify verify-from-repo \
  -u "$RPC_URL" \
  --keypair "$TEMP_KEYPAIR" \
  --program-id "$PROGRAM_ID" \
  --library-name "$LIBRARY_NAME" \
  --mount-path "$MOUNT_PATH" \
  --commit-hash "$COMMIT" \
  "$REPO_URL"

# === Step 8: Submit OtterSec job ===
bold "Submitting OtterSec remote build job"
solana-verify remote submit-job \
  --program-id "$PROGRAM_ID" \
  --uploader "$TEMP_PUBKEY"

# === Step 9: security.txt ===
bold "Writing security.txt metadata"
( cd "$ANCHOR_DIR" && \
  npx --yes @solana-program/program-metadata@latest write security \
    "$PROGRAM_ID" \
    ./security.json \
    --keypair "$TEMP_KEYPAIR" \
    --rpc "$RPC_URL" )

bold "Done"
cat <<EOF
Next manual steps — KEEP THE TEMP KEYPAIR OFF THE BROWSER. Use CLI only.

  1. Rotate authority back to Ledger via CLI (do NOT import the temp keypair
     into Phantom / deploy.html / any browser tool — it can be lost on refresh):

       solana program set-upgrade-authority \\
         --keypair "$TEMP_KEYPAIR" \\
         --new-upgrade-authority $LEDGER_AUTHORITY \\
         --skip-new-upgrade-authority-signer-check \\
         -u $RPC_URL \\
         $PROGRAM_ID

  2. Confirm authority moved:

       solana program show $PROGRAM_ID -u $RPC_URL
       # Authority must read: $LEDGER_AUTHORITY

  3. Drain remaining SOL from temp keypair to your main wallet:

       solana transfer <your-main-wallet-pubkey> ALL \\
         --keypair "$TEMP_KEYPAIR" \\
         --allow-unfunded-recipient \\
         -u $RPC_URL

  4. Verify temp keypair is empty, then archive or shred the file:

       solana balance "$TEMP_PUBKEY" -u $RPC_URL   # must be 0
       # Only then: shred -u "$TEMP_KEYPAIR"  (or move to ~/archive/)

  5. Check OtterSec verification job (~10–20 min):

       solana-verify remote list-job --program-id $PROGRAM_ID

  6. Visit https://explorer.solana.com/address/$PROGRAM_ID
     - Verified Build badge appears after OtterSec finishes
     - Security tab appears within a few minutes

EOF
