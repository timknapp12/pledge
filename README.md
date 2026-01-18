# Pledge

A Solana mobile dApp (Android only) that enables users to stake USDC tokens on personal goals. Users create time-bound goals with to-do lists, track progress, and self-report completion. 100% completion returns full stake; partial completion returns proportional amount minus fee; failure forfeits tokens to treasury/charity.

## Features

- **Goal Pledges**: Create time-bound goals (1 day, 1 week, 1 month, or custom)
- **USDC Staking**: Stake tokens as commitment to your goals
- **To-Do Tracking**: Track progress with daily to-do lists
- **Templates**: Save and reuse goal templates
- **Points & Streaks**: Gamification with points and streak bonuses
- **Push Notifications**: Reminders via Expo push notifications

## Fee Structure

| Completion | Fee | Result |
|------------|-----|--------|
| 100% | None | Full stake returned |
| 1-99% | 1% | Proportional refund minus fee |
| 0% | N/A | Full forfeiture (70% treasury, 30% charity) |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile | React Native (Expo), Android only |
| UI | Custom components, styled-components |
| Auth | Supabase + Sign in with Solana (SIWS) |
| Wallet | Solana Mobile Wallet Adapter (MWA) |
| Blockchain | Anchor 0.30.1 |
| Frontend Solana | @solana/web3.js v1.x, @coral-xyz/anchor v0.28.0 |
| RPC | Helius |
| Database | Supabase (Postgres) |
| Notifications | Supabase pg_cron + Edge Functions + Expo push |

## Project Structure

```
pledge/
├── apps/
│   └── mobile/              # React Native Expo app
├── packages/
│   ├── anchor/              # Solana program
│   └── shared/              # Shared types & constants
├── supabase/
│   ├── migrations/          # Database migrations
│   └── functions/           # Edge Functions
├── scripts/                 # Admin scripts
├── PRD.md                   # Product requirements
└── CLAUDE.md                # Development instructions
```

## Getting Started

### Prerequisites

- Node.js >= 18
- Rust & Cargo
- Solana CLI
- Anchor CLI 0.30.1
- Android device or emulator with Solana wallet app

### Installation

```bash
# Install dependencies
npm install

# Build Anchor program
cd packages/anchor
anchor build

# Start mobile app
cd apps/mobile
npx expo start
```

### Local Development

1. Run local validator: `solana-test-validator`
2. Deploy program: `cd packages/anchor && anchor deploy`
3. Start Supabase locally: `supabase start`
4. Run mobile app: `cd apps/mobile && npx expo start`

## V2 Features (Planned)

- **GitHub Integration**: Verify commit-based goals automatically
- **X (Twitter) Integration**: Verify posting/engagement goals automatically

## License

MIT
