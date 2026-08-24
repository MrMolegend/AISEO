# Architecture

## Layers

Each layer may only import from the ones above it. The boundaries are enforced by
ESLint where they can be and by module structure where they cannot.

```
config/           brand, package catalogue, token bundles  (typed, no I/O)
lib/security/     URL validation, SSRF guard, hardened fetch, decoding, limits
lib/auth/         Supabase SSR session; the only source of a user id
lib/tokens/       wallet drivers, ledger, idempotency, operator grants
lib/crawl/        robots, frontier, sitemaps, source registry, page facts
lib/research/     search provider interface, Tavily, deterministic mock, policy
lib/ai/           the Anthropic call, the fixture synthesiser              → unknown
lib/validation/   schema, citation checks, sanitisation                   → Report
lib/jobs/         intake, cache key, stages, storage drivers, the pipeline
lib/export/       CSV rendering
components/       presentation
```

## Request flow

```
POST /api/research
  ├─ requireUser()                     ← a signed JWT, never a body field
  ├─ validate the brief                ← INVALID_INPUT never refunds: nothing taken yet
  ├─ price from config/packages.ts     ← the request names a package, not a price
  ├─ rate limit (per user, per IP, global daily cap)
  ├─ cache lookup, scoped to this user → hit returns instantly, free, marked cached
  ├─ balance check
  ├─ create the job row
  ├─ reserve tokens against it         ← idempotency key = the client's submission id
  └─ return 202 { publicId }
        │
        │  after() — the response has already gone back
        ▼
  runResearchJob
    understanding  crawl the subject's own site, bounded          → PageFacts[]
    discovering    search public sources, register each one       → S1..Sn
    crawling       read the most promising external pages
    extracting     deterministic facts, no model involved
    building       assemble the bounded context
    analysing      ONE Anthropic call, forced non-strict tool     → unknown
    checking       Zod + citation + sanitisation; one repair pass → Report
    saving         store.complete() — the last write to the row
                   wallet.finalize() — the hold becomes a spend
```

If anything throws, `settleFailure` writes the failure and consults the error
taxonomy for whether to refund. The decision lives in `lib/errors.ts`, next to
the code and the user-facing copy, so "does this refund?" has one answer in one
place rather than a condition in the middle of a long function.

`store.complete()` is deliberately the last write to the job row. Every stage
maps to a non-terminal status, so a stage write landing after completion would
move a finished job back to "still working" — and the status endpoint reports
done from that status, so the browser would poll forever on a report that already
existed and had been paid for. That happened. Both store drivers now refuse
progress writes to a terminal job.

## The token lifecycle

```
grant       +N available                        admin_grant / welcome_credit / purchase
reserve     −cost available, +cost reserved     reservation
finalize             0 available, −cost reserved   debit    ← the report exists
refund      +cost available, −cost reserved     refund      ← our fault
```

`amount` in the ledger is the signed change to `available_balance`, which is why
a debit is `0`: the tokens left `available` when they were reserved. Summing a
job's entries gives its net cost, whatever order they are read in.

Every mutation goes through a `SECURITY DEFINER` Postgres function that takes a
row lock on the wallet and checks an idempotency key before doing anything. The
`service_role` holds `SELECT` only on `token_wallets` and `token_ledger`, so a
write outside those functions is not merely discouraged — it is not permitted.
The ledger has an append-only trigger; the one mutation it allows is the cascade
from a deleted `auth.users` row, because refusing that made accounts
undeletable.

## The 400 that shaped the AI layer

Passing a schema of this size to `output_config.format`, or marking the tool
`strict: true`, makes the API compile it into a constrained-decoding grammar:

```
400 invalid_request_error: "The compiled grammar is too large, which would cause
performance issues. Simplify your tool schemas or reduce the number of strict tools."
```

So the schema is attached to a **forced, non-strict tool**. That makes the shape
advisory — the model is asked to follow it, not made to — which is why the
validation layer downstream is load-bearing rather than belt-and-braces. Forcing
the tool still removes the free-text channel entirely, so there is no prose turn
for an injected instruction to be complied with.

Neither of those two facts is visible to the type system; both produce a runtime 400. `tests/unit/research-provider.test.ts` asserts them against the real
serialised HTTP body, and has been verified to fail when either is put back.

## Prompt injection

Crawled page content is hostile input. Four reinforcing defences:

1. **Structural** — content is JSON-encoded inside a nonce-delimited block. The
   nonce is per-request from `crypto.randomBytes`, so a forged closing tag cannot
   terminate it.
2. **Instructional** — the boundary is stated in the system prompt and again
   _after_ the data, where recency helps.
3. **Mechanical** — `tool_choice` forces a schema-shaped call. There is no
   free-text channel to comply through.
4. **Output-side, and this is the real backstop** — every string is capped, HTML
   and markdown links are scrubbed, script URIs are stripped, and a citation to a
   source that was never registered is a validation failure. A fully successful
   injection can produce a strange-sounding report, not an XSS.

`react/no-danger` is an ESLint error repo-wide, so rendering model output as HTML
is a build failure rather than a code-review catch.

## SSRF

The service fetches user-supplied URLs from inside a cloud network, so:

1. Syntactic validation — scheme, no credentials, ports 80/443 only.
2. Hostname denylist — `localhost`, `.local`, `.internal`, bare hostnames.
3. DNS resolution and an IP allowlist — every private, loopback, link-local
   (including `169.254.169.254`) and CGNAT range rejected, v4 and v6.
