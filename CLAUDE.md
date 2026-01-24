# Pledge - Project Instructions

## Project Overview

Pledge is a Solana mobile dApp for Android that lets users stake tokens on personal goals. Users create time-bound goals with to-do lists, stake USDC tokens, track progress, and report completion. 100% completion returns full stake (no fee); partial completion returns proportional amount minus fee; failure forfeits tokens to treasury/charity.

**Key Document:** See `PRD.md` for full product requirements.

---

## Available Tools & Skills

### Claude Skills (Marketplace)

Use the `Skill` tool to invoke these when relevant:

| Skill                            | When to Use                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `solana-dev`                     | Solana development - wallet connection, transactions, Anchor programs, testing |
| `expo-app-design:building-ui`    | Building UI with Expo Router - styling, components, navigation, animations     |
| `expo-app-design:data-fetching`  | Network requests, API calls, React Query, caching, offline support             |
| `expo-app-design:tailwind-setup` | If switching to Tailwind (currently using styled-components)                   |
| `expo-app-design:dev-client`     | Building/distributing Expo development clients                                 |
| `expo-deployment:cicd-workflows` | EAS workflow YAML files, CI/CD pipelines                                       |
| `expo-deployment:deployment`     | Deploying to Play Store, web hosting                                           |
| `upgrading-expo:upgrading-expo`  | Upgrading Expo SDK versions                                                    |

### MCP Servers

Use MCP tools for documentation and project management:

| MCP          | Tools                                                                                                                                     | When to Use                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Solana**   | `mcp__solana__Solana_Expert__Ask_For_Help`, `mcp__solana__Solana_Documentation_Search`, `mcp__solana__Ask_Solana_Anchor_Framework_Expert` | Solana/Anchor questions, SDK usage, error debugging   |
| **Supabase** | `mcp__supabase__search_docs`, `mcp__supabase__list_projects`, `mcp__supabase__execute_sql`, `mcp__supabase__apply_migration`, etc.        | Database operations, Edge Functions, auth, migrations |

### When to Use What

- **Solana MCP**: Questions about Solana concepts, web3.js/kit, Anchor patterns, transaction building
- **Supabase MCP**: Database schema, migrations, Edge Functions, pg_cron, auth flows
- **Expo Skills**: UI components, navigation, data fetching, deployment
- **Solana Skill**: End-to-end Solana development patterns, wallet integration

---

## Tech Stack

| Layer           | Technology                                      |
| --------------- | ----------------------------------------------- |
| Mobile          | React Native (Expo), Android only               |
| UI              | Custom components, styled-components            |
| Auth            | Supabase + Sign in with Solana                  |
| Wallet          | Solana Mobile Wallet Adapter (MWA)              |
| Blockchain      | Anchor 0.31.0                                   |
| Frontend Solana | @solana/web3.js v1.x, @coral-xyz/anchor v0.28.0 |
| RPC             | Helius (free tier)                              |
| Database        | Supabase (Postgres)                             |
| Notifications   | Supabase pg_cron + Edge Functions               |
| i18n            | i18next (English default, Spanish for testing)  |

---

## Monorepo Structure

```
pledge/
├── apps/
│   └── mobile/              # React Native Expo app
│       ├── src/
│       │   ├── app/         # Expo Router screens
│       │   ├── components/  # UI components
│       │   ├── contexts/    # React contexts
│       │   ├── hooks/       # Custom hooks
│       │   ├── lib/         # Utilities, API clients
│       │   ├── types/       # TypeScript types
│       │   └── i18n/        # Translations
│       └── ...
├── packages/
│   ├── anchor/              # Solana program
│   │   └── programs/pledge/src/
│   │       ├── lib.rs
│   │       ├── constants.rs
│   │       ├── errors.rs
│   │       ├── contexts/    # One file per instruction
│   │       ├── state/       # One file per account
│   │       └── utils/       # Helper functions
│   └── shared/              # Shared types between packages
├── supabase/
│   ├── migrations/          # Database migrations
│   └── functions/           # Edge Functions
├── scripts/                 # Admin scripts
├── CLAUDE.md
├── PRD.md
└── turbo.json
```

---

## Code Style Guidelines

### General

- Files should be **precise, short, and clean**
- Prefer editing existing files over creating new ones
- No unnecessary abstractions - only add what's needed now
- No premature optimization

### Anchor Program (Rust)

Reference: `/Users/timk/projects/solana/twizzin/twizzin-be2` for patterns

