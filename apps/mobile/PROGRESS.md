# Pledge Mobile App - Progress Tracker

## Completed

- [x] **i18n Setup**

  - i18next with expo-localization
  - English, Spanish, and French locale files
  - I18nProvider context
  - Personality-aware strings via `tp()` hook (`_carrot`/`_stick` variants)

- [x] **Anchor Client Integration**

  - IDL from anchor build
  - Constants (program ID, USDC mint, seeds)
  - Connection setup (Helius RPC)
  - PDA derivation utilities
  - TypeScript types for accounts
  - Transaction builders (createPledge, reportCompletion, reportAndSettle)
  - MWA signing utilities

- [x] **Reconciliation System**

  - Three-layer sync: frontend confirm-then-write → Helius webhook indexer → daily reconciliation
  - Frontend lightweight reconciliation on app launch (on-chain ↔ Supabase status comparison)
  - Removed legacy AsyncStorage retry queue (replaced by indexer)

- [x] **Helius Webhook Indexer** ✅

  - Supabase Edge Function (`supabase/functions/indexer/index.ts`)
  - Receives enhanced transaction data from Helius webhooks within 1-5s
  - Parses 5 Anchor events: PledgeCreated, PledgeEdited, CompletionReported, PledgeCompleted, PledgeForfeited
  - Idempotent via `processed_transactions` table (prevents duplicate processing)
  - Hardcoded SHA-256 event discriminators (verified in tests)
  - Auth via WEBHOOK_SECRET header
  - Error responses sanitized (generic 500, details logged server-side)
  - 18 Deno tests covering discriminators, event parsing, base58, log parsing, idempotency

- [x] **Daily Reconciliation** ✅

  - Supabase Edge Function (`supabase/functions/daily-reconcile/index.ts`)
  - Server-side safety net — runs once per day via pg_cron
  - Fetches all on-chain pledge accounts via getProgramAccounts
  - Filters by 8-byte Anchor account discriminator (not data length)
  - Compares with Supabase DB, fixes status mismatches, creates recovered records
  - Auth via FUNCTION_SECRET Bearer token
  - Error responses sanitized
  - 9 Deno tests covering discriminator verification, deserialization, filtering
  - Deployment docs: `docs/indexer.md`

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
  - Streak card (Current Streak, Best Streak)
  - Past pledges list (Completed, Forfeited)
  - Empty state when no past pledges
  - Pull-to-refresh

- [x] **Profile Tab** ✅

  - Connected wallet card with address
  - Theme selector (Light/Dark/System) with animated pill indicator
  - Personality selector (Carrot/Stick)
  - Settings section (Templates, Notifications, FAQs, Terms & Conditions, Privacy Policy)
  - About section with version
  - Sign out with confirmation

- [x] **FAQ Screen** ✅

  - Animated accordion with Reanimated (expand/collapse with chevron rotation)
  - Personality-aware Q&A via `tp()` — carrot and stick variants
  - Hidden measurer pattern for dynamic content height
  - Full card is tap target

- [x] **Terms & Conditions Screen** ✅

  - English-only legal copy
  - Route: `/terms`

- [x] **Privacy Policy Screen** ✅

  - English-only legal copy
  - Route: `/privacy`

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
  - Report & Settle button (available any time for Active pledges)
  - Self-settle: bundles report_completion + process_completion in one tx via MWA
  - Status goes directly to Completed/Forfeited (skips Reported intermediate state)
  - Transaction signature link to Solana Explorer for settled pledges

- [x] **Translations** ✅

  - All user-facing strings in en.json, es.json, fr.json
  - Personality-variant strings (`_carrot`/`_stick`) for FAQ, empty states, notifications
  - Home, History, Profile tabs
  - Create pledge flow
  - Pledge detail screen
  - Common UI elements

- [x] **TypeScript Clean** ✅

  - All type errors fixed
  - `npx tsc --noEmit` passes

