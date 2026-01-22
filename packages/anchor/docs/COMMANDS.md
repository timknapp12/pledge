# Solana/Anchor Development Commands

Quick reference for common commands used in Pledge development.

---

## Table of Contents

- [Local Validator](#local-validator)
- [Solana CLI](#solana-cli)
- [Anchor Commands](#anchor-commands)
- [Cargo Commands](#cargo-commands)
- [Testing](#testing)
- [Deployment](#deployment)
- [Account Inspection](#account-inspection)
- [Troubleshooting](#troubleshooting)

---

## Local Validator

### Start Local Validator

```bash
# Start with default settings
solana-test-validator

# Start in background, quiet mode
solana-test-validator -q &

# Start fresh (reset all state)
solana-test-validator --reset

# Start fresh in background
solana-test-validator --reset -q &

# Start with specific program deployed
solana-test-validator --bpf-program <PROGRAM_ID> <PATH_TO_SO_FILE>
```

### Stop Local Validator

```bash
# Kill running validator
pkill -f solana-test-validator

# Or find and kill by PID
ps aux | grep solana-test-validator
kill <PID>
```

### Check Validator Status

```bash
# Check if validator is running (should return balance)
solana balance --url localhost

# Get cluster version
solana cluster-version --url localhost

# Get slot
solana slot --url localhost
```

---

## Solana CLI

### Configuration

```bash
# Show current config
solana config get

# Set to localhost
solana config set --url localhost

# Set to devnet
solana config set --url devnet

# Set to mainnet
solana config set --url mainnet-beta

# Set wallet
solana config set --keypair ~/.config/solana/id.json
```

### Wallet Management

```bash
# Generate new keypair
solana-keygen new -o ~/.config/solana/id.json

# Generate keypair with specific output file
solana-keygen new -o ./my-wallet.json

# Get public key from keypair file
solana-keygen pubkey ~/.config/solana/id.json

# Get public key bytes (for constants.rs)
solana address -k ./my-wallet.json

# Check wallet balance
solana balance

# Check specific wallet balance
solana balance <PUBKEY>

# Airdrop SOL (devnet/localhost only)
solana airdrop 2

# Airdrop to specific address
solana airdrop 2 <PUBKEY>

# Transfer SOL
solana transfer <RECIPIENT_PUBKEY> <AMOUNT>
```

### Program Commands

```bash
# Deploy program
solana program deploy target/deploy/pledge.so

# Show program info
solana program show <PROGRAM_ID>

# Close program (recover SOL)
solana program close <PROGRAM_ID>

# Extend program (increase size for upgrades)
solana program extend <PROGRAM_ID> <ADDITIONAL_BYTES>

# Set program upgrade authority
solana program set-upgrade-authority <PROGRAM_ID> --new-upgrade-authority <NEW_AUTHORITY>

# Make program immutable (no more upgrades)
solana program set-upgrade-authority <PROGRAM_ID> --final
```

### Account Commands

```bash
# Get account info
solana account <PUBKEY>

# Get account data in JSON
solana account <PUBKEY> --output json

# Get account data in base64
solana account <PUBKEY> --output json | jq -r '.data[0]'
```

---

## Anchor Commands

### Build

```bash
# Build program
anchor build

# Build with verifiable (reproducible) build
anchor build --verifiable

# Clean build artifacts
anchor clean
```

### Deploy

```bash
# Deploy to configured cluster
anchor deploy

# Deploy to specific cluster
anchor deploy --provider.cluster devnet

# Deploy specific program
anchor deploy --program-name pledge
```

### Test

```bash
# Run all tests (builds, starts validator, deploys, tests)
anchor test

# Run tests without starting local validator
anchor test --skip-local-validator

# Run tests without building
anchor test --skip-build

# Run tests with specific provider
anchor test --provider.cluster devnet
```

### IDL Management

```bash
# Generate IDL
anchor idl parse -f programs/pledge/src/lib.rs -o target/idl/pledge.json

# Initialize IDL on-chain
anchor idl init <PROGRAM_ID> -f target/idl/pledge.json

# Upgrade IDL on-chain
anchor idl upgrade <PROGRAM_ID> -f target/idl/pledge.json

# Fetch IDL from on-chain
anchor idl fetch <PROGRAM_ID>

# Erase IDL from on-chain
anchor idl erase <PROGRAM_ID>
```

### Keys

```bash
# Show program keypair path
anchor keys list

# Sync program IDs in Anchor.toml and lib.rs
anchor keys sync
```

### Verify

```bash
# Verify deployed program matches local build
anchor verify <PROGRAM_ID>
```

---

## Cargo Commands

### Build

```bash
# Build in debug mode
cargo build

# Build in release mode
cargo build --release

# Build BPF (Solana program)
cargo build-bpf

# Build SBF (newer Solana program format)
cargo build-sbf

# Check without building
cargo check
```

### Test

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_name

# Run tests with output
cargo test -- --nocapture

# Run tests in specific module
cargo test module_name::

# Run only unit tests (no integration)
cargo test --lib
```

### Other

```bash
# Format code
cargo fmt

# Lint code
cargo clippy

# Update dependencies
cargo update

# Show dependency tree
cargo tree

# Clean build artifacts
cargo clean

# Generate documentation
cargo doc --open
```

---

## Testing

### Running Tests with ts-mocha

```bash
# Set environment variables
export ANCHOR_PROVIDER_URL=http://localhost:8899
export ANCHOR_WALLET=~/.config/solana/id.json

# Run all tests
npx ts-mocha -p ./tsconfig.json -t 60000 tests/pledge.ts

# Run specific test file
npx ts-mocha -p ./tsconfig.json -t 60000 tests/createPledge.ts

# Run tests matching pattern
npx ts-mocha -p ./tsconfig.json -t 60000 tests/createPledge.ts --grep "creates a pledge"

# Run with longer timeout
npx ts-mocha -p ./tsconfig.json -t 120000 tests/processExpired.ts
```

### One-liner Test Commands

```bash
# Run single test file with env vars
ANCHOR_PROVIDER_URL=http://localhost:8899 ANCHOR_WALLET=~/.config/solana/id.json \
  npx ts-mocha -p ./tsconfig.json -t 60000 tests/initialize.ts

# Fresh validator + deploy + test
pkill -f solana-test-validator; sleep 2; \
  solana-test-validator --reset -q & sleep 5; \
  anchor deploy && \
  ANCHOR_PROVIDER_URL=http://localhost:8899 ANCHOR_WALLET=~/.config/solana/id.json \
  npx ts-mocha -p ./tsconfig.json -t 60000 tests/createPledge.ts
```

### Test Individual Instructions

```bash
# Initialize
npx ts-mocha -p ./tsconfig.json -t 60000 tests/initialize.ts

# Create Pledge
npx ts-mocha -p ./tsconfig.json -t 60000 tests/createPledge.ts

# Report Completion
npx ts-mocha -p ./tsconfig.json -t 60000 tests/reportCompletion.ts

# Process Completion
npx ts-mocha -p ./tsconfig.json -t 60000 tests/processCompletion.ts

# Process Expired
npx ts-mocha -p ./tsconfig.json -t 60000 tests/processExpired.ts

# Edit Pledge
npx ts-mocha -p ./tsconfig.json -t 60000 tests/editPledge.ts
```

---

## Deployment

### Localhost

```bash
# 1. Start validator
solana-test-validator --reset -q &
sleep 5

# 2. Configure for localhost
solana config set --url localhost

# 3. Airdrop SOL for deployment
solana airdrop 10

# 4. Deploy
anchor deploy
```

### Devnet

```bash
# 1. Configure for devnet
solana config set --url devnet

# 2. Airdrop SOL (may need multiple attempts)
solana airdrop 2
solana airdrop 2

# 3. Check balance (need ~3 SOL for deployment)
solana balance

# 4. Deploy
anchor deploy --provider.cluster devnet

# 5. Verify deployment
solana program show <PROGRAM_ID>
```

### Mainnet

```bash
# 1. Configure for mainnet
solana config set --url mainnet-beta

# 2. Ensure wallet has SOL for deployment fees
solana balance

# 3. Deploy (use --final to make immutable if desired)
anchor deploy --provider.cluster mainnet

# 4. Verify deployment
anchor verify <PROGRAM_ID>
```

---

## Account Inspection

### View Program Accounts

```bash
# Get all accounts owned by program
solana program show <PROGRAM_ID> --programs

# Decode account data using Anchor
anchor account pledge.ProgramConfig <ACCOUNT_PUBKEY>
anchor account pledge.Pledge <ACCOUNT_PUBKEY>
```

### Derive PDAs

```bash
# Using anchor CLI (if available)
# Or use a script:
```

```typescript
import { PublicKey } from "@solana/web3.js";

const programId = new PublicKey("GXmRKiwZ6ozV8iGJLq1usFafhpPPYFjfFoQcCPGUQpJe");

// Config PDA
const [configPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("config")],
  programId
);
console.log("Config PDA:", configPda.toBase58());

// Pledge PDA
const [pledgePda] = PublicKey.findProgramAddressSync(
  [Buffer.from("pledge"), userPubkey.toBuffer(), createdAt.toArrayLike(Buffer, "le", 8)],
  programId
);
console.log("Pledge PDA:", pledgePda.toBase58());
```

### Token Account Inspection

```bash
# Get SPL token account info
spl-token account-info <TOKEN_ACCOUNT>

# Get token balance
spl-token balance <TOKEN_MINT> --owner <OWNER>

# List all token accounts for wallet
spl-token accounts

# Get token supply
spl-token supply <TOKEN_MINT>
```

---

## Troubleshooting

### Common Issues

#### "account already in use"
```bash
# Config PDA already initialized - expected when running multiple tests
# Solution: Restart validator fresh
pkill -f solana-test-validator
solana-test-validator --reset -q &
```

#### "insufficient funds"
```bash
# Airdrop more SOL
solana airdrop 2

# Check balance
solana balance
```

#### "program not found"
```bash
# Redeploy the program
anchor deploy

# Verify program exists
solana program show <PROGRAM_ID>
```

#### "Error: Simulation failed"
```bash
# Check transaction logs for details
# The error message usually includes logs
# Look for "Program log:" entries
```

#### "blockhash not found"
```bash
# Validator might be starting up - wait and retry
sleep 5
```

#### "custom program error: 0x0"
```bash
# Usually means account already initialized
# Or constraint violation - check program logs
```

### Checking Logs

```bash
# View validator logs
solana logs

# View logs for specific program
solana logs <PROGRAM_ID>

# View logs in test output
# Add { commitment: "confirmed", preflightCommitment: "confirmed" }
# to provider options to see logs on error
```

### Reset Everything

```bash
# Kill validator
pkill -f solana-test-validator

# Clean Anchor build
anchor clean

# Rebuild
anchor build

# Start fresh validator
solana-test-validator --reset -q &
sleep 5

# Deploy
anchor deploy
```

---

## Environment Variables

```bash
# Required for running tests outside of `anchor test`
export ANCHOR_PROVIDER_URL=http://localhost:8899
export ANCHOR_WALLET=~/.config/solana/id.json

# Or set per-command
ANCHOR_PROVIDER_URL=http://localhost:8899 ANCHOR_WALLET=~/.config/solana/id.json <command>
```

---

## Useful Aliases

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Solana
alias sol="solana"
alias solb="solana balance"
alias sola="solana airdrop 2"
alias solc="solana config get"

# Anchor
alias ab="anchor build"
alias ad="anchor deploy"
alias at="anchor test"

# Validator
alias stv="solana-test-validator"
alias stv-reset="pkill -f solana-test-validator; sleep 2; solana-test-validator --reset -q &"
alias stv-kill="pkill -f solana-test-validator"

# Testing
alias tsm="ANCHOR_PROVIDER_URL=http://localhost:8899 ANCHOR_WALLET=~/.config/solana/id.json npx ts-mocha -p ./tsconfig.json -t 60000"
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Start validator | `solana-test-validator --reset -q &` |
| Stop validator | `pkill -f solana-test-validator` |
| Build program | `anchor build` |
| Deploy program | `anchor deploy` |
| Run all tests | `anchor test` |
| Run single test | `tsm tests/initialize.ts` |
| Check balance | `solana balance` |
| Airdrop SOL | `solana airdrop 2` |
| Switch to devnet | `solana config set --url devnet` |
| Switch to localhost | `solana config set --url localhost` |