4. **Connect-time re-validation** of the actual socket peer, which is the only
   correct fix for DNS rebinding. Validating DNS and then calling `fetch` is a
   race an attacker with a low-TTL record wins.
5. Manual redirects, every hop re-validated.
6. Separate ceilings for encoded and decoded bytes, so a compressed response
   cannot expand past the limit after it has been accepted.

`E2E_ALLOW_LOCAL_FETCH` relaxes (1) and (3) for tests that serve their own
loopback fixture. Production never sets it.

## Content-Security-Policy

Assembled in `lib/security/csp.ts` and read by `next.config.ts`. It lives in a
module rather than inline in the config because a security control nobody can
test is a security control nobody can be sure of, and its failures are silent
in both directions: too tight and a feature stops working, too loose and
injected script gets an exfiltration channel.

`connect-src` carries `'self'` plus **exactly one Supabase origin**. The
browser needs it: `supabase-js` posts to `/auth/v1/otp` from the page, and
without it the request never leaves the browser and the sign-in form can only
report a generic failure.

The origin is a **constant**, `DEFAULT_SUPABASE_ORIGIN`, with
`NEXT_PUBLIC_SUPABASE_URL` as an override. That order is the point, and it was
learned the hard way: `headers()` is evaluated during the build, the variable
was not in Vercel's build environment, and the deployment shipped bare
`connect-src 'self'`. Nothing failed — not the build, not CI, not a typecheck
— only every sign-in, in the browser. An environment variable that has to be
present for a security header to be correct is a dependency you find out about
in production.

The constant is not a credential. It is a Supabase project's public API origin
— the same string already inlined into the client bundle and present in every
request the browser makes. It authorises nothing on its own: reaching it still
requires the publishable key, and every table behind it is under row-level
security. Listing one extra named host in `connect-src` widens the page's reach
by that host and nothing more.

Whatever the source, the value goes through `URL.origin` and then a strict
pattern check, so a path, query, fragment, embedded credential, newline or
semicolon cannot reach a world-readable response header. A value that is set
but unusable falls back rather than dropping the origin — a typo must not be
able to reproduce the outage. Not `https:`, not `*.supabase.co`, no wildcard of
any kind.

Nothing is listed for Anthropic, Tavily or Upstash. Those are called from route
handlers and the job runner, where CSP does not apply.

## Database

Additive migrations only. The audit-era tables are untouched and their data is
intact; nothing in this codebase reads them any more.

| Migration                                       | What it adds                                                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `0001`–`0003`                                   | The original audit schema. Left in place.                                                                                         |
| `0004_research_platform`                        | `user_profiles`, `token_wallets`, `token_ledger`, `research_jobs`, `research_sources`, RLS, and the transactional token functions |
| `0005_fix_token_function_output_names`          | `RETURNS TABLE` columns shadowed same-named table columns, making every balance-moving function raise 42702 at runtime            |
| `0006_allow_ledger_removal_on_account_deletion` | The append-only trigger blocked the cascade from `auth.users`, so accounts could not be deleted                                   |
| `0007_settle_reservations_individually`         | The settle-once guard was scoped to the job rather than the reservation, stranding a second hold                                  |
| `0008_select_outstanding_reservation_directly`  | `created_at` ties inside one transaction made "the latest reservation" non-deterministic                                          |
| `0009_index_research_jobs_cached_from`          | Unindexed foreign key                                                                                                             |

Four of those were found by _executing_ the functions against a live database
rather than reading them. None was visible to `tsc`.

## Deployment checklist

Environment variables — names only, values never printed anywhere:

| Variable                                                 | Needed for                                             |
| -------------------------------------------------------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`                                   | Canonical URLs, auth redirects                         |
| `NEXT_PUBLIC_SUPABASE_URL`                               | Auth and storage                                       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `…_ANON_KEY`) | Browser auth client                                    |
| `SUPABASE_SERVICE_ROLE_KEY`                              | Server-side storage. Never in a browser bundle         |
| `ANTHROPIC_API_KEY`, `AI_PROVIDER=anthropic`, `AI_MODEL` | Report synthesis                                       |
| `RESEARCH_PROVIDER=tavily`, `TAVILY_API_KEY`             | Finding public sources                                 |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`     | Limits that span instances                             |
| `IP_HASH_SALT`                                           | Hashing IPs. Raw addresses are never stored            |
| `RESEARCH_DAILY_GLOBAL_CAP`                              | The cost ceiling. **Set before the first public link** |
| `ADMIN_GRANT_SECRET`                                     | The grant route. Absent ⇒ route disabled. Min 24 chars |
| `WELCOME_TOKEN_GRANT`                                    | Leave at `0` in production                             |

Steps:

1. Apply `supabase/migrations/0004`–`0009` in order.
2. Enable email sign-in in Supabase Auth and add
   `${NEXT_PUBLIC_SITE_URL}/auth/callback` to the allowed redirect URLs.
3. Set the variables above. `maxDuration` is 300s on the research route, which
   needs Vercel Pro or Fluid Compute — the Hobby 60s ceiling cannot fit the
   pipeline.
4. Deploy, then check `/api/health`. It returns **503** while any subsystem is on
   a development driver in production, and names which. A mock research provider
   is reported as failing rather than degraded: it returns confident, well-shaped,
   entirely fictional sources, and nothing downstream can tell.
5. Grant yourself tokens via `POST /api/admin/grant-tokens` and run one real
   report.
6. Set Anthropic and Tavily spend alerts.

Rollback is a Vercel instant rollback. The migrations are additive, so a rollback
never orphans data.
