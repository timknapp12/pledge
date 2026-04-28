# Session Refresh — Options for Sliding Sessions

## Context

After the 2026-04-27 security audit, the JWT TTL was reduced from 30d → 7d
(SECURITY-AUDIT.md finding #4). The JWT does not extend on activity — it has
a hard expiry from issue time. This means:

- A user who signs in on day 1 must re-sign in on day 8, even if they used the
  app every day.
- A user who signs in once a week with a short idle gap will re-sign in
  about 4 times a month.

Re-signing in is one wallet tap, but it shows the wallet's "Sign Message"
prompt. For frequent users this can feel like a rough edge.

This doc outlines three options for adding a sliding session, ordered by
effort + risk.

---

## Tier 1 — Touch refresh (lightest)

**Effort:** ~2-3 hours focused work.

Allow the active JWT to be exchanged for a new one with extended `exp`, as
long as the current one is still valid (signature OK, not expired).

### What you build

| Piece | Detail |
|---|---|
| New edge function `refresh-jwt` | Validates incoming JWT signature + `exp`. Re-issues new JWT with same `sub`/claims and a fresh 7-day exp. |
| `config.toml` | `[functions.refresh-jwt]` with `verify_jwt = false` (function does its own JWT check). |
| Mobile fetch wrapper | On app foreground, decode stored JWT. If `exp - now < 24h`, call `refresh-jwt`, swap stored token. |
| `lib/supabase.ts` | Helper to swap `setSupabase(...)` to a new authenticated client when token rotates. |

### What you don't need

- No new DB table
- No refresh-token rotation chain
- No reuse detection logic

### Pros / cons

| Pros | Cons |
|---|---|
| Active users never see a re-sign-in prompt | No way to revoke a leaked JWT (but you can't today either) |
| Tiny attack surface — no new credentials in storage | If a token leaks, attacker can extend it indefinitely (within 7d windows) by calling refresh themselves |
| Backwards-compatible — existing JWTs still work | Idle users (7+ days) still need to re-sign-in |

### Implementation sketch

```typescript
// supabase/functions/refresh-jwt/index.ts
import * as jose from 'jose';

Deno.serve(async (req) => {
  const auth = req.headers.get('authorization');
  const m = auth?.match(/^Bearer\s+(.+)$/i);
  if (!m) return jsonResponse(401, 'Missing token');

  const secret = new TextEncoder().encode(Deno.env.get('JWT_SECRET')!);
  let payload: jose.JWTPayload;
  try {
    const { payload: p } = await jose.jwtVerify(m[1], secret, {
      issuer: 'supabase',
    });
    payload = p;
  } catch {
    return jsonResponse(401, 'Invalid or expired token');
  }

  // Re-mint with fresh exp, identical claims
  const token = await new jose.SignJWT({
    sub: payload.sub,
    role: payload.role,
    wallet_address: payload.wallet_address,
    aud: payload.aud,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('supabase')
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);

  return new Response(JSON.stringify({ token }), { /* ... */ });
});
```

```typescript
// apps/mobile — somewhere in app entry / AuthContext effect
async function maybeRefreshJwt(token: string): Promise<string | null> {
  const decoded = decodeJwt(token);
  const expMs = (decoded?.exp ?? 0) * 1000;
  if (expMs - Date.now() > 24 * 60 * 60 * 1000) return null;

  const r = await fetch(getRefreshJwtUrl(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const { token: fresh } = await r.json();
  await storeAuthToken(fresh);
  return fresh;
}
```

### Recommended for

Most apps at your stage. Highest UX-improvement-per-hour-of-work ratio.

---

## Tier 2 — Industry-standard refresh tokens

**Effort:** ~5-8 hours focused work + a few rounds of testing.

Two-token model: short-lived access JWT (15 min - 1 hr) + long-lived
rotating refresh token (30-90 days). Refresh tokens are single-use; each
rotation issues a new pair.

### What you build

| Piece | Detail |
|---|---|
| Migration: `refresh_tokens` table | `id uuid pk`, `user_id`, `token_hash` (sha256, never plaintext), `family_id`, `created_at`, `expires_at`, `used_at`, `revoked_at`, indexes on `user_id` + `token_hash` |
| `cleanup_refresh_tokens()` + cron | Hourly delete of expired/used > 7 days |
| Update `verify-wallet` | Also mint + persist refresh token, return both `{accessToken, refreshToken}` |
| New `refresh-token` edge function | Atomic: lookup by `token_hash`, validate not used/revoked/expired, mark used, mint new pair in same `family_id`, return |
| New `revoke-token` edge function | Marks `revoked_at` for logout |
| Mobile secure storage | Hold both tokens |
| Mobile fetch interceptor | On 401 with `token_expired`, attempt refresh + retry once. On refresh failure → `signOut()` |
| Reuse detection | If a refresh token presented after `used_at` is set, **revoke entire `family_id`** — treat as theft |

### Pros / cons

| Pros | Cons |
|---|---|
| Real revocation (lost device → revoke all that user's tokens) | Race conditions need careful handling (two concurrent requests both try to refresh) |
| Reuse detection catches token theft | Mobile background/foreground edge cases |
| Short access JWT minimizes leak impact (minutes, not days) | Refresh tokens still bearer credentials in secure storage |
| Audit trail of session lifetimes | Larger surface area to test |

### Race condition details

The two scenarios to handle:

1. **Concurrent refresh attempts** — two requests both notice JWT expired,
   both try to refresh with same refresh token. The atomic
   "validate-not-used + mark-used" step inside a transaction means only one
   wins; the other gets back the `family_id` and can retry the API call
   with the new token. Mobile interceptor needs a mutex around refresh.

2. **Reuse detection** — if attacker steals a refresh token and uses it
   while the legit user is offline, attacker gets new pair. When legit user
   comes back online and tries the original refresh token (now `used_at`
   is set), server sees this is a USED token being presented again →
   security incident → revoke entire `family_id`. Both attacker and legit
   user are logged out; user re-signs-in via wallet, which is correct.

### Recommended for

Apps with real users, real money flowing through, or compliance
requirements (SOC2, etc). Worth the upgrade once you've shipped to the
dApp Store and have organic users.

---

## Tier 3 — Bump JWT TTL back to 30d

**Effort:** ~5 minutes (just edit `setExpirationTime`).

Reverts the audit's improvement. **Not recommended** unless you have
strong reasons to undo the security-vs-UX trade-off.

If a JWT leaks, attacker has a month of access instead of a week. With
mobile crypto wallets where re-auth is one tap, the security benefit of
the shorter TTL is worth the slight UX friction.

---

## Decision matrix

| Use case | Recommendation |
|---|---|
| Pre-launch, want to ship soon | Stay at 7d hard expiry. Fix later if user complaints come in. |
| Just shipped, getting "I keep getting signed out" complaints | Tier 1. Quick, safe, real UX win. |
| Scaling past 10K users / handling significant TVL | Tier 2. Real revocation matters once theft becomes plausible. |
| Compliance / audit requirements | Tier 2. Industry standard for SOC2, PCI-style audits. |
| Want max convenience, low security bar | Tier 3. (Probably not your situation given you just hardened things.) |

---

## When to revisit

- After the next prod EAS build ships, watch for user reports of "I keep getting signed out"
- If those reports come in within ~30 days of launch → implement Tier 1
- Once monthly active users > 5K or you have any incident involving credential theft → upgrade to Tier 2
- If a security audit ever flags the lack of a refresh-token mechanism → upgrade to Tier 2

---

## References

- SECURITY-AUDIT.md — finding #4 (JWT TTL reduction) and finding #3 (SIWS nonces)
- `supabase/functions/verify-wallet/index.ts` — current JWT issuance
- `apps/mobile/contexts/AuthContext.tsx` — `checkExistingSession` reads stored JWT on app boot
- `apps/mobile/lib/supabase.ts` — `getStoredAuthToken` / `storeAuthToken` / `removeAuthToken` secure storage helpers