- **One instruction per file** in `contexts/`
- **One account type per file** in `state/`
- **Co-locate events** with their associated account structs
- **Thin handlers in lib.rs** - delegate to impl blocks
- **Explicit space calculations** with comments
- **Unit tests in utils** files using `#[cfg(test)]`
- Use `mod.rs` files for clean re-exports

```rust
// contexts/create_pledge.rs pattern
#[derive(Accounts)]
pub struct CreatePledge<'info> {
    // Account definitions with constraints
}

impl<'info> CreatePledge<'info> {
    pub fn create_pledge(&mut self, params...) -> Result<()> {
        // Implementation
    }
}

// lib.rs pattern - thin wrapper
pub fn create_pledge(ctx: Context<CreatePledge>, ...) -> Result<()> {
    ctx.accounts.create_pledge(...)
}
```

### React Native (TypeScript)

Reference: `/Users/timk/rekt-react-native` for i18n pattern

- Use **styled-components** for styling
- Use **Expo Router** for navigation
- Follow existing i18n pattern with i18next + expo-localization
- Custom UI components (no external UI library)
- Use React Query for data fetching/caching
- **No web components** - pure React Native only, no WebViews or DOM-based components

### i18n (Internationalization)

**IMPORTANT:** All user-facing strings must be wrapped in `t()` and added to locale files.

```typescript
// In component file
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();

  return (
    <Text>{t('Maximum Amount')}</Text>
    <Text>{t('Creating your account...')}</Text>
  );
};
```

```json
// In src/i18n/locales/en.json
{
  "Maximum Amount": "Maximum Amount",
  "Creating your account...": "Creating your account..."
}
```

**Rules:**
- Never hardcode user-facing strings directly in JSX
- Add English strings to `en.json` immediately when creating UI
- Use the exact string as the key (no camelCase keys)
- Spanish translations go in `es.json` (for testing RTL/translation)

### Tests

- **One test file per instruction** (TypeScript)
- Main test runner orchestrates sequential tests
- Test files export reusable functions

---

## Key Patterns

### Authentication (Sign in with Solana)

**Flow:**

1. User connects wallet via MWA
2. User signs SIWS (Sign in with Solana) message
3. Send signed message to Supabase Edge Function (`verify-wallet`)
4. Edge Function verifies signature matches public key
5. Edge Function creates custom JWT with wallet address as `sub` claim
6. Frontend stores JWT and initializes Supabase client with it
7. All Supabase requests include JWT, RLS policies enforce access

**Edge Function (verify-wallet):**

```typescript
import { createClient } from '@supabase/supabase-js';
import { verify } from '@noble/ed25519';
import * as jwt from 'jsonwebtoken';

// Verify signature, create/update user, return custom JWT
const token = jwt.sign(
  { sub: walletAddress, role: 'authenticated' },
  Deno.env.get('SUPABASE_JWT_SECRET'),
  { expiresIn: '1h' }
);
```

**Frontend Supabase client:**

```typescript
import { createClient } from '@supabase/supabase-js';

// After getting JWT from Edge Function
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    headers: { Authorization: `Bearer ${jwt}` },
  },
});
```

### Row Level Security (RLS)

All tables must have RLS enabled. Policies use `auth.uid()` which returns the wallet address from JWT:

```sql
-- Enable RLS on all tables
ALTER TABLE pledges ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own pledges"
ON pledges FOR SELECT TO authenticated
USING ((SELECT auth.uid())::text = wallet_address);

CREATE POLICY "Users can create own pledges"
ON pledges FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid())::text = wallet_address);
```

**Important:**

- Always use `(SELECT auth.uid())` not just `auth.uid()` for performance
- Always specify `TO authenticated` to skip policy for anon requests
- Service role key bypasses RLS (used by crank service)

### Crank Service Logic

The crank processes expired pledges. It checks both on-chain state and DB completion data:

```typescript
// Crank service pattern
for (const pledge of expiredPledges) {
  // 1. Check on-chain status (source of truth for funds)
  const onChainPledge = await program.account.pledge.fetch(pledge.address);

  if (onChainPledge.status !== 'Active') {
    continue; // Already processed
  }

  // 2. Check DB for completion data (user may have checked items but not reported)
  const dbPledge = await supabase.from('pledges').select('*').eq('id', pledge.id).single();
  const completedItems = await supabase.from('daily_progress')
    .select('todos_completed')
    .eq('pledge_id', pledge.id);

  // 3. Calculate completion percentage from checked items
  const completionPercentage = calculateCompletionFromCheckedItems(dbPledge, completedItems);

  // 4. Call appropriate instruction based on completion
  if (completionPercentage === 100) {
    // 100% completion - full refund, NO FEE
    await program.methods.processCompletion(100).accounts({...}).rpc();
  } else if (completionPercentage > 0) {
    // Partial completion - proportional refund MINUS FEE
    await program.methods.processCompletion(completionPercentage).accounts({...}).rpc();
  } else {
    // 0% completion - full forfeiture
    await program.methods.processExpiredPledge().accounts({...}).rpc();
  }
}
```

