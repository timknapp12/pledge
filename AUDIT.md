# Security Audit Report

## Summary

The Pledge program is a Solana Anchor program for staking USDC on personal goals. The most critical vulnerability is that users self-report their completion percentage with no on-chain verification and can immediately process their own pledge, meaning a rational actor can always recover 100% of their stake. Additionally, the crank authority has unilateral control over expired pledge completion percentages with no verifiable proof, and config changes retroactively affect in-progress pledges.

## Findings

### Critical (1)

#### 1. Self-Reported Completion Percentage With No On-Chain Verification

**Location:** `programs/pledge/src/contexts/report_completion.rs:31`

**Description:**

In report_completion, the user provides their own completion_percentage (0–100) as an instruction argument with no on-chain verification of actual goal completion. Since process_completion also allows the pledge owner to settle (not just the crank), a rational user will always report 100% to reclaim their full stake with zero fees. This completely undermines the accountability mechanism — staking has no real enforcement because a user can always self-report 100% and self-settle to receive a full refund. The entire staking system provides no actual financial incentive to complete goals.

**Recommendation:**

The self-reporting design fundamentally breaks the staking incentive. Consider one or more of the following:

Remove self-reporting entirely — only allow the crank (backed by off-chain verification data from the DB) to determine completion percentages:

```rust
// In report_completion.rs, only allow the user to signal they want to settle,
// but don't let them set the percentage:
pub fn report_completion(&mut self) -> Result<()> {
    // User signals readiness to settle; crank reads DB and calls process_completion
    self.pledge.status = PledgeStatus::Reported;
    self.pledge.reported_at = Some(Clock::get()?.unix_timestamp);
    Ok(())
}
```

Remove user self-settle from process_completion — only allow the authorized crank to call it:

```rust
// In process_completion.rs, remove the pledge.user alternative:
#[account(
    constraint = crank.key() == config.crank_authority @ ErrorCode::Unauthorized
)]
pub crank: Signer<'info>,
```

If self-reporting must remain, require the deadline to have passed and add a dispute/challenge window where the crank can override the self-reported percentage using DB data before settlement is finalized.

---

### High (2)

#### 1. No Deadline Enforcement on Report or Process Completion — Instant Stake Recovery

**Location:** `programs/pledge/src/contexts/report_completion.rs:40`

**Description:**

There is no time constraint on report_completion (explicitly commented as intentional at line 40–41) and process_completion has no check that the deadline has passed. Combined with the self-reporting issue, a user can execute: (1) create_pledge with a stake, (2) immediately call report_completion(100), (3) immediately call process_completion as self-settler — all within seconds, recovering 100% of their stake. The pledge system provides zero lock-up period and zero accountability enforcement. A user's tokens are never actually at risk.

**Recommendation:**

Add a deadline check to report_completion to ensure the pledge period has actually elapsed before the user can report:

```rust
pub fn report_completion(&mut self, completion_percentage: u8) -> Result<()> {
    let clock = Clock::get()?;

    // User can only report after the deadline has passed
    require!(
        clock.unix_timestamp >= self.pledge.deadline,
        ErrorCode::DeadlineNotPassed
    );

    // ... rest of logic
}
```

Alternatively, if users should be able to report before the deadline, add a time check to process_completion requiring at minimum the deadline to have passed before settlement can occur.

#### 2. Crank Authority Has Unilateral Control Over Expired Pledge Completion Percentages

**Location:** `programs/pledge/src/contexts/process_expired.rs:68`

**Description:**

In process_expired, the crank passes completion_percentage as an instruction argument with no on-chain proof or verification. The crank operator (or anyone who compromises the crank keypair) can set any user's completion percentage to 0 for pledges that expire without self-reporting, forfeiting the user's entire stake to treasury/charity. Conversely, a colluding crank could set 100% for friendly users. There is no accountability, commit-reveal scheme, or oracle verification for the crank's claimed completion data.

**Recommendation:**

Consider one of the following mitigations:

