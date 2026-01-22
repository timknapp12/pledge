# Pledge - Product Requirements Document

## Overview

Pledge is a Solana mobile dApp (Android only) that enables users to set goals and stake tokens as commitment. Users create time-bound goals with to-do lists, stake USDC tokens, and self-report their completion. 100% completion returns full stake; partial completion returns proportional amount minus fee; failure forfeits tokens to treasury/charity.

## Core Concept

- User creates a goal with a timeframe (1 day, 1 week, 1 month, or custom)
- User stakes USDC tokens
- User tracks progress by checking off to-do items
- At deadline (+1 day grace period), user reports completion percentage
- 100% completion = full refund (no fee)
- Partial completion = proportional refund minus fee
- 0% completion = full forfeiture

---

## Goals & Pledges

### Timeframes

- **Presets:** 1 day, 1 week, 1 month
- **Custom:** User-defined start/end dates

**Note:** These duration presets (daily, weekly, monthly) are purely for UX convenience. They provide quick buttons for users to set common timeframes and help organize/display goals in the UI. The Anchor program only stores and cares about the **end date (deadline)** - it has no concept of duration types.

### To-Do Structure

- Each pledge contains a list of to-do items
- To-dos can apply to:
  - All days in the timeframe
  - Specific days of the week (e.g., Mon/Wed/Fri)
  - or just a list with no day assignments
- Users check off items as they complete them
- Day-specific additions allowed (e.g., "Meal prep" only on Sunday)

### Multiple Concurrent Pledges

- Users can have multiple active pledges simultaneously
- Example: Weekly workout pledge + daily study pledge running in parallel

### Templates

- Users can save goals as reusable templates
- Dropdown shows past/saved goals for quick selection
- Templates store: name, to-do items, default timeframe
- Smart defaults: Remember last used timeframe and stake amount
- Quick repeat: After completing a goal, offer "Repeat this pledge?" button

---

## Token Economics

### Staking

- **Supported token:** USDC only (V1)
- **No min/max limits** on stake amount or timeframe
- Tokens held in PDA vault (program-controlled)
- Future: possible SOL support in V2 (requires price oracle)

### Completion Fee Structure

- **100% completion:** No fee - full stake returned
- **Partial completion (1-99%):** 1% fee on returned amount
- **0% completion:** Full forfeiture (no refund)
- No price oracle needed (token is already USD-denominated)
- Admin can update fee percentage

### Forfeiture Distribution

- **70%** to Treasury wallet
- **30%** to Charity wallet
- Percentages adjustable by admin
- Charity wallet is hardcoded, admin-controlled

### Edit Penalty

- Users can edit goals after pledging
- **10% of stake** sent to treasury/charity as penalty
- verify that is is successful on chain before updating db

### Partial Completion

- Users can claim partial refund based on completion percentage
- **Hybrid approach:**
  - Auto-calculate percentage from checked items (default)
  - User can override with slider if they feel it's inaccurate

---

## Reporting & Deadlines

### Grace Period

- **1 day** after deadline to submit report
- If no report after grace period: auto-forfeit via crank
- But if all goals are checked off at time of grace period without reporting, auto-complete with full refund (no fee)

### Self-Reporting

- Honor system - user self-reports completion
- Reports completion percentage (0-100%)
- Partial completion = partial refund

### On-Chain State (Source of Truth)

```
PledgeAccount:
├── status: enum { Active, Reported, Completed, Forfeited }
├── reported_at: Option<i64>
├── completion_percentage: Option<u8>
├── deadline: i64
└── ...
```

- Crank service checks **on-chain status** before processing
- Crank also checks DB in case user completed tasks but forgot to report:
  - 100% completion → full refund (no fee)
  - Partial completion → proportional refund minus fee
- Prevents accidental forfeiture from DB sync issues

---

## Points & Gamification

### Points System

- Points earned on goal completion
- **Formula:** Base points × USD value multiplier × streak bonus
- Streak bonuses (bowling-style with strikes/spares):
  - 2 in a row: 1.5x multiplier
  - 3+ in a row: 2x multiplier
  - Breaking streak resets multiplier

### Analytics (Track from Day 1)

- Completion streaks
- Success rate charts
- Total pledged over time
- Points history

### Future Social (Architect Now)

DB fields to include for future features:

- `pfp` (profile picture)
- `username`
- `ranking`
- `points`
- `public_goals` (boolean per goal)

---

## Notifications

### Triggers

- Reminder before deadline (user-configurable: 1 hour, 1 day, etc.)
- Deadline reached
- Time to report (after deadline)
- Goal completed/failed confirmation

### Implementation

- Supabase pg_cron + Edge Functions
- User configures reminder preferences
- Expo push notifications service
- dev must set up firebase project for android config

---

## Crank Service

### Purpose

- Process expired pledges without user signature
- Run periodically via Supabase pg_cron

### Flow