**Key points:**

- On-chain status prevents double-processing
- DB completion data gives users credit for work done (even without explicit report)
- Crank uses service role key (bypasses RLS)
- Always verify on-chain before moving funds

### Data Sync (On-Chain ↔ Supabase)

**No indexer required for V1.** Use atomic frontend operations with reconciliation.

#### Confirm-Then-Write Pattern

All on-chain operations MUST wait for confirmation before DB write:

```typescript
// lib/sync/atomicOperations.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Connection } from '@solana/web3.js';

const PENDING_SYNC_KEY = 'pending_sync_operations';

interface PendingSyncOp {
  id: string;
  type: 'CREATE_PLEDGE' | 'REPORT_COMPLETION' | 'EDIT_PLEDGE';
  txSignature: string;
  data: Record<string, unknown>;
  createdAt: number;
}

export async function createPledgeAtomic(
  program: Program,
  supabase: SupabaseClient,
  params: CreatePledgeParams
): Promise<{ success: boolean; error?: string }> {
  const pledgeKeypair = Keypair.generate();

  // 1. Build and send transaction
  let txSignature: string;
  try {
    txSignature = await program.methods
      .createPledge(params.stakeAmount, params.deadline)
      .accounts({
        pledge: pledgeKeypair.publicKey,
        user: wallet.publicKey,
        // ... other accounts
      })
      .signers([pledgeKeypair])
      .rpc();
  } catch (err) {
    return { success: false, error: 'Transaction failed' };
  }

  // 2. WAIT for confirmation (critical!)
  const connection = program.provider.connection;
  const confirmation = await connection.confirmTransaction(txSignature, 'confirmed');

  if (confirmation.value.err) {
    return { success: false, error: 'Transaction not confirmed' };
  }

  // 3. Now safe to write DB
  const dbPayload = {
    on_chain_address: pledgeKeypair.publicKey.toString(),
    wallet_address: wallet.publicKey.toString(),
    name: params.name,
    stake_amount: params.stakeAmount.toNumber(),
    deadline: new Date(params.deadline * 1000).toISOString(),
    todos: params.todos,
    status: 'active',
  };

  const { error: dbError } = await supabase.from('pledges').insert(dbPayload);

  // 4. If DB fails, queue for retry (funds are safe on-chain)
  if (dbError) {
    await queueForRetry({
      id: crypto.randomUUID(),
      type: 'CREATE_PLEDGE',
      txSignature,
      data: dbPayload,
      createdAt: Date.now(),
    });
    // Return success - tx worked, DB will sync later
    return { success: true, error: 'DB sync pending' };
  }

  return { success: true };
}

async function queueForRetry(op: PendingSyncOp): Promise<void> {
  const existing = await AsyncStorage.getItem(PENDING_SYNC_KEY);
  const queue: PendingSyncOp[] = existing ? JSON.parse(existing) : [];
  queue.push(op);
  await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
}
```

#### Reconciliation on App Load

