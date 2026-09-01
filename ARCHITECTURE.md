# Architecture

## Layers

Each layer may only import from the ones above it. The boundaries are enforced by
ESLint where they can be and by module structure where they cannot.

```
config/           brand, report cost and budgets, markets, design tokens (typed, no I/O)
lib/security/     URL validation, SSRF guard, hardened fetch, decoding, limits
lib/auth/         Supabase SSR session; the only source of a user id
lib/tokens/       wallet drivers, ledger, idempotency, operator grants
lib/crawl/        robots, source registry, page facts
lib/research/     query plan, search budget, source classification, retrieval
lib/ai/           the Anthropic call, the fixture synthesiser              → unknown
lib/validation/   schema, citation checks, claim demotion, sanitisation → ModelReport
lib/market-entry/ readiness scoring, margin scenarios, the quality gate
lib/jobs/         intake, cache key, stages, storage drivers, the pipeline
lib/export/       CSV rendering
components/       presentation
```

`lib/market-entry/` is the layer that did not exist before, and it is the one
that matters most: everything the product _decides_ lives there, in pure
functions with no I/O, so a verdict can be reproduced, argued with and tested
from a table of fixtures. The model is never asked for a score, a verdict, an
evidence grade or a margin.

## Request flow

```
POST /api/research
  ├─ requireUser()                     ← a signed JWT, never a body field
  ├─ validate the brief                ← INVALID_INPUT never refunds: nothing taken yet
  ├─ refuse to start on fixture research if this deployment serves customers
  ├─ price from config/report.ts       ← one product, one cost, never from the body
  ├─ rate limit (per user, per IP, global daily cap)
  ├─ cache lookup, scoped to this user → hit returns instantly, free, marked cached
  ├─ balance check
  ├─ create the job row
  ├─ reserve one credit against it     ← idempotency key = the client's submission id
  └─ return 202 { publicId }
        │
        │  after() — the response has already gone back
        ▼
  runResearchJob
    context     re-read the stored brief; resolve provider and transport
    mapping     market conditions and demand           ┐
    competitors competitors, substitutes, pricing      │ ≤3 advanced + ≤9 basic
    channels    buyers, distribution, partners         │ searches, 12 in total,
    regulatory  regulation, barriers, the key question ┘ enforced by SearchBudget
    strategy    best-effort retrieval of the highest-authority sources found
    evidence    ONE Anthropic call, forced non-strict tool          → unknown
                Zod + citation cross-reference + claim demotion  → ModelReport
                the quality gate decides whether this is chargeable
    dossier     score it, assemble it, store.complete()
                wallet.finalize() — the hold becomes a spend
```

Three things about that order are deliberate.

**Retrieval sits inside a stage, not in front of one.** `retrieveSources()`
returns `{ retrieved, blocked }` and never throws. A total failure — zero pages
opened — leaves the pipeline running on search evidence alone, and a regression
test asserts a report still completes and is charged for when every fetch is
refused. There is no path from "a page refused us" to "the customer loses their
report".

**Demotion happens before the gate, not in the repair round.** A regulatory,
financial or market-size claim with no accessible authority behind it is rewritten
as unverified with a limitation generated for it. Only a _structurally_ invalid
report reaches the one permitted repair attempt. That ordering is what stops an
inaccessible page turning into a refund: by the time the gate runs, the report is
no longer asserting the thing it could not support, so the gate's
authoritative-source condition does not apply.

**`wallet.finalize()` runs after the gate, not after the write.** The customer is
only ever permanently charged for a document that was worth producing. A gate
failure raises `INSUFFICIENT_MARKET_EVIDENCE`, which the error taxonomy marks
`refundsTokens: true`, so it returns the credit through the same idempotent path
as any other failure.

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

## The credit lifecycle

One report costs one **report credit**, which is 100 tokens on the ledger below.
The customer never sees the token figure: `creditsFrom()` converts on the server,
`formatCredits()` renders the result, and no page sends the underlying number to
a browser. The tokens are kept as the internal unit because that is what makes
balances granted before this release keep working without a migration.

