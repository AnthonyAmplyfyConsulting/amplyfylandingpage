# Security and operations

## Implemented controls

- Server-owned randomized boards and reward amounts; claims freeze the amount.
- Independent UUID + 256-bit secret cookies; hashed secrets stored server-side.
- Atomic D1 compare-and-swap game updates; atomic request counters.
- Per-IP coarse API limits, stricter new-round and Wallet limits, and authenticated per-round limits. No shared in-memory game state.
- Twenty-minute replay cooldown for an existing browser round.
- Same-origin checks on writes, JSON type/size validation, bounded multipart uploads.
- Owner-only Wallet administration through trusted Sites identity.
- Encrypted private signing credentials, certificate/team/type/key validation, hidden signing assets, signed pass caching.
- CSP, HTTPS-only cookies, HSTS, MIME protection, referrer and permissions policies; no API response caching.
- Private booking Sheet, restricted Google scopes, event-ID deduplication, formula escaping and locked sync runs.

## Important boundaries

Browser-session isolation is not identity verification. Clearing cookies, switching profiles, or using another device can bypass the browser replay cooldown. IP limits reduce automated abuse but do not eliminate it. Coupons should be treated as one non-stackable setup offer per business, with eligibility checked before applying a discount. Do not represent the game as a fraud-proof financial entitlement.

Multiple tabs in one browser profile share one session. A stale tab can receive HTTP 409 and must refresh/retry. Users opening the Site inside an environment that blocks third-party cookies should use its top-level URL.

The owner email header is trusted only behind the Sites authentication gateway. A GitHub copy does not transfer that authentication service, runtime secrets or storage. The deployment remains owner-private until the owner explicitly opens access for launch.

The Worker uses CPU for initial RSA pass signing. Cached downloads reduce repeat work, but a very large burst of first-time Wallet issuance needs its own hosted capacity test. Request-rate controls are not a substitute for upstream DDoS protection or monitoring.

Google's appointment scheduler and Apps Script have independent service quotas. No load test here creates real meetings or sends invitations. A real test booking remains necessary to verify the complete booking form-to-Sheet path.

## Before a large campaign

1. Confirm the public audience and final hostname; review third-party-cookie behavior on target iPhones and browsers.
2. Make a real booking, reschedule it and cancel it; confirm one Sheet row updates.
3. Download and add a pass on an iPhone.
4. Review provider limits and monitor 429/5xx rates, D1 latency, Wallet CPU and Apps Script execution failures. Scale in stages; recipient count is not concurrent-user count.
5. Keep the vault secret stable, renew the Apple signing certificate before expiry, and retain recovery access to the business Google account.

Do not put P12/PFX/private keys, export passwords, tokens, cookies, lead exports, or real environment files in Git. Public Apple intermediate certificates and pass icons are intentionally included.