Commit-reveal scheme: When crank determines completion off-chain, require a two-step process — first commit a hash of the completion data, wait a dispute window, then reveal. This allows users to challenge.

Multi-sig crank: Require multiple independent crank authorities to agree on completion percentage.

Store verifiable evidence on-chain: Include a hash of the off-chain evidence (e.g., Supabase daily_progress data hash) so the completion claim is auditable:

```rust
pub fn process_expired(
    &mut self,
    completion_percentage: u8,
    evidence_hash: [u8; 32], // Hash of off-chain completion data
) -> Result<()> {
    // Store evidence hash for auditability
    // ...
}
```

At minimum, add a timelock so users can see and dispute crank-submitted percentages before funds move.

---

### Medium (4)

#### 1. Config Changes Retroactively Affect In-Progress Pledges

**Location:** `programs/pledge/src/contexts/update_config.rs:29`

**Description:**

Fee rates (partial_fee_bps), treasury split (treasury_split_bps), edit penalty (edit_penalty_bps), and grace period are read from the global config at processing time, not stored on the pledge at creation. The admin can change these parameters at any time via update_config. This means a user who stakes under one fee regime may be processed under a different (potentially more punitive) regime. For example, the admin could set partial_fee_bps to the maximum 1000 (10%) just before processing a batch of pledges, then revert it.

**Recommendation:**

Snapshot the relevant config parameters onto the Pledge account at creation time so that each pledge is settled according to the terms under which it was created:

```rust
// In state/pledge.rs, add:
pub struct Pledge {
    // ... existing fields
    pub fee_bps_at_creation: u16,
    pub treasury_split_bps_at_creation: u16,
    pub edit_penalty_bps_at_creation: u16,
    pub grace_period_at_creation: i64,
}
```

Then use these snapshot values in process_completion, process_expired, and edit_pledge instead of reading from the global config.

#### 2. Pledge Accounts Never Closed After Processing — Permanent Rent Loss and State Bloat

**Location:** `programs/pledge/src/contexts/process_completion.rs:151`

**Description:**

In both process_completion and process_expired, the vault token account is closed and its rent returned to the user, but the Pledge PDA account itself is never closed. Each pledge account costs approximately 0.00189 SOL in rent (102 bytes of data + overhead). Since the PDA seed includes created_at, each pledge is unique and the account persists indefinitely. Over time, this causes permanent state bloat on-chain and users permanently lose their rent SOL. There is also no separate instruction to close processed pledge accounts.

**Recommendation:**

Close the pledge account after processing and return the rent to the user. Add a close = user constraint or manually close the account:

```rust
// In ProcessCompletion accounts struct:
#[account(
    mut,
    seeds = [PLEDGE_SEED, pledge.user.as_ref(), &pledge.created_at.to_le_bytes()],
    bump = pledge.bump,
    constraint = pledge.status == PledgeStatus::Reported @ ErrorCode::PledgeNotReported,
    close = user  // Close and return rent to user
)]
pub pledge: Account<'info, Pledge>,
```

Apply the same pattern to ProcessExpired. If on-chain state needs to be preserved for historical queries, consider adding a separate close_pledge instruction that can be called after processing.

#### 3. Edit Penalty Charged With No Actual Changes Required

**Location:** `programs/pledge/src/contexts/edit_pledge.rs:56`

**Description:**

The edit_pledge function charges the full edit penalty (default 10%) from the vault regardless of whether any changes are actually made. The only modifiable field is new_deadline, which is Option<i64>. If called with new_deadline = None, the user pays a 10% penalty for no state change. While a user wouldn't intentionally do this, it creates a risk if a frontend bug or phishing attack tricks a user into signing an edit transaction with no payload.

**Recommendation:**

Require that at least one change is provided, or only charge the penalty when a change is actually applied:

```rust
pub fn edit_pledge(&mut self, new_deadline: Option<i64>) -> Result<()> {
    // Require at least one change
    require!(new_deadline.is_some(), ErrorCode::NoChangesProvided);

    // ... rest of penalty and update logic
}
```