```typescript
// lib/sync/reconcile.ts
export async function reconcileUserPledges(
  program: Program,
  supabase: SupabaseClient,
  walletAddress: PublicKey
): Promise<void> {
  // 1. Process any pending sync operations first
  await processPendingSyncQueue(supabase);

  // 2. Fetch on-chain pledges for this user
  const onChainPledges = await program.account.pledge.all([
    {
      memcmp: {
        offset: 8, // After discriminator
        bytes: walletAddress.toBase58(),
      },
    },
  ]);

  // 3. Fetch DB pledges
  const { data: dbPledges } = await supabase
    .from('pledges')
    .select('on_chain_address, status')
    .eq('wallet_address', walletAddress.toString());

  const dbPledgeMap = new Map(
    dbPledges?.map((p) => [p.on_chain_address, p]) ?? []
  );

  // 4. Reconcile differences
  for (const onChain of onChainPledges) {
    const address = onChain.publicKey.toString();
    const dbRecord = dbPledgeMap.get(address);

    if (!dbRecord) {
      // On-chain exists but not in DB - create record
      await supabase.from('pledges').insert({
        on_chain_address: address,
        wallet_address: walletAddress.toString(),
        stake_amount: onChain.account.stakeAmount.toNumber(),
        deadline: new Date(onChain.account.deadline.toNumber() * 1000).toISOString(),
        status: mapOnChainStatus(onChain.account.status),
        // Note: some metadata (name, todos) may be lost if only on-chain exists
        name: 'Recovered Pledge',
        todos: [],
      });
    } else {
      // Both exist - check if status needs sync
      const onChainStatus = mapOnChainStatus(onChain.account.status);
      if (dbRecord.status !== onChainStatus) {
        await supabase
          .from('pledges')
          .update({ status: onChainStatus })
          .eq('on_chain_address', address);
      }
    }
  }
}

async function processPendingSyncQueue(supabase: SupabaseClient): Promise<void> {
  const stored = await AsyncStorage.getItem(PENDING_SYNC_KEY);
  if (!stored) return;

  const queue: PendingSyncOp[] = JSON.parse(stored);
  const remaining: PendingSyncOp[] = [];

  for (const op of queue) {
    try {
      if (op.type === 'CREATE_PLEDGE') {
        const { error } = await supabase.from('pledges').insert(op.data);
        if (error) {
          remaining.push(op); // Keep in queue for next attempt
        }
      }
      // Handle other operation types...
    } catch {
      remaining.push(op);
    }
  }

  if (remaining.length > 0) {
    await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(remaining));
  } else {
    await AsyncStorage.removeItem(PENDING_SYNC_KEY);
  }
}

function mapOnChainStatus(status: { active?: {}; reported?: {}; completed?: {}; forfeited?: {} }): string {
  if (status.active) return 'active';
  if (status.reported) return 'reported';
  if (status.completed) return 'completed';
  if (status.forfeited) return 'forfeited';
  return 'unknown';
}
```

#### Edit Pledge (Special Handling)

Edit is the trickiest operation - user pays penalty, so we must be extra careful:

```typescript
// lib/sync/atomicOperations.ts
export async function editPledgeAtomic(
  program: Program,
  supabase: SupabaseClient,
  params: EditPledgeParams
): Promise<{ success: boolean; error?: string }> {
  // Store intended edit BEFORE transaction (in case app crashes)
  const pendingEdit = {
    pledgeAddress: params.pledgeAddress,
    newTodos: params.newTodos,
    timestamp: Date.now(),
  };
  await AsyncStorage.setItem(
    `pending_edit_${params.pledgeAddress}`,
    JSON.stringify(pendingEdit)
  );

  // 1. Send transaction (pays 10% penalty)
  let txSignature: string;
  try {
    txSignature = await program.methods
      .editPledge(params.newTodos)
      .accounts({ /* ... */ })
      .rpc();
  } catch (err) {
    // Tx failed - no penalty paid, clean up pending edit
    await AsyncStorage.removeItem(`pending_edit_${params.pledgeAddress}`);
    return { success: false, error: 'Transaction failed' };
  }

  // 2. Wait for confirmation
  const confirmation = await connection.confirmTransaction(txSignature, 'confirmed');
  if (confirmation.value.err) {
    await AsyncStorage.removeItem(`pending_edit_${params.pledgeAddress}`);
    return { success: false, error: 'Transaction not confirmed' };
  }

  // 3. Penalty paid - MUST update DB (retry until success)
  let dbSuccess = false;
  let attempts = 0;
  const maxAttempts = 3;

  while (!dbSuccess && attempts < maxAttempts) {
    const { error } = await supabase
      .from('pledges')
      .update({ todos: params.newTodos })
      .eq('on_chain_address', params.pledgeAddress);

    if (!error) {
      dbSuccess = true;
      await AsyncStorage.removeItem(`pending_edit_${params.pledgeAddress}`);
    } else {
      attempts++;
      await new Promise((r) => setTimeout(r, 1000 * attempts)); // Backoff
    }
  }

  if (!dbSuccess) {
    // Queue for reconciliation - user will see update on next load
    await queueForRetry({
      id: crypto.randomUUID(),
      type: 'EDIT_PLEDGE',
      txSignature,
      data: { pledgeAddress: params.pledgeAddress, todos: params.newTodos },
      createdAt: Date.now(),
    });
  }

  return { success: true };
}
```

#### When to Call Reconciliation

```typescript
// In app initialization (e.g., _layout.tsx or auth context)
useEffect(() => {
  if (wallet.connected && supabase) {
    reconcileUserPledges(program, supabase, wallet.publicKey);
  }
}, [wallet.connected]);

// After network reconnection
NetInfo.addEventListener((state) => {
  if (state.isConnected && wallet.connected) {
    reconcileUserPledges(program, supabase, wallet.publicKey);
  }
});
```

