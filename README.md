# AMPLYFY card experience

Mobile landing page with a server-authoritative Mines game, earned coupon, signed Apple Wallet pass, and Google Calendar appointment booking.

## Build and verify

Node.js 24 or newer is required for the SQLite test harness.

```sh
npm ci
npm run build
npm test
npm audit --omit=dev
```

`public/` contains the interface and source images. `worker/` contains the Cloudflare Worker backend. The build embeds static assets and outputs `dist/server/index.js`. Generated output is not committed.

## Hosting

The current deployment uses **ChatGPT Sites on Cloudflare Workers**, D1 (`DB`), and R2 (`BUCKET`). `.openai/hosting.json` preserves that Site's identity. Sites applies migrations in `drizzle/` before publishing. This is not a static-only or Vercel deployment: uploading only `public/` will not provide the game or Wallet APIs.

An independent Cloudflare deployment must provision its own D1/R2 bindings, apply the schema, provide secrets, and replace the platform-specific owner authentication with an equivalent trusted authentication check. Never expose the Worker directly with caller-controlled `oai-authenticated-user-email` headers; the current admin boundary relies on the Sites gateway validating identity and stripping untrusted identity headers.

Runtime secrets, signing keys, game records, visitor cookies and booking leads are **not** included in this repository. `WALLET_VAULT_KEY` and `WALLET_OWNER_EMAIL` are configured through the hosting secret manager. The P12 is uploaded through the owner-only setup page; the export password is discarded and the imported signing identity is encrypted before R2 storage. Preserve the vault key when updating the existing Site.

## Game isolation

Every round has an independent random UUID and a 256-bit browser secret. The secret is carried in an HttpOnly, Secure, SameSite=Strict, host-only cookie; the database stores its hash. All game reads, reveals, claims and pass downloads authenticate that pair. Different browsers have different games. Tabs within the same browser profile intentionally share its game.

The server generates mines and computes rewards. Unrevealed mine locations never go to the browser. Atomic database version checks reject stale writes (HTTP 409), preventing double taps or concurrent claims from overwriting newer state. A claim freezes the earned amount. Claims and Wallet passes never trust a client-provided reward.

Existing pre-D1 R2 rounds migrate lazily with create-only inserts, preserving previously earned rewards. R2 is now reserved for the encrypted signing identity, legacy reads and immutable issued pass files, rather than high-frequency counters.

## Booking leads

The page embeds the existing Google appointment schedule. Google owns slot reservations and confirmations; visitors do not share the game's mutable state with the scheduler. The private, sheet-bound **AMPLYFY Booking Leads Sync** Apps Script runs under the business Google account, on Calendar changes and on a five-minute backup trigger.

It reads incremental Calendar updates, filters the card consultation title, and upserts by event ID. A script lock prevents overlapping sync jobs; cancellations update the existing lead. Spreadsheet values are escaped against formula injection. No public webhook or Google credentials are embedded in the website. Google manages that account's scheduling and Apps Script quotas. A delayed sync can catch up from its saved Calendar token; the Sheet is not the booking source of truth.

## Validation and limits

See [SECURITY.md](SECURITY.md) and [docs/verification.md](docs/verification.md). The test suite exercises the compiled Worker, with real SQLite executing the same atomic SQL statements used by D1. This validates isolation and race behavior; it does not certify an unlimited hosted request rate or simulate 100,000 simultaneous browsers.
