# Pledge Mobile App - Progress Tracker

## Completed

- [x] **i18n Setup**
  - i18next with expo-localization
  - English and Spanish locale files
  - I18nProvider context

- [x] **Anchor Client Integration**
  - IDL from anchor build
  - Constants (program ID, USDC mint, seeds)
  - Connection setup (Helius RPC)
  - PDA derivation utilities
  - TypeScript types for accounts
  - Transaction builders (createPledge, reportCompletion)
  - MWA signing utilities

- [x] **Reconciliation System**
  - AsyncStorage queue for failed DB writes
  - Reconciliation logic (on-chain ↔ Supabase)
  - Auto-reconcile hook (app launch, background return, network reconnect)

- [x] **Environment Configuration**
  - app.config.ts with environment-based settings
  - HELIUS_API_KEY for RPC URL construction
  - Devnet/mainnet switching

- [x] **Auth Flow (Sign in with Solana)** ✅
  - verify-wallet Edge Function deployed
  - AuthContext with wallet connection, SIWS signing
  - JWT storage in expo-secure-store
  - Authenticated Supabase client creation
  - Session restoration on app launch

- [x] **Supabase Client & Hooks** ✅
  - React Query provider added to app (`_layout.tsx`)
  - `usePledges` - fetch user's pledges
  - `useActivePledges` - fetch active pledges only
  - `usePledge` - fetch single pledge
  - `useDailyProgress` / `useTodayProgress` - fetch daily progress
  - `useUpdateDailyProgress` - mutation for checking todos
  - `useCreatePledgeInDb` - mutation for DB write after on-chain
  - `useUpdatePledgeStatus` - mutation for status updates
  - `useTemplates` / `useCreateTemplate` - template management
  - Helper functions: `calculateCompletionPercentage`, `formatUsdcAmount`, `parseUsdcToLamports`

- [x] **Tab Structure Update** ✅
  - Renamed tabs: Home, History, Profile
  - Updated CustomTabBar icons (home, time, person)
  - Renamed route files (two.tsx → history.tsx, three.tsx → profile.tsx)

- [x] **Home Tab** ✅
  - Pledges list with pull-to-refresh
  - Empty state for new users
  - Connect wallet screen when not authenticated
  - Pledge cards with status, deadline, stake amount, progress
  - FAB to create new pledge
  - Navigation to pledge detail

- [x] **History Tab** ✅
  - Stats section (Total Pledged, Success Rate)
  - Past pledges list (Completed, Forfeited)
  - Empty state when no past pledges
  - Pull-to-refresh

- [x] **Profile Tab** ✅
  - Connected wallet card with address
  - Theme selector
  - Settings section (Templates, Notifications - TODO handlers)
  - About section with version
  - Sign out with confirmation

- [x] **Create Pledge Screen** ✅
  - Route: `/create-pledge`
  - Goal name input
  - Timeframe selection (1 Day, 1 Week, 1 Month)
  - Dynamic todo list (add/remove tasks)
  - Stake amount input (USDC)
  - Summary card
  - Creates pledge on-chain via MWA
  - Saves to Supabase after confirmation
  - Validation (name, todos, stake required)

- [x] **Pledge Detail Screen** ✅
  - Route: `/pledge/[id]`
  - Displays pledge info (name, stake, deadline, time remaining)
  - Status badge
  - Progress bar
  - Todo list with checkboxes
  - Check/uncheck saves to daily_progress
  - Report Completion button (shows after deadline)
  - Reports completion on-chain via MWA

- [x] **Translations** ✅
  - Added all new strings to en.json and es.json
  - Home, History, Profile tabs
  - Create pledge flow
  - Pledge detail screen
  - Common UI elements

- [x] **TypeScript Clean** ✅
  - All type errors fixed
  - `npx tsc --noEmit` passes

---

## In Progress

(None currently)

---

## Session Notes (Jan 28, 2025)

**What was built:**
- Complete tab structure (Home, History, Profile)
- Full pledge creation flow (UI → on-chain → Supabase)
- Pledge detail with todo checkboxes and daily progress
- Report completion flow

**What needs testing:**
- The app needs to be tested on a real device with MWA
- Ensure Supabase tables exist and match schema
- Test full pledge lifecycle: create → check todos → report completion

**Known limitations:**
- No edit pledge functionality yet
- No templates screen yet
- Notifications not implemented

---

## To Do

### 1. Testing & Bug Fixes
- [ ] Test full create pledge flow on device
- [ ] Test report completion flow
- [ ] Test daily progress persistence
- [ ] Handle edge cases (network errors, wallet disconnection)

### 2. Edit Pledge
- [ ] Edit pledge screen/modal
- [ ] Show 10% penalty warning
- [ ] Build editPledge transaction
- [ ] Update DB after on-chain confirmation

### 3. Templates
- [ ] Templates list screen
- [ ] Create template from pledge
- [ ] Use template when creating pledge

### 4. Notifications (Future)
- [ ] Firebase project setup
- [ ] Expo push notifications config
- [ ] Supabase pg_cron for scheduled notifications
- [ ] Edge Function to send notifications

---

## Future (V2)

- [ ] GitHub integration for commit-based goals
- [ ] X (Twitter) integration for posting goals
- [ ] Push notifications for reminders
- [ ] Yield earning on staked USDC
- [ ] Progress rings (Apple Fitness style)
- [ ] Day-specific todo scheduling
- [ ] Custom date picker for pledge timeframe