```
grant       +N available                        admin_grant / welcome_credit / purchase
reserve     −cost available, +cost reserved     reservation
finalize             0 available, −cost reserved   debit    ← the gate passed
refund      +cost available, −cost reserved     refund      ← our fault, or the gate
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

## The research budget

Paid calls are a budget decision made in code, never a decision the model or the
customer can influence.

`SearchBudget` (`lib/research/budget.ts`) holds two private counters and hands
out permission: `take('advanced')` returns false once three have been issued,
`take('basic')` once nine have, and neither can be issued once twelve in total
have gone out. The runner cannot issue a search without a successful `take()`,
and the caps are constants in `config/report.ts` asserted sane at module load.
A unit test drives a plan that _wants_ twenty searches and asserts exactly twelve
provider calls, exactly three of them advanced.

Retrieval has its own ceilings: at most 8 fetches, 8MB, 45 seconds, two pages per
publisher. It budgets **attempts, not successes** — a failed fetch costs a
request, a DNS lookup and up to the whole connect timeout, so budgeting successes
would let a run of dead hosts consume far more than the budget allowed, and the
worse the sources, the longer the customer would wait.

Anthropic is one synthesis call and at most one repair, and the repair only runs
for a structurally invalid report.

## The evidence model

Five grades, shown as words and never as colour alone: **verified fact**, **you
told us**, **modelled estimate**, **strategic inference**, **unverified**.

`deriveEvidenceGrade()` is a pure function of three things — the claim's basis,
the categories of the sources it cites, and whether the claim's path is a
sensitive one. Sensitive paths are the regulatory, financial and market-size
sections, listed explicitly in `SENSITIVE_CLAIM_PATHS`. A sensitive claim earns
`verified` only when at least one credible source behind it was retrieved
directly; an index summary alone downgrades it to `unverified`. The model has no
input to this at all, which is what stops a confident sentence awarding itself
authority it has not got.

## The readiness model

Seven weighted factors, each 0–1, each computed from validated fields, each
carrying the sentence shown beside it in the report:

| Factor               | Weight | Derived from                                       |
| -------------------- | -----: | -------------------------------------------------- |
| Evidence depth       |   0.20 | credible sources, and how many were read directly  |
| Regulatory clarity   |   0.20 | requirements resting on an authority, minus gaps   |
| Demand signal        |   0.15 | read evidence versus reasoning                     |
| Route fit            |   0.15 | recommendation supported, comparison broad enough  |
| Risk load            |   0.15 | probability × impact of the register, inverted     |
| Commercial viability |   0.10 | whether the case can be assessed from real figures |
| Competitive clarity  |   0.05 | competitors backed by evidence                     |

The weights sum to one, asserted at module load — weights summing to 0.95 produce
a readiness that can never reach 95, and nothing anywhere would say so. Bands:
≥70 promising, 50–69 promising with conditions, below 50 high risk. A failed
quality gate short-circuits to insufficient evidence and refunds.

Competitive clarity is deliberately the smallest weight. It measures whether the
question was answered, not whether the answer was good — a crowded market and an
empty one both score full marks. It carried 15% in the first version, which let
"we found four competitors" outweigh "the risk register is heavy", and that is
the wrong trade.

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

## Authentication

One flow, `token_hash` + `verifyOtp()`, at `/auth/confirm`.

```
/sign-up      signInWithOtp({shouldCreateUser:true})  → Confirm-signup email
/auth/confirm verifyOtp({type, token_hash})           → session cookies
/auth/set-password  updateUser({password})            → /dashboard?welcome=1
/sign-in      signInWithPassword()                    → /dashboard
              signInWithOtp({shouldCreateUser:false}) → fallback link