1. pg_cron triggers Edge Function
2. Edge Function queries for pledges past deadline + grace
3. For each expired pledge:
   - Read **on-chain status** (source of truth)
   - If `status == Active` → call `process_expired_pledge` instruction
   - If `status == Reported` → call `process_completion` instruction
4. Program distributes funds accordingly

### Safety

- Always verify on-chain state before acting
- Never rely solely on DB state for fund distribution

---

## UI/UX

### Tab Structure (3 tabs)

```
┌─────────────────────────────────────────┐
│  [Home]     [History]     [Profile]     │
└─────────────────────────────────────────┘
```

| Tab         | Content                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------- |
| **Home**    | Active pledges, progress rings (Apple Fitness style), today's to-dos if relevant, quick actions |
| **History** | Past pledges, streaks, analytics/charts, points                                                 |
| **Profile** | Settings, templates, wallet info, connected accounts                                            |

### Key Screens

| Screen        | Access                      | Purpose                              |
| ------------- | --------------------------- | ------------------------------------ |
| Create Pledge | FAB or button               | Goal creation with template dropdown |
| Pledge Detail | Tap pledge card             | View/edit pledge, check off to-dos   |
| Report        | From detail or notification | Submit completion percentage         |
| Onboarding    | First launch                | Wallet connect via MWA               |

### Progress Rings

- Animated closing rings like Apple Fitness
- Visual representation of daily/weekly progress

### Goal Creation UX

```
┌─────────────────────────────────────────────────────┐
│  New Pledge                                         │
├─────────────────────────────────────────────────────┤
│  ▼ [Select from saved goals...]        [+ New]     │
├─────────────────────────────────────────────────────┤
│  Timeframe: [1 Day] [1 Week] [1 Month] [Custom]    │
├─────────────────────────────────────────────────────┤
│  Days:  [✓ Everyday]                               │
│         M  T  W  T  F  S  S                        │
├─────────────────────────────────────────────────────┤
│  To-Dos (all selected days):                       │
│    ☐ Item 1                                        │
│    ☐ Item 2                                        │
│    [+ Add item]                                    │
├─────────────────────────────────────────────────────┤
│  Day-specific:              [+ Add to specific day]│
├─────────────────────────────────────────────────────┤
│  Stake: [____] USDC                                │
│  [Create Pledge]                                   │
└─────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### Monorepo Structure

```
pledge/
├── apps/
│   └── mobile/              # React Native (Expo)
├── packages/
│   ├── anchor/              # Solana program
│   └── shared/              # Shared types, constants
├── supabase/
│   ├── migrations/
│   └── functions/           # Edge Functions (crank, notifications)
├── scripts/                 # Admin scripts
├── CLAUDE.md
├── PRD.md
├── package.json             # Workspace root
└── turbo.json               # Turborepo config
```

### Tech Stack

| Layer             | Technology                                                     |
| ----------------- | -------------------------------------------------------------- |
| **Mobile**        | React Native (Expo), Android only, **no web components**       |
| **UI**            | Custom components, styled-components, pure native (no WebViews)|
| **Auth**          | Supabase + Sign in with Solana (MWA)                           |
| **Wallet**        | Solana Mobile Wallet Adapter                                   |
| **Blockchain**    | Anchor 0.31.0, @solana/web3.js v1.x, @coral-xyz/anchor v0.28.0 |
| **RPC**           | Helius (free tier)                                             |
| **Database**      | Supabase (Postgres)                                            |
| **Notifications** | Supabase pg_cron + Edge Functions + Expo push notifications    |
| **i18n**          | i18next (English + Spanish test strings)                       |

### i18n (Internationalization)

All user-facing strings must be internationalized:

```typescript
// Wrap all UI strings in t()
import { useTranslation } from 'react-i18next';
const { t } = useTranslation();

<Text>{t('Maximum Amount')}</Text>
```

```json
// Add to src/i18n/locales/en.json
{
  "Maximum Amount": "Maximum Amount",
  "Creating your account...": "Creating your account..."
}
```

- Use exact string as key (not camelCase)
- Add to `en.json` when creating any new UI text
- Spanish `es.json` for testing translations

### Anchor Program Structure

```
programs/pledge/src/
├── lib.rs                 # Thin instruction handlers
├── constants.rs           # All constants
├── errors.rs              # All error codes
├── contexts/              # One file per instruction
│   ├── mod.rs
│   ├── initialize.rs
│   ├── create_pledge.rs
│   ├── report_completion.rs
│   ├── process_completion.rs
│   ├── process_expired.rs
│   ├── edit_pledge.rs
│   └── admin/
│       ├── update_config.rs
│       └── update_fees.rs
├── state/                 # One file per account + events
│   ├── mod.rs
│   ├── config.rs
│   ├── pledge.rs
│   └── user.rs
└── utils/
    ├── mod.rs
    ├── fees.rs
    └── points.rs

