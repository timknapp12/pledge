# Anchor Build Compatibility Issues (January 2026)

This document explains the version compatibility issues encountered when trying to build the Pledge Anchor program with IDL generation, and the solution that works.

## Current Status

| Component | Status |
|-----------|--------|
| Program compilation (.so) | **WORKS** with Anchor 0.32.x + blake3 patch |
| IDL generation | **WORKS** with Anchor 0.32.x + blake3 patch |
| Tests | **ALL 28 PASSING** |

## The Problem: A Three-Way Incompatibility

There was a fundamental conflict between three requirements:

```
                    Rust >= 1.85
                         |
                         | (requires edition2024)
                         v
    +-----------------+---------------------+
    |                                       |
    v                                       v
 blake3 >= 1.6           Anchor 0.31.1 (proc_macro2 fix)
    |                          |
    | (needs Cargo 1.85+)      | (uses Solana 2.x)
    |                          |
    +----------+---------------+
               |
               v
      Solana SBF Toolchain
      (bundles Cargo 1.84)
      CANNOT build edition2024
```

### Why Anchor 0.30.x Failed for IDL

- Uses `proc_macro2::Span::source_file()` for IDL generation
- This method was removed from Rust 1.85+ (April 2025)
- See: [Anchor Issue #3661](https://github.com/solana-foundation/anchor/issues/3661)

### Why Anchor 0.31.x Failed for Build (Without Patch)

- Fixed the `source_file()` issue ([PR #3663](https://github.com/solana-foundation/anchor/pull/3663))
- But uses Solana 2.x which depends on `blake3 >= 1.5.5`
- Newer blake3 versions pull in `constant_time_eq >= 0.4.2` (edition2024)
- Solana SBF toolchain (platform-tools v1.51) uses Cargo 1.84 which doesn't support edition2024

## The Solution (WORKING)

### 1. Use Anchor 0.32.x with blake3 Patch

**Workspace Cargo.toml:**
```toml
[workspace]
members = ["programs/*"]
resolver = "2"

[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1

[profile.release.build-override]
opt-level = 3
incremental = false
codegen-units = 1

[patch.crates-io]
# Pin blake3 to version 1.5.5 which uses constant_time_eq 0.3.x (pre-edition2024)
blake3 = { git = "https://github.com/BLAKE3-team/BLAKE3", tag = "1.5.5" }
```

**Program Cargo.toml:**
```toml
[dependencies]
anchor-lang = { version = "0.32.0", features = ["init-if-needed"] }
anchor-spl = "0.32.0"
```

### 2. Fix Clock::get()? in PDA Seeds

Anchor's IDL generation cannot handle `Clock::get()?` in account constraint seeds because the `?` operator isn't valid in that macro context.

**Before (broken for IDL):**
```rust
#[derive(Accounts)]
pub struct CreatePledge<'info> {
    #[account(
        init,
        seeds = [PLEDGE_SEED, user.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub pledge: Account<'info, Pledge>,
}
```

**After (works):**
```rust
#[derive(Accounts)]
#[instruction(stake_amount: u64, deadline: i64, created_at: i64)]
pub struct CreatePledge<'info> {
    #[account(
        init,
        seeds = [PLEDGE_SEED, user.key().as_ref(), &created_at.to_le_bytes()],
        bump
    )]
    pub pledge: Account<'info, Pledge>,
}

impl<'info> CreatePledge<'info> {
    pub fn create_pledge(&mut self, stake_amount: u64, deadline: i64, created_at: i64, bumps: &CreatePledgeBumps) -> Result<()> {
        let clock = Clock::get()?;
        // Validate created_at is within acceptable range (5 minutes)
        let drift = (created_at - clock.unix_timestamp).abs();
        require!(drift <= 300, ErrorCode::InvalidTimestamp);
        // ... rest of implementation
    }
}
```

### 3. Build and Deploy Commands

```bash
# Install Anchor CLI 0.32.1
avm install 0.32.1
avm use 0.32.1

# Ensure Solana CLI is in PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Build (compiles program AND generates IDL)
anchor build

# Deploy
anchor deploy

# Run tests (start validator first)
solana-test-validator --reset &
sleep 5
ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 ANCHOR_WALLET=~/.config/solana/id.json \
  npx ts-mocha -p ./tsconfig.json -t 1000000 'tests/**/*.ts'
```

## Environment Details

```
Rust:           1.90.0 (stable)
Anchor CLI:     0.32.1
anchor-lang:    0.32.0 (resolves to 0.32.1)
Solana CLI:     3.0.13 (Agave)
Platform-tools: v1.51
Bundled Cargo:  1.84.0
```

## Version Matrix (Updated)

| Anchor | Program Build | IDL Generation | Notes |
|--------|---------------|----------------|-------|
| 0.29.0 | Fails | Unknown | Uses deprecated `cargo-build-bpf` |
| 0.30.0 | Works* | Fails | *With blake3 patch, but source_file issue in IDL |
| 0.30.1 | Works* | Fails | *With blake3 patch, but source_file issue in IDL |
| 0.31.0 | Works* | Works* | *With blake3 1.5.5 patch |
| 0.31.1 | Works* | Works* | *With blake3 1.5.5 patch |
| **0.32.0** | **Works*** | **Works*** | ***With blake3 1.5.5 patch - RECOMMENDED** |
| **0.32.1** | **Works*** | **Works*** | ***With blake3 1.5.5 patch - RECOMMENDED** |

## Key Insights

1. **blake3 1.5.5 is the magic version**: It satisfies the `^1.5.5` requirement from Solana 2.x dependencies while still using `constant_time_eq 0.3.x` (pre-edition2024).

2. **Anchor 0.32.x uses stable Span APIs**: The `proc_macro2::Span::source_file()` issue is fully resolved in 0.32.x which uses stable `Span::local_file()`.

3. **Clock in seeds doesn't work**: If you use `Clock::get()?` in PDA seeds, IDL generation will fail. Pass timestamps as instruction parameters instead and validate them.

4. **Test runner quirk**: `anchor test` may show "0 passing" with newer Node.js versions due to ES module detection issues. Run tests directly with `ts-mocha` as shown above.

## References

- [Anchor Release Notes 0.32.0](https://www.anchor-lang.com/docs/updates/release-notes/0-32-0)
- [Anchor Issue #3661](https://github.com/solana-foundation/anchor/issues/3661) - source_file incompatibility
- [Anchor PR #3663](https://github.com/solana-foundation/anchor/pull/3663) - The fix for source_file
- [Agave Issue #8443](https://github.com/anza-xyz/agave/issues/8443) - edition2024 support discussion
- [BLAKE3 GitHub](https://github.com/BLAKE3-team/BLAKE3) - For patching blake3

---

*Last updated: January 2026*
*Solution verified: All 28 tests passing*