/forgot-password    resetPasswordForEmail()           → /auth/reset-password
POST /auth/sign-out signOut()                         → /?signed-out=1
```

**Why not PKCE.** `createBrowserClient` writes the code verifier into
`document.cookie` in the browser that requested the link. Mail apps open links
in their own in-app webview, which has no access to it, so
`exchangeCodeForSession` failed _after_ Supabase had already recorded a
successful login — the exact split the production logs showed. `verifyOtp`
needs nothing from that browser, so it works from any client or device. The
cost is that the email templates must be edited; see the checklist below.

**Why the route owns its response.** `/auth/confirm` constructs its redirect
first and the Supabase cookie adapter writes onto _that object_ — not onto a
request-scoped store that something downstream has to merge. The session
cookies and the anti-cache headers are on what the function returns, by
construction, and the route is testable without a Next request store. The
previous version relied on the merge and swallowed any write failure silently,
which is why an outage produced no log line.

**Why redirects use `NEXT_PUBLIC_SITE_URL`.** `request.nextUrl.origin` is
derived from whatever `Host` arrived, and Next normalises a loopback address to
`localhost`. In production that means redirecting to a host the session cookie
was not set for.

Identity always comes from `getClaims()`, which verifies the JWT signature.
`getSession()` is never trusted server-side.

### Supabase dashboard checklist

Manual. None of this can be done in code, and **email links do not work until
steps 1 and 2 are both complete**.

**1. Authentication → URL Configuration**

| Field         | Value                                                    |
| ------------- | -------------------------------------------------------- |
| Site URL      | `https://aiseo-three-omega.vercel.app`                   |
| Redirect URLs | `https://aiseo-three-omega.vercel.app/auth/confirm`      |
|               | `https://aiseo-three-omega.vercel.app/**`                |
|               | `http://localhost:3000/**`                               |
|               | `https://*-<your-vercel-scope>.vercel.app/**` (previews) |

A `redirect_to` that is not on this list is ignored — Supabase falls back to the
bare Site URL, dropping the path, which lands the user on a signed-out homepage
with no error.

**2. Authentication → Email Templates**

All four must point at `/auth/confirm` with `token_hash`. The default templates
use `{{ .ConfirmationURL }}`, which produces the PKCE flow this no longer uses.

_Confirm signup_

```html
<h2>Confirm your email</h2>
<p>
  <a
    href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/auth/set-password"
    >Confirm and choose a password</a
  >
</p>
<p>This link works once and expires in an hour.</p>
```

_Magic Link_

```html
<h2>Your sign-in link</h2>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink"
    >Sign in</a
  >
</p>
<p>This link works once and expires in an hour.</p>
```

_Reset Password_

```html
<h2>Set a new password</h2>
<p>
  <a
    href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password"
    >Choose a new password</a
  >
</p>
<p>If you did not ask for this, you can ignore it.</p>
```

_Change Email Address_

```html
<h2>Confirm your new address</h2>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change"
    >Confirm</a
  >
</p>
```

**3. Authentication → Providers → Email**

Email enabled · **Confirm email ON** · password sign-in enabled · minimum
password length ≥ 8 (the UI states 8; a higher server value would reject
passwords the form accepted).

**4. SMTP**

The built-in sender is capped at a few emails per hour — that cap is what
produced the `429 over_email_send_rate_limit` errors. Configure a real SMTP
provider before any real use.

**5. Vercel environment variables**

| Variable                               | Type           | Needed at             |
| -------------------------------------- | -------------- | --------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Config (plain) | **build** and runtime |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Config (plain) | **build** and runtime |
| `NEXT_PUBLIC_SITE_URL`                 | Config (plain) | **build** and runtime |
| `SUPABASE_SERVICE_ROLE_KEY`            | **Secret**     | runtime only          |

The three `NEXT_PUBLIC_` values are browser-visible by design: they are inlined
into the client bundle and sent to every visitor. They must be available at
_build_ time — the CSP is baked during `next build`, and a build without them
ships a policy that blocks Supabase.