- [x] **V2 Todo System (PledgeTodos)** ✅

  - New `PledgeTodos` format: `{ goals: string[], daily: Record<string, string[]> }` — per-date task storage
  - Replaces old `Todo[]` with day-of-week indices (couldn't differentiate same weekday across weeks)
  - `TaskDefinition` + `TaskSchedule` types for creation form state
  - `computePledgeTodos()` generates per-date tasks from schedule presets and date range
  - Helpers: `getDailyTasksForDate()`, `getGoals()`, `getTotalTaskCount()`
  - Supports up to 90 days of daily tracking (`MAX_DAILY_TRACKING_DAYS = 90`)
  - Removed all legacy `Todo[]` backward compat code (`isLegacyTodos`, `isPledgeTodos`, union types)
  - Deleted unused `DailyTodosSheet.tsx`

- [x] **Create Pledge Screen V2** ✅

  - Reordered form: Schedule → Action Items → Goal Name (optional) → Stake Amount → Summary
  - Goal Name optional — fallback: date range for multi-day (`"Feb 24 - Mar 3"`), first task text for 1-day
  - `TodoSection` rewritten with inline schedule presets: Not daily, Every day, Weekdays, Weekends, Custom
  - Custom day-of-week chips: [S][M][T][W][T][F][S] (Sunday first)
  - Schedule persists between task additions
  - Shows schedule badge per task (e.g., "Weekdays", "Sun, Wed, Sat")
  - Daily options only show for 2–90 day pledges
  - Duration changes auto-convert daily tasks to goals when out of range
  - Simplified `ScheduleCard` (removed daily tracking row)

- [x] **HomeScreen Daily Task Hub** ✅

  - Segment control to switch between Tasks and Pledges views (defaults to Tasks)
  - New `SegmentControl` component with animated indicator (reanimated spring)
  - `DailyTasksView`: aggregated daily tasks across all active pledges, grouped by pledge
  - Today/Yesterday toggle with date pills
  - One-tap task checking with haptic feedback
  - Select all / deselect all per pledge group
  - Pledge header tappable to navigate to detail screen
  - Shows completion count per pledge (e.g., "3/5 done")
  - Empty state when no tasks for the day
  - New `useAllDailyProgress(date)` hook for cross-pledge daily progress

- [x] **Pledge Detail Screen V2** ✅

  - Uses `getDailyTasksForDate()` for today's task rendering
  - Separate Goals section with flag icon (non-checkable display)
  - Progress calculation based on daily tasks only
  - Updated `calculateCompletionPercentage` for PledgeTodos format

- [x] **StakeAmountSheet** ✅

  - Bottom sheet with USDC amount input, preset buttons ($5/$10/$25/$50/$100/Max)
  - Reads connected wallet USDC balance via `useUsdcBalance` hook
  - Replaced inline TextInput in create pledge form with tappable card + sheet
  - Keyboard handling: input at top, `keyboardDidHide` snap-back, dismiss on close/confirm

- [x] **Templates** ✅

  - Save templates from create pledge form (tasks + schedule + duration preset)
  - Templates list screen accessible from Profile → Templates
  - Load template into create pledge form via `?templateId=` param
  - Delete templates with confirmation
  - `SaveTemplateSheet` with name input, dirty state tracking
  - DB migration: `task_definitions` column on templates table

---

## In Progress

(None currently)

---

## Session Notes

### Mar 9, 2026

**What was built:**

- FAQ screen with animated accordion, personality-aware Q&A (carrot/stick variants)
- Terms & Conditions and Privacy Policy screens (English-only legal copy)
- Helius webhook indexer Edge Function (real-time on-chain event sync)
- Daily reconciliation Edge Function (server-side safety net, pg_cron)
- Deployment docs for indexer (`docs/indexer.md`)
- Removed legacy AsyncStorage sync queue (replaced by indexer)
- Edit penalty removed — edit_pledge on-chain instruction stays but won't be called from frontend
- Security audit: sanitized error responses, hardcoded verified discriminators, updated handlePledgeEdited
- 27 Deno tests for indexer + daily-reconcile

### Feb 24, 2026

**What was built:**

- StakeAmountSheet: USDC bottom sheet with presets, wallet balance, keyboard handling
- Templates: save/load/delete templates, SaveTemplateSheet, TemplatesScreen, dirty state tracking
- BaseSheet auto-open guard (`useImperativeHandle` wrapper to prevent Android spurious opens)
- Fixed `keyboardDidHide` listeners opening closed sheets (added `isOpen` ref tracking)

### Feb 23, 2026

**What was built:**

- Complete V2 todo system with per-date task storage (PledgeTodos)
- Overhauled create pledge form: reordered, optional goal name, inline schedule presets
- HomeScreen daily task hub with segment control, aggregated tasks, Today/Yesterday toggle
- Pledge detail screen updated for V2 format
- Removed all legacy backward compat code (cleared DB)

### Jan 28, 2025

**What was built:**

- Complete tab structure (Home, History, Profile)
- Full pledge creation flow (UI → on-chain → Supabase)
- Pledge detail with todo checkboxes and daily progress
- Report completion flow

**What needs testing:**

- The app needs to be tested on a real device with MWA
- Ensure Supabase tables exist and match schema
- Test full pledge lifecycle: create → check todos → report completion

---

## To Do

### 1. Testing & Bug Fixes

- [ ] Test full create pledge flow on device with V2 todos
- [ ] Test report completion flow
- [ ] Test daily progress persistence across days
- [ ] Handle edge cases (network errors, wallet disconnection)

### 2. Goal Completion Tracking

- [ ] Goals are currently display-only on PledgeDetailScreen (flag icon, non-checkable)
- [ ] Allow checking off goals and persisting state
- [ ] Decide if goals count toward completion percentage or are separate

### 3. Edit Pledge

- [ ] Edit pledge screen/modal (DB-only — no on-chain transaction, no penalty)
- [ ] Update name, tasks, schedule in Supabase

### 4. HomeScreen Copy

- [ ] Update empty state copy for `EmptyState.tsx` and `ConnectWalletScreen.tsx`
- _Reference: TODO comments in those files_

### 5. Notifications (Future)

- [x] Firebase project setup
- [x] Expo push notifications config
- [x] Supabase pg_cron for scheduled notifications
- [x] Edge Function to send notifications
- [ ] Crank: clear old rows from notifications table after pledge expiry

### 6. Deployment

- [ ] Register Helius webhooks (devnet + mainnet) — see `docs/indexer.md`
- [ ] Deploy indexer + daily-reconcile Edge Functions to Supabase
- [ ] Set up pg_cron for daily reconciliation
- [ ] Deploy program to mainnet
- [ ] Set `MAINNET_PROGRAM_ID` in `app.config.ts`
- [ ] Test indexer with real devnet transaction (H1 validation)

---

## Future (V2)

- [ ] GitHub integration for commit-based goals
- [ ] X (Twitter) integration for posting goals
- [ ] Push notifications for reminders
- [ ] Yield earning on staked USDC
- [ ] Progress rings (Apple Fitness style)