tests/
├── pledge.ts              # Main test runner
├── createPledge.ts
├── reportCompletion.ts
└── ...
```

### File Guidelines

- Files should be **precise, short, and clean**
- One instruction per context file
- One account type per state file
- Co-locate events with their associated accounts
- Unit tests in utils files
- Thin handlers in lib.rs that delegate to impl blocks

---

## Admin Controls

### On-Chain (No Dashboard)

- Admin wallet as program authority
- Scripts in codebase for admin operations:
  - Update fee percentage
  - Update treasury/charity split
  - Update treasury/charity wallets
  - Pause/unpause program

### Configurable Parameters

| Parameter              | Default | Adjustable |
| ---------------------- | ------- | ---------- |
| Partial completion fee | 1%      | Yes        |
| Treasury split         | 70%     | Yes        |
| Charity split          | 30%     | Yes        |
| Edit penalty           | 10%     | Yes        |
| Grace period           | 1 day   | Yes        |

---

## Authentication & Security

### Sign in with Solana (SIWS)

Authentication flow without a traditional server:

1. User connects wallet via Mobile Wallet Adapter (MWA)
2. User signs SIWS message with wallet
3. App sends signed message to Supabase Edge Function (`verify-wallet`)
4. Edge Function verifies signature matches public key
5. Edge Function creates custom JWT with wallet address as `sub` claim
6. Frontend uses JWT for all authenticated Supabase requests

### Row Level Security (RLS)

All tables protected by RLS policies. No server needed - security enforced at database level:

```sql
-- Example: Users can only access their own pledges
CREATE POLICY "Users can view own pledges"
ON pledges FOR SELECT TO authenticated
USING ((SELECT auth.uid())::text = wallet_address);
```

**Key principles:**

- RLS enabled on ALL tables in public schema
- `auth.uid()` returns wallet address from JWT
- Service role key (crank only) bypasses RLS
- Always use `(SELECT auth.uid())` for performance

### Edge Functions

| Function            | Purpose                          | Auth         |
| ------------------- | -------------------------------- | ------------ |
| `verify-wallet`     | Verify SIWS signature, issue JWT | Public       |
| `process-crank`     | Process expired pledges          | Service role |
| `send-notification` | Send push notifications          | Service role |

---

## Database Schema (Supabase)

**Note:** All tables have RLS enabled. Policies restrict access based on `auth.uid()` (wallet address from JWT).

### Tables

```sql
-- Users (created on first SIWS auth)
users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text UNIQUE NOT NULL,
  username text,
  pfp_url text,
  points bigint DEFAULT 0,
  streak_current int DEFAULT 0,
  streak_best int DEFAULT 0,
  github_username text,           -- V2: for verified goals
  x_username text,                -- V2: for verified goals
  notification_preferences jsonb,
  created_at timestamptz
)

-- Goal Templates
templates (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  name text,
  todos jsonb,  -- [{text, days: [0-6] or null for all}]
  default_timeframe text,
  created_at timestamptz
)

-- Pledges (mirror on-chain + extra metadata)
pledges (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  on_chain_address text UNIQUE,
  name text,
  timeframe_type text,
  start_date timestamptz,
  end_date timestamptz,
  deadline timestamptz,
  stake_amount bigint,  -- in USDC (6 decimals)
  todos jsonb,
  status text,  -- mirrors on-chain
  completion_percentage int,
  points_earned int,
  created_at timestamptz
)

-- Daily Progress
daily_progress (
  id uuid PRIMARY KEY,
  pledge_id uuid REFERENCES pledges,
  date date,
  todos_completed jsonb,  -- [todo_index, ...]
  created_at timestamptz
)
```

---

## Out of Scope (V1)

- iOS support
- SOL or other SPL token support (USDC only for V1)
- Social features (friends, public goals, accountability partners)
- Leaderboards
- Admin dashboard UI
- Multiple charity options

---

## V2 Features (Planned)

### Verified Goals via External Integrations

Enable automatic goal verification through connected accounts:

**GitHub Integration:**

- User connects GitHub account via OAuth
- Create pledges like "Make X commits per day" or "Push to repo Y daily"
- Crank verifies commits via GitHub API instead of self-reporting
- Prevents gaming - actual commits required, not just self-reporting

**X (Twitter) Integration:**

- User connects X account via OAuth
- Create pledges like "Post X times per day" or "Engage with Y posts daily"
- Crank verifies posts/engagement via X API
- Automatic verification removes honor system for these goal types

**Implementation Notes:**

- Store OAuth tokens securely (encrypted in Supabase)
- Edge Functions query external APIs during crank processing
- Hybrid goals: some tasks verified, some self-reported
- Rate limiting considerations for API calls

---

## Success Metrics

- User retention (% returning after first pledge)
- Pledge completion rate (100% vs partial vs forfeit)
- Average stake amount
- Streak length distribution
- Fee revenue from partial completions