`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security. It is server-only, must
never be renamed into a `NEXT_PUBLIC_` variable, and must not be set on preview
deployments that untrusted people can reach.

Never set `AUTH_TEST_DRIVER` on any deployment. It replaces authentication with
an in-memory stub; `lib/env.ts` refuses to start if it is set alongside real
credentials or on a production deployment.

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
| `0010_market_entry_source_evidence`             | Widens the `research_sources` type CHECK and adds five nullable evidence columns                                                  |

Four of those were found by _executing_ the functions against a live database
rather than reading them. None was visible to `tsc`.

### What `0010` does, and how to undo it

`research_jobs` needed no change at all: `package_id` and `stage` are
unconstrained text, so `market-entry` and the eight new stage names are valid
values today. The new report shape goes in the existing `result` jsonb with
`schema_version: 2`, and the new failure state is an `error_code`, not a new
`status` — the status column _is_ constrained, and widening it would have been a
change to a column every existing row uses.

`research_sources` did need one. Its `source_type` CHECK is closed, so the
migration widens it — **every existing value is retained**, so all 45 live rows
stay valid — and adds five nullable columns: `source_category`, `retrieval_mode`,
`published_at`, `geographic_relevance`, `source_confidence`.

Nothing is dropped, renamed or rewritten. Users, wallets, ledger entries,
previous reports, sources and auth identities are all untouched.

**It is applied to the live project** — recorded in migration history as
`market_entry_source_evidence`, alongside `0001`–`0009`. Verified afterwards:
all 45 existing `research_sources` rows intact and unrewritten, the five new
columns nullable and NULL on every one of them, and the widened CHECK still
accepting all seven legacy `source_type` values.
`supabase/database.types.ts` is now generated from that live schema rather
than hand-edited ahead of it.

**Ordering.** Apply `0010` before deploying the code. The source-index insert
names the new columns, so on an unmigrated database it fails — and that failure
is deliberately not fatal: the sources are embedded in `research_jobs.result` as
well, so the table is a queryable index rather than the only copy. Deploying in
the wrong order therefore costs analytics for the jobs run in between, not
citations and not reports. Fix it by applying the migration; nothing needs
backfilling for the product to work, though those jobs stay absent from the
index.

**Recovery path.** Because every column added is nullable and nothing existing
reads them, rolling back the _application_ alone is already safe: an older build
simply ignores the new columns, and the widened CHECK accepts everything the old
one did. If the columns themselves must go, the migration ships with a commented
`-- down` block that drops the five columns and the added CHECK and restores the
original. Run it only after the application has been rolled back, and regenerate
`supabase/database.types.ts` afterwards either way.

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

1. Apply `supabase/migrations/0004`–`0010` in order, then regenerate
   `supabase/database.types.ts` from the live schema.
2. Enable email sign-in in Supabase Auth and add
   `${NEXT_PUBLIC_SITE_URL}/auth/confirm` to the allowed redirect URLs — then
   follow **Supabase dashboard checklist** above for the rest of it. That step
   is not optional detail: the email templates have to be rewritten to emit
   `token_hash`, and until they are, the links Supabase sends do not work no
   matter how the redirect URLs are configured.
3. Set the variables above. `maxDuration` is 300s on the research route, which
   needs Vercel Pro or Fluid Compute — the Hobby 60s ceiling cannot fit the
   pipeline.
4. Deploy, then check `/api/health`. It returns **503** while any subsystem is on
   a development driver in production, and names which. A mock research provider
   is reported as failing rather than degraded: it returns confident, well-shaped,
   entirely fictional sources, and nothing downstream can tell.
5. Grant yourself credit via `POST /api/admin/grant-tokens` (100 tokens is one
   report credit) and run one real assessment end to end.
6. Set Anthropic and Tavily spend alerts.

There is no Google configuration to do. `GOOGLE_PLACES_API_KEY` is not read and
must not be set; `/api/health` reporting `places: "disabled"` is the correct,
healthy result.

### Production smoke test

After a deploy, in this order:

1. `GET /api/health` — expect **200**, `status: "ok"`, and
   `providers: { research: "tavily", ai: "anthropic", storage: "supabase", auth:
"supabase", rateLimit: "upstash", places: "disabled" }`. A 503 names what is
   wrong in `problems`. Confirm no value in the response looks like a key.
2. Load `/` signed out. The headline reads "Enter new markets with evidence."
3. Load `/example`. The dossier renders, the source drawers open, and the page
   is labelled as illustrative.
4. Sign in. The header shows a credit count, not a token count.
5. Grant yourself 100 tokens and run one assessment through `/assess` to
   completion. Watch the processing page move through the eight stages.
6. Check the wallet: one reservation and one debit for that job, nothing
   reserved.
7. Open a previously existing report at its original `/research/<publicId>` URL
   and confirm it still renders with the legacy banner.
8. Print-preview the new dossier and confirm the navigation drops away and the
   source drawers are open.

Rollback is a Vercel instant rollback. The migrations are additive, so a rollback
never orphans data.
