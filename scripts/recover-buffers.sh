#!/usr/bin/env bash
# Standalone buffer-recovery helper.
#
# Use this if scripts/deploy-mainnet-verified.sh failed and you can't see its
# output anymore (terminal closed, scrolled away, machine rebooted, etc.).
# Reads ~/.config/solana/pledge-deploy-state.json and closes any buffer
# accounts owned by the temp keypair, returning their rent (~3 SOL each)
# to the temp keypair pubkey.
#
# This is CLI-only — no browser, no Ledger signing required. The buffer
# authority in our deploy flow is the temp keypair file, not your Ledger.
#
# Usage:
#   ./scripts/recover-buffers.sh                # uses state file
#   TEMP_KEYPAIR=/path/to/file.json ./scripts/recover-buffers.sh   # override

set -euo pipefail

STATE_FILE="$HOME/.config/solana/pledge-deploy-state.json"

bold() { printf "\n\033[1m== %s ==\033[0m\n" "$1"; }
info() { printf "  %s\n" "$1"; }
fail() { printf "\n\033[31mERROR:\033[0m %s\n" "$1" >&2; exit 1; }

# Resolve config: env override → state file → fail
TEMP_KEYPAIR="${TEMP_KEYPAIR:-}"
RPC_URL="${RPC_URL:-}"
if [ -z "$TEMP_KEYPAIR" ] || [ -z "$RPC_URL" ]; then
  [ -f "$STATE_FILE" ] || fail "No state file at $STATE_FILE and no TEMP_KEYPAIR env. Pass TEMP_KEYPAIR=/path/to/file.json explicitly."
  TEMP_KEYPAIR="${TEMP_KEYPAIR:-$(grep -E '"temp_keypair_path"' "$STATE_FILE" | sed -E 's/.*"temp_keypair_path": *"([^"]+)".*/\1/')}"
  RPC_URL="${RPC_URL:-$(grep -E '"rpc"' "$STATE_FILE" | sed -E 's/.*"rpc": *"([^"]+)".*/\1/')}"
fi

[ -f "$TEMP_KEYPAIR" ] || fail "Temp keypair not found at: $TEMP_KEYPAIR"
command -v solana >/dev/null || fail "solana CLI not installed"

TEMP_PUBKEY="$(solana-keygen pubkey "$TEMP_KEYPAIR")"

bold "Recovering buffer SOL"
info "Temp keypair: $TEMP_KEYPAIR"
info "Pubkey:       $TEMP_PUBKEY"
info "RPC:          $RPC_URL"

bold "Current temp keypair balance"
solana balance "$TEMP_PUBKEY" -u "$RPC_URL"

bold "Buffers owned by this keypair"
BUFFERS="$(solana program show --buffers \
  --buffer-authority "$TEMP_PUBKEY" \
  -u "$RPC_URL" 2>/dev/null \
  | awk 'NR>1 && $1 ~ /^[1-9A-HJ-NP-Za-km-z]{32,44}$/ {print $1}' || true)"

if [ -z "$BUFFERS" ]; then
  info "No buffers found. Nothing to recover."
  exit 0
fi

echo "$BUFFERS" | sed 's/^/    /'
printf "\nClose all of the above and return rent to %s? [y/N] " "$TEMP_PUBKEY"
read -r ans
[ "$ans" = "y" ] || { info "Aborted; no changes made."; exit 0; }

bold "Closing buffers"
solana program close --buffers \
  --keypair "$TEMP_KEYPAIR" \
  --recipient "$TEMP_PUBKEY" \
  --bypass-warning \
  -u "$RPC_URL"

bold "New temp keypair balance"
solana balance "$TEMP_PUBKEY" -u "$RPC_URL"

cat <<EOF

Recovery complete. To finish:

  1. Drain temp keypair to your main wallet:
       solana transfer <your-main-wallet-pubkey> ALL \\
         --keypair "$TEMP_KEYPAIR" \\
         --allow-unfunded-recipient \\
         -u $RPC_URL

  2. (If you still need to roll the program forward, re-run scripts/deploy-mainnet-verified.sh)

EOF