### MWA Transaction Signing

```typescript
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

await transact(async (wallet) => {
  const authResult = await wallet.authorize({
    cluster: 'mainnet-beta',
    identity: APP_IDENTITY,
  });

  const signedTxs = await wallet.signTransactions({
    transactions: [transaction],
  });

  return signedTxs[0];
});
```

---

## Important Constraints

### Mobile Wallet Adapter

- Use `@solana-mobile/mobile-wallet-adapter-protocol-web3js`
- No deep linking needed for external wallets (MWA handles it)
- Users must have existing Solana wallet installed

### Anchor Version

- Use **Anchor v0.28.0** in frontend (React Native compatibility)
- Use **Anchor 0.31.0** for program development

### Goal Duration Types

- **Duration presets (daily, weekly, monthly) are UX-only** - they exist purely for user convenience
- The **Anchor program only cares about the end date (deadline)** - it has no knowledge of duration types
- These presets help users quickly set common timeframes and organize goals in the UI
- The frontend stores duration type in Supabase for display purposes, but it's never sent on-chain

### Polyfills Required (React Native)

```javascript
// In app entry point, before other imports
import { Buffer } from 'buffer';
global.Buffer = Buffer;
import 'react-native-get-random-values';
global.TextEncoder = require('text-encoding').TextEncoder;
```

---

## Database Conventions

### Supabase

- Use migrations for all schema changes
- Edge Functions for crank service and notifications
- pg_cron for scheduled jobs
- RLS policies for user data isolation

### Sync Strategy

- **On-chain is source of truth** for pledge status and funds
- **Supabase stores** metadata, templates, user preferences, daily progress
- **No indexer needed** - use atomic frontend operations + reconciliation
- **Crank verifies on-chain** before any fund movement
- **See "Data Sync" in Key Patterns** for implementation details

---

## Admin Operations

No admin dashboard - use scripts with admin wallet:

```bash
# Example admin script usage
ts-node scripts/update-fee.ts --fee-bps 100 --fee-cap-usd 1
ts-node scripts/update-split.ts --treasury 70 --charity 30
```

---

## Environment Variables

```env
# Mobile App
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_HELIUS_RPC_URL=
EXPO_PUBLIC_PROGRAM_ID=

# Supabase Functions
HELIUS_API_KEY=
PROGRAM_ID=
CRANK_KEYPAIR=  # Base58 encoded

# Development
ANCHOR_PROVIDER_URL=
ANCHOR_WALLET=
```

---

## Testing

### Anchor Program

```bash
cd packages/anchor
anchor test
```

### Mobile App

```bash
cd apps/mobile
npm test
```

### Local Development

1. Run local validator: `solana-test-validator`
2. Deploy program: `anchor deploy`
3. Start Supabase locally: `supabase start`
4. Run mobile app: `npx expo start`

---

## Common Tasks

### Add New Instruction

1. Create `contexts/new_instruction.rs`
2. Add to `contexts/mod.rs`
3. Add thin handler to `lib.rs`
4. Create `tests/newInstruction.ts`
5. Add to main test runner

### Add New Account Type

1. Create `state/new_account.rs`
2. Add related events in same file
3. Add to `state/mod.rs`
4. Add Space implementation

### Add New Translation

1. Add key to `locales/en.json`
2. Add translations to other locale files
3. Use with `t('key')` in components

---

## Fee Structure

- **100% completion:** No fee - full stake returned
- **Partial completion (1-99%):** 1% fee on returned amount
- **0% completion:** Full forfeiture to treasury/charity

No subscription model - fees only apply to partial completions.

---

## V2 Features (Planned)

- **GitHub Integration:** Verify commit-based goals automatically via GitHub API
- **X (Twitter) Integration:** Verify posting/engagement goals via X API
- DB schema includes `github_username` and `x_username` fields for future use
- **Yield Earning:** Consider allowing staked USDC to earn yield via DeFi lending (Kamino/MarginFi)
  - Option A: User opt-in yield on individual pledges (complex - requires CPI integration)
  - Option B: Treasury earns yield on accumulated funds (simpler - off-chain implementation)

---

## References

- Anchor file patterns: `/Users/timk/projects/solana/twizzin/twizzin-be2`
- i18n patterns: `/Users/timk/rekt-react-native`
- Solana Mobile docs: https://docs.solanamobile.com
- Anchor docs: https://www.anchor-lang.com/docs