#### 4. No Admin Transfer Mechanism

**Location:** `programs/pledge/src/contexts/initialize.rs:50`

**Description:**

The ProgramConfig stores a single admin pubkey set at initialization, and there is no instruction to transfer admin authority to a new wallet. If the admin private key is compromised or lost, the program config becomes permanently immutable (no ability to pause, change fees, update treasury/charity addresses, or rotate the crank authority). This is a single point of failure for the program's governance.

**Recommendation:**

Add a two-step admin transfer mechanism to update_config:

```rust
// In ProgramConfig:
pub pending_admin: Option<Pubkey>,

// New instruction: propose_admin_transfer
pub fn propose_admin_transfer(&mut self, new_admin: Pubkey) -> Result<()> {
    self.config.pending_admin = Some(new_admin);
    Ok(())
}

// New instruction: accept_admin_transfer (signed by pending_admin)
pub fn accept_admin_transfer(&mut self) -> Result<()> {
    self.config.admin = self.config.pending_admin.unwrap();
    self.config.pending_admin = None;
    Ok(())
}
```

---

### Low (3)

#### 1. Grace Period Can Be Set to Zero

**Location:** `programs/pledge/src/contexts/initialize.rs:47`

**Description:**

Both initialize and update_config only validate that grace_period_seconds >= 0. Setting the grace period to 0 means the crank can process expired pledges via process_expired immediately after the deadline passes, giving users zero time to self-report their completion after the deadline. This effectively removes the safety window that protects users who complete their goals but forget to report on time.

**Recommendation:**

Enforce a minimum grace period (e.g., 1 hour or 1 day):

```rust
const MIN_GRACE_PERIOD: i64 = 3600; // 1 hour minimum

require!(
    grace_period_seconds >= MIN_GRACE_PERIOD,
    ErrorCode::InvalidGracePeriod
);
```

#### 2. No Minimum Pledge Duration Enforcement

**Location:** `programs/pledge/src/contexts/create_pledge.rs:77`

**Description:**

In create_pledge, the only deadline validation is deadline > created_at. A user can set a deadline just 1 second in the future. Combined with the lack of deadline checks in reporting/processing, this means pledges can have arbitrarily short durations, defeating the purpose of time-bound goals.

**Recommendation:**

Enforce a minimum pledge duration:

```rust
const MIN_PLEDGE_DURATION: i64 = 86400; // 1 day minimum

require!(
    deadline >= created_at + MIN_PLEDGE_DURATION,
    ErrorCode::PledgeTooShort
);
```

Consider making this configurable via ProgramConfig so it can be adjusted without a program upgrade.

#### 3. Mint Validation Missing in process_completion and process_expired

**Location:** `programs/pledge/src/contexts/process_completion.rs:9`

**Description:**

While create_pledge validates that the mint matches config.allowed_mint, neither process_completion nor process_expired include the mint account or validate that the pledge's mint still matches the config's allowed_mint. If the admin changes allowed_mint via update_config, existing pledges with the old mint can still be processed. The token account constraints check token::mint = pledge.mint which ensures consistency with the pledge, but if the allowed_mint is changed to prevent processing a specific token, old pledges would still be processable. This is a minor inconsistency rather than a direct exploit.

**Recommendation:**

This is low risk since the pledge already stores the correct mint and token account constraints validate against it. However, if the admin intends allowed_mint changes to affect existing pledges, add a mint check:

```rust
// In ProcessCompletion/ProcessExpired constraints:
constraint = pledge.mint == config.allowed_mint @ ErrorCode::InvalidMint
```

---

### Informational (1)

#### 1. created_at Timestamp Is User-Provided and Used as PDA Seed

**Location:** `programs/pledge/src/contexts/create_pledge.rs:31`

**Description:**

The created_at field in create_pledge is a user-provided parameter used as part of the PDA seed derivation. While it is validated to be within 5 minutes of the clock time, this still gives users a window of ~600 possible second values to choose from. This is used to allow multiple pledges per user (each with a unique timestamp), but it means the PDA address is partially user-controlled. This isn't exploitable since init prevents reuse and the 5-minute drift window is reasonable, but it's worth noting for awareness.

