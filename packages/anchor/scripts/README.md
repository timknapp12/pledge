# Pledge Admin Scripts

Admin scripts for managing the Pledge program. These scripts allow you to initialize, configure, and monitor the program without a web dashboard.

## Prerequisites

1. **Node.js** and **npm/pnpm** installed
2. **Admin keypair** - Either:
   - `./admin-wallet.json` in the anchor package directory
   - `~/.config/solana/id.json` (default Solana keypair)
3. **SOL balance** for transaction fees

## Setup

```bash
# From packages/anchor directory
cd packages/anchor

# Install dependencies (if not already done)
pnpm install
```

## Scripts

### View Current Config

View the current program configuration:

```bash
# Localhost
npx ts-node scripts/view-config.ts

# Devnet
npx ts-node scripts/view-config.ts --network devnet

# Mainnet
npx ts-node scripts/view-config.ts --network mainnet

# Output as JSON
npx ts-node scripts/view-config.ts --network devnet --json
```

### Initialize Config (First Time Setup)

Initialize the program config. This can only be done once:

```bash
npx ts-node scripts/initialize.ts \
  --network devnet \
  --treasury <TREASURY_WALLET_PUBKEY> \
  --charity <CHARITY_WALLET_PUBKEY>
```

With custom fee settings:

```bash
npx ts-node scripts/initialize.ts \
  --network devnet \
  --treasury <TREASURY_PUBKEY> \
  --charity <CHARITY_PUBKEY> \
  --treasury-split 8000 \
  --partial-fee 100 \
  --edit-penalty 1000 \
  --grace-period 86400
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `--treasury` | required | Treasury wallet public key |
| `--charity` | required | Charity wallet public key |
| `--treasury-split` | 7000 (70%) | Treasury share of forfeitures (BPS) |
| `--partial-fee` | 100 (1%) | Fee on partial completions (BPS) |
| `--edit-penalty` | 1000 (10%) | Penalty for editing pledges (BPS) |
| `--grace-period` | 86400 (1 day) | Grace period in seconds |

### Update Config

Update specific config values:

```bash
# Update treasury split to 80%
npx ts-node scripts/update-config.ts --network devnet --treasury-split 8000

# Update partial fee to 2%
npx ts-node scripts/update-config.ts --network devnet --partial-fee 200

# Update multiple values
npx ts-node scripts/update-config.ts --network devnet \
  --partial-fee 150 \
  --edit-penalty 500

# Update treasury wallet
npx ts-node scripts/update-config.ts --network devnet \
  --treasury <NEW_TREASURY_PUBKEY>
```

### Pause/Unpause Program

Pause the program (prevents new pledges):

```bash
npx ts-node scripts/pause.ts --network devnet --action pause
```

Unpause the program:

```bash
npx ts-node scripts/pause.ts --network devnet --action unpause
```

### View Pledge Details

View a specific pledge by address:

```bash
npx ts-node scripts/view-pledge.ts --network devnet --pledge <PLEDGE_ADDRESS>
```

View a pledge by user and creation time:

```bash
npx ts-node scripts/view-pledge.ts --network devnet \
  --user <USER_WALLET> \
  --created-at <UNIX_TIMESTAMP>
```

Output as JSON:

```bash
npx ts-node scripts/view-pledge.ts --network devnet --pledge <ADDRESS> --json
```

## Networks

| Network | URL |
|---------|-----|
| localhost | http://localhost:8899 |
| devnet | https://api.devnet.solana.com |
| mainnet | https://api.mainnet-beta.solana.com |

## Admin Keypair

The scripts look for the admin keypair in this order:
1. `--admin <path>` argument
2. `./admin-wallet.json` in the current directory
3. `~/.config/solana/id.json` (default Solana keypair)

**Security:** Never commit your admin keypair to git. The `admin-wallet.json` file should be in `.gitignore`.

### Generate Admin Keypair

```bash
# Generate new keypair
solana-keygen new -o ./admin-wallet.json

# Get public key
solana-keygen pubkey ./admin-wallet.json
```

## Examples

### Initial Deployment Workflow

```bash
# 1. Configure for devnet
solana config set --url devnet

# 2. Airdrop SOL for deployment
solana airdrop 2

# 3. Deploy program
anchor deploy --provider.cluster devnet

# 4. Initialize config
npx ts-node scripts/initialize.ts \
  --network devnet \
  --treasury <TREASURY_PUBKEY> \
  --charity <CHARITY_PUBKEY>

# 5. Verify config
npx ts-node scripts/view-config.ts --network devnet
```

### Emergency Pause

```bash
# Pause immediately
npx ts-node scripts/pause.ts --network mainnet --action pause

# Verify
npx ts-node scripts/view-config.ts --network mainnet
```

### Fee Adjustment

```bash
# View current fees
npx ts-node scripts/view-config.ts --network mainnet

# Update partial fee to 1.5%
npx ts-node scripts/update-config.ts --network mainnet --partial-fee 150

# Verify
npx ts-node scripts/view-config.ts --network mainnet
```

## Error Handling

### "Config not initialized"
Run `initialize.ts` first to set up the program config.

### "You are not the admin"
The keypair you're using doesn't match the admin stored in config. Use the correct admin keypair with `--admin <path>`.

### "Config already initialized"
Initialize can only be run once. Use `update-config.ts` to modify existing config.

### "Insufficient balance"
Airdrop SOL (devnet) or ensure your wallet has SOL for transaction fees.

## Common Values

### BPS Reference
| BPS | Percentage |
|-----|------------|
| 100 | 1% |
| 500 | 5% |
| 1000 | 10% |
| 7000 | 70% |
| 10000 | 100% |

### Time Reference
| Seconds | Duration |
|---------|----------|
| 3600 | 1 hour |
| 86400 | 1 day |
| 604800 | 1 week |
| 2592000 | 30 days |
