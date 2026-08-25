# Research Suite

A token-based business research platform. You create an account, hold research
tokens, choose a package, describe your business, and spend tokens to generate a
detailed report built from public sources — with a citation behind every factual
claim.

The product name is a working title. It lives in exactly one file,
[`config/brand.ts`](config/brand.ts), and a unit test fails if it appears as a
string literal anywhere else.

## The ideas that shape everything

**The crawler owns facts. The model owns interpretation.** The model is never
asked what a page says — it is given the page's actual text, headings and
published contact routes, and asked what they imply. There is no AI call per
crawled page: pages are read deterministically, summarised into a bounded
context, and analysed once.

**Every claim carries its evidence.** Sources are registered as they are found
and given stable references — `S1`, `S2`, `S3` — before the model sees them. A
claim that cites a reference which does not exist is rejected in validation, not
rendered with a broken footnote. Every claim also carries a basis and a
confidence, and every report states what it could not determine.

**The model produces data, never presentation.** It returns a strictly typed
object; React components own all rendering. That is what makes reports look
identical for every subject, safe against content injected into a crawled page,
storable, diffable and exportable.

**A balance is only ever the result of an operation with a reason attached.**
There is no `setBalance` anywhere in the system. Tokens are reserved, then either
finalised or refunded, by database functions that take a row lock and an
idempotency key. The ledger is append-only and application code cannot edit it.

## Running it locally

```bash
npm install
npm run dev
```

That is the whole setup. With no `.env` at all the application runs end to end on
in-memory drivers and fixture data: no API key, no accounts, no cost, no network
egress. `/api/health` reports which driver is serving each subsystem.

To use real services, copy `.env.example` to `.env.local`. Every variable is
documented there, and every one is validated at boot, so a typo fails immediately
with the variable's name rather than surfacing later as an undefined-property
crash.

## Commands

| Command            | What it does                                      |
| ------------------ | ------------------------------------------------- |
| `npm run dev`      | Development server                                |
| `npm run verify`   | Typecheck, lint, format check, unit + integration |
| `npm test`         | Unit and integration tests                        |
| `npm run test:e2e` | Playwright, against a real production build       |
| `npm run build`    | Production build                                  |

`npm run verify` is exactly what CI runs before the build step, so a green local
run means a green CI run.

No test makes a paid API call. The AI provider and the research provider both
fall back to deterministic fixtures when no key is configured, and the test setup
pins them there.

## Packages and pricing

Both catalogues are typed configuration, not database rows, and neither is
reachable from a request body. A client names a package; the server names the
price.

| Package                       | Tokens | What it produces                                      |
| ----------------------------- | -----: | ----------------------------------------------------- |
| Competitor Intelligence       |    100 | Ranked competitors, positioning, pricing signals      |
| Target Customer & Lead Finder |    150 | Ideal customer profile, segments, named company leads |
| Influencer Outreach List      |    180 | Relevant creators with published contact routes       |
| Complete Market Pack          |    350 | All three, plus positioning and a 90-day plan         |

| Bundle  | Tokens | Price |
| ------- | -----: | ----: |
| Starter |    100 |    £9 |
| Builder |    300 |   £24 |
| Growth  |    700 |   £49 |
| Agency  |   1500 |   £89 |

**Purchasing is not implemented.** There is no payment integration and no
simulated one: `PURCHASING_ENABLED` is `false`, the pricing page labels bundles
"Coming soon", and the only way tokens enter a wallet is the operator grant route
below. Wiring a payment provider means crediting a wallet through the existing
`grant()` path — the accounting is already there.

## Granting tokens

The one operation that creates spendable value from nothing, so its reachability
matters more than its implementation.

`POST /api/admin/grant-tokens` requires `ADMIN_GRANT_SECRET`. If that variable is
absent the route is **disabled outright** — not open, not warning — and a wrong
secret returns 404 rather than 403, because an endpoint that admits it exists is
an endpoint worth attacking. The secret must be at least 24 characters or the
application refuses to boot. Every grant carries an operator reference that
becomes its idempotency key, so re-running a command does not stack credits.

`WELCOME_TOKEN_GRANT` defaults to `0`. Leave it there in production: an account
that silently receives spendable credit is a cost leak.

## Testing what matters

- `tests/integration/job-lifecycle.test.ts` — the money path. Charged once,
  refunded on our faults, never charged without delivery, never charged twice for
  one click, free on a cached repeat, and never readable across accounts. Each
  asserts the balance _and_ the ledger, because a job can look correct and still
  have stranded a hold.
- `tests/integration/token-grants.test.ts` — the grant route's closed states,
  asserted as hard as its open one.
- `tests/unit/research-provider.test.ts` — the Anthropic request shape, against
  the real serialised HTTP body. See "The 400 that shaped the AI layer" in
  [`ARCHITECTURE.md`](ARCHITECTURE.md).
- `tests/unit/ssrf-guard.test.ts`, `tests/integration/safe-fetch.test.ts` — the
  fetch guard, as a rule and as plumbing, against a real server.
- `tests/integration/auth-confirm.test.ts` — the callback, at the real HTTP
  boundary: it calls the route handler and reads `Set-Cookie` off the Response,
  with `@supabase/ssr` doubled at the library edge so the cookie adapter under
  test is the genuine one. Removing the cookie writes fails it.
- `tests/e2e` — both signed-out and signed-in, in both themes, across viewport
  widths, with axe. The signed-in session comes from an in-memory driver that
  the application refuses to load alongside real credentials.

## Signing in

Create an account with an email address, confirm it, choose a password, then use
that password from then on. A magic link is available as a fallback, and there
is a password-recovery path.

The email link flow is `token_hash` + `verifyOtp()` at `/auth/confirm`, chosen
because it needs nothing from the browser that requested the link — PKCE needs a
verifier cookie that a mail app's in-app browser does not have, which is what
broke sign-in in production. **The Supabase email templates must be edited to
match**; the exact HTML is in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Deploying

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the deployment checklist, the
database migration list, and what to verify after a deploy.

## What this will not do

It does not scrape Google Search, Google Maps, Instagram, TikTok or LinkedIn.
Those platforms forbid it, and a product built on a terms violation is a product
with a deadline. Where a source can be cited but not fetched, it is cited without
being fetched and marked as such.

It does not guess contact details. An email address appears in a report only
where the business published it. Constructing `firstname@company.com` is both
useless and the kind of thing that gets a sender blocked.