**Recommendation:**

No immediate action required. If stricter PDA determinism is desired, consider using an incrementing counter stored on a user-specific account instead of a user-provided timestamp.

---

*This report is generated by an AI-powered security auditor. While every effort has been made to ensure accuracy, human review is recommended to validate findings and recommendations.*

---

## Our Response

### Design Decisions (Accepted Risks)

The following findings are acknowledged but will **not** be addressed, as they are intentional design choices for V1:

| Finding | Severity | Reason |
|---------|----------|--------|
| **Critical 1** — Self-reported completion | Critical | **By design.** Pledge is a self-accountability app. Users self-report their completion and can choose to be honest or not. The social/psychological commitment is the primary mechanism, not on-chain enforcement. We may add optional third-party verification (GitHub, X) in V2. |
| **High 2** — Crank unilateral control | High | **Accepted for V1.** The crank is operated by the Pledge team and uses completion data from our Supabase database (daily task check-offs). This is a trusted-operator model appropriate for an early-stage app. Multi-sig or commit-reveal may be added in V2. |
| **Medium 1** — Config changes affect existing pledges | Medium | **Deferred to V2.** The admin is a single team-controlled keypair. Snapshotting config at creation time requires a realloc and redeploy. Since we do not plan to change fees while pledges are active, this is low practical risk. |
| **Medium 3** — Edit penalty with no changes | Medium | **Moot.** The edit penalty is set to 0% and the `edit_pledge` instruction will never be called from the frontend. Pledge editing only updates Supabase metadata (name, tasks, schedule). |
| **Low 2** — No minimum pledge duration | Low | **By design.** Users can create short pledges if they want. The deadline enforcement on settlement (Fix 1) prevents instant recover-and-settle, which was the real risk. Short pledges are a valid use case. |
| **Low 3** — Mint validation in process instructions | Low | **Accepted.** The pledge stores the correct mint and token constraints validate against it. We will not change `allowed_mint` while pledges are active. |
| **Info 1** — created_at as PDA seed | Info | **No action needed.** The 5-minute window is reasonable and `init` prevents reuse. |

### Fixes Being Implemented

The following findings will be addressed in the Anchor program:

#### Fix 1: Deadline Enforcement on Settlement (High 1)

**Problem:** Users can create a pledge and immediately report + settle, recovering 100% with no lock-up period.

**Fix:**
- Add a deadline check to `process_completion` — settlement cannot occur before the deadline passes. Users can still report early (signal intent), but funds don't move until the deadline.
- Add `DeadlineNotPassed` error code.

#### Fix 2: Close Pledge Accounts After Processing (Medium 2)

**Problem:** Pledge PDA accounts are never closed after processing, causing permanent rent loss (~0.002 SOL per pledge) and on-chain state bloat.

**Fix:**
- Add `close = user` to the pledge account in both `ProcessCompletion` and `ProcessExpired` account structs.
- Rent SOL is returned to the user automatically.

#### Fix 3: Admin Transfer Mechanism (Medium 4)

**Problem:** No way to transfer admin authority. If the admin key is lost or compromised, the program config is permanently locked.

**Fix:**
- Add `pending_admin: Option<Pubkey>` to `ProgramConfig`.
- Add `propose_admin_transfer` instruction (called by current admin).
- Add `accept_admin_transfer` instruction (called by pending admin).
- This is the standard two-step transfer pattern used across Solana programs.
- Requires a `realloc` on ProgramConfig to accommodate the new field (32 bytes + 1 byte option tag).

#### Fix 4: Minimum Grace Period (Low 1)

**Problem:** Grace period can be set to 0, allowing the crank to process expired pledges immediately with no window for users to self-report.

**Fix:**
- Add `MIN_GRACE_PERIOD = 3600` (1 hour) constant.
- Validate in both `initialize` and `update_config`.
- Add `InvalidGracePeriod` error code.
