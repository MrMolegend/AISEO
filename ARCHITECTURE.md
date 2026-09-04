# Architecture

The platform now serves **ALT SIGNAL**, Arab Land Trading's internal
lead-intelligence workspace. The first half of this document describes that
layer; the sections after it describe the platform subsystems it stands on
(security, auth, budgets, jobs, sharing, privacy), which carried over from the
earlier products and still run — the legacy report surfaces remain reachable
for their owners.

## ALT SIGNAL: the lead-intelligence layer

### Roles and membership

Five roles — `super_admin`, `sales_manager`, `sales_rep`, `analyst`, `viewer`
— live in the `team_members` table and nowhere else: not in `user_metadata`
(user-writable), not as email lists in code. `lib/auth/membership.ts` reads
the membership row on every request; `app_metadata.role` acts only as a
bootstrap for the first administrator, and an explicit revocation in the table
beats any claim a stale JWT still carries. Every denial is a 404 — an
authorisation surface that answers "forbidden" has confirmed the resource
exists. Pages gate through `requireWorkspacePage(returnTo, ...roles)`
(redirects to sign-in / request-access / notFound), routes through
`requireMember(...roles)`.

### Domain map

```
config/alt.ts          verified ALT facts (each with source + recorded date), GCC
                       markets, emirates, default segments
lib/alt/               keyed workspace configuration (proof points, prohibited
                       claims, scoring weights, budget caps, playbooks) + brands
                       + territories, two-driver store
lib/icps/              ideal customer profiles
lib/campaigns/         campaigns and runs (duplicate-active guard, unit accounting)
lib/discovery/         plan → cost estimate → engine (stages, checkpoints, caps,
                       cancellation-safe terminal states) → contacts
lib/leads/             accounts, claims (evidence rows), contacts, merges with
                       undo; normalisation and the cautious dedup rules
lib/relationships/     the 8-state provenance graph and its attestations
lib/linkedin/          mode contract, OAuth (PKCE + state), capability report
lib/scoring/           deterministic dimensions, override handling, brand matching
lib/outreach/          deterministic bilingual drafting, the lint, approval flow,
                       suppression
lib/pipeline/          stage history, activities (private-note filtering), tasks
                       (playbook fingerprint idempotency), saved views
lib/signals/           watchlists and bounded, budgeted signal checks
lib/insights/          pure outcome analytics with sample-size floors; territory
                       rollups
lib/imports/           CSV parse/preview (pure) + commit/undo orchestration
```

Every domain store follows the same two-driver pattern the platform
established: a Supabase driver using the least-privileged service role with
ownership enforced inside each query, and an in-memory driver behind a
`globalThis` symbol so unit tests and keyless local development run the whole
product.

### The honesty invariants

These are load-bearing and tested, not aspirational:

- **No fabrication.** Accounts come only from search results that name them
  (`candidateFromResult` refuses listicles and question headlines); contacts
  only from structured "Name – Role – Company" titles, with employment marked
  `unverified` and no invented channels; dedup merges only on normalised-name
  equality or same canonical domain, never similarity, and every merge is
  reversible.
- **No automatic sending.** The outreach schema has no recipient or delivery
  column; drafts require an explicit reviewed-checkbox approval; copy is the
  only exit and it is recorded. Playbooks create tasks, not messages.
- **Provenance-gated language.** "Verified direct connection" renders only
  for `official_api_verified_direct` and `employee_confirmed_direct`, and the
  store refuses to persist a verified-direct edge whose provenance string
  does not prove it.
- **Derived, decomposed scoring.** `lib/scoring/compute.ts` is pure integer
  arithmetic over stated rules; missing inputs stay in the denominator and
  are named; an override never edits the computed total.
- **Gap vs. unknown.** Brand matching returns `already_stocked`,
  `observed_opportunity`, `not_verified` or `restricted` — and the UI copy
  keeps "not verified" from ever reading as "they don't stock it".
- **Budget before spend.** The discovery engine decrements its unit budget
  before each provider call; exhaustion completes the run as `partial`.
  Campaign starts are gated by the per-campaign cap and the workspace daily
  cap; watchlist checks spend from the same daily cap, at most three per
  watch per day, and record the check before searching.
- **Samples with their n.** `lib/insights/compute.ts` refuses to render a
  rate below `MIN_SAMPLE` as a percentage.

### LinkedIn: the capability truth table

`LINKEDIN_MODE` ∈ `disabled` (default) · `openid_only` · `partner_sales_access`.
Capabilities derive from **granted OAuth scopes**, never from env presence:
`capabilityReport(grantedScopes)` is the single source the admin panel, the
relationships page and `/api/health` all render from. In this build the
partner tier ships **no** capability — setting the mode grants nothing beyond
`openid_only` and the report says so in words. OAuth uses the authorization-code
flow with PKCE (S256) and an opaque state bound to an HttpOnly cookie; tokens
are used server-side for the identity exchange and are not persisted. There
is no scraping, browser automation, cookie reuse or unofficial endpoint in
any mode, and `linkedin.com` sits in the non-crawlable host list — public
profile URLs arrive only as labelled `public_search_index` references.

### The lead-intelligence migrations (`0017`–`0024`)

**Not applied to the live project.** They ship with this change and are
applied at deploy time after `0016`, in numeric order:

| File   | Adds                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------- |
| `0017` | `team_members`, `ops_audit_events` (the legacy `audit_events` from `0001` is left untouched)                    |
| `0018` | `alt_territories` (GCC seeded), `alt_brands`, `alt_config`, `icps`                                              |
| `0019` | `campaigns`, `campaign_runs`, `lead_accounts`, `lead_claims`, `lead_contacts`, `account_merges`                 |
| `0020` | `relationships` (8-state CHECK), `provider_connections` (scopes, no tokens)                                     |
| `0021` | `account_scores` (override↔reason pairing CHECK)                                                                |
| `0022` | `outreach_drafts` (approval-pair CHECK, no recipient columns), `outreach_draft_versions`, `suppression_entries` |
| `0023` | pipeline columns on `lead_accounts`, `pipeline_history`, `activities`, `sales_tasks`, `saved_views`             |
| `0024` | `watchlists`, `signals`                                                                                         |

All follow the `0011`–`0016` conventions: additive only, RLS enabled with no
policies, revoke-then-grant service-role privileges, length/state CHECKs,
partial unique indexes where idempotency depends on them (one active run per
campaign; one task per playbook step per account; one signal per watch+URL),
and a commented `-- down` block. Apply with `supabase db push`, then
regenerate `supabase/database.types.ts` — its hand-written pending-tables
section says exactly this.

Personal data hangs off `auth.users` with `ON DELETE CASCADE`
(`team_members`, `relationships.employee_id`, `provider_connections`,
`watchlists`, `saved_views`); shared work records use `ON DELETE SET NULL` so
the team's history survives a member's deletion with the personal reference
cleared. The privacy page states this in the same words.

### Legacy retention

The earlier products' tables, report URLs and auth callbacks are untouched.
Marketing routes redirect to the gateway; `robots.ts` disallows everything;
nothing reads legacy rows as leads. The wallet/ledger machinery still settles
the legacy report pipeline and is absent from the primary navigation.

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
| `0011_business_profiles`                        | The reusable business profile — structured fields, optional `website_url`, archive-not-delete                                     |
| `0012_research_drafts`                          | Server-backed intake drafts with an optimistic-concurrency `revision`                                                             |
| `0013_report_lineage`                           | `research_jobs.profile_id`, saved Scenario Lab assumptions, one revisable feedback verdict per user per report                    |
| `0014_action_workspace`                         | Editable action rows with a partial unique index making plan imports idempotent                                                   |
| `0015_share_links`                              | Deliberate sharing: SHA-256 token digests (never raw tokens), expiry, revocation, and an audit trail                              |
| `0016_job_recovery`                             | `attempt_count`, `heartbeat_at` and the partial stall-sweep index on `research_jobs`                                              |

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

### The product-depth migrations (`0011`–`0016`)

**They are not applied to the live project.** They ship with the product-depth
change and are applied at deploy time, after `0010`, in numeric order. All six
are additive: no existing row, column or constraint is dropped or rewritten,
every new table hangs off `auth.users` with `ON DELETE CASCADE`, RLS is enabled
with no policies (deny-all; access is the server's least-privileged
service_role, ownership enforced inside every store query), and each file
carries a commented `down` block.

Apply, from the repo root with the project linked:

    supabase db push

Then regenerate `supabase/database.types.ts` from the live schema — its header
currently says the 0011–0016 types were written by hand from the migration
files, and instructs exactly this.

Verification queries, after applying:

    -- Six new relations, all with RLS enabled and zero policies.
    select relname, relrowsecurity from pg_class
     where relname in ('business_profiles','research_drafts','report_scenarios',
                       'report_feedback','action_items','share_links','share_events');

    -- research_jobs gained exactly three columns.
    select column_name from information_schema.columns
     where table_name = 'research_jobs'
       and column_name in ('profile_id','attempt_count','heartbeat_at');

    -- The import-idempotency and stall-sweep indexes exist.
    select indexname from pg_indexes
     where indexname in ('action_items_import_unique','research_jobs_stall_sweep_idx');

    -- No customer row was touched: counts on the pre-existing tables are
    -- unchanged from before the deploy.

Rollback: each file's commented `down` block, in reverse order `0016` → `0011`.
Safe while nothing has written to the new tables; `0013`'s job column must go
before `0011`'s table.

## The workspace layer

Everything a returning customer keeps lives in domain stores that mirror the
jobs/tokens pattern — a memory driver for tests and credential-less dev, a
Supabase driver in production, and the ownership filter inside every query so
a row that is not the caller's never leaves the database.

- **Profiles** (`lib/profiles/`) hold the durable description of the business.
  `website_url` is nullable and stays nullable: when present it enters the
  research as ONE candidate source (category `company`, registered after the
  evidence floor so it cannot prop up an empty search phase), and its absence
  or unreachability is a recorded limitation, never a failure. The brief
  schema itself remains URL-free, held there by the guard test.
- **Drafts** (`lib/drafts/`) replace localStorage-only intake progress. Every
  save is a compare-and-set on `revision`; the stale writer gets
  `DRAFT_CONFLICT` and a banner, never a silent merge. Payloads are sanitised
  to the intake's own fields, bounded, 32KB ceiling. Submission freezes the
  draft with a pointer to the job it became.
- **Lineage** — a profile's completed runs are its versions, numbered by
  position at read time. `lib/market-entry/compare.ts` diffs two stored
  reports structurally: verdict, readiness and per-factor deltas, verbatim
  headline claims, keyed add/remove/change lists. No model writes any of it.
- **Scenario Lab** (`lib/market-entry/scenario-lab.ts`) is pure integer
  arithmetic over assumptions the customer controls; every output carries its
  formula in words and every missing input yields a named gap. Risk tolerance
  selects a point WITHIN the customer's own demand range. Saved scenarios
  store assumptions only — results recompute, so a saved scenario can never
  disagree with its own arithmetic.
- **Actions** (`lib/actions/`) materialise the report's 30/60/90 plan into
  editable rows. The partial unique index over (user, job, source action id)
  makes the import structurally idempotent; customer edits survive re-imports.
- **The evidence index** (`lib/market-entry/evidence-index.ts`) inverts the
  claims' own source refs into "which sections cite this source". The runner
  fills `supports` at assembly; older reports get the same index recomputed at
  read time.

## Sharing

The public id stopped being a capability. A report is private to its owner;
`/research/[publicId]` requires the owner's session, and the store no longer
has a public read at all. Sharing mints links at `/shared/[token]`:

- 256-bit CSPRNG tokens, stored ONLY as SHA-256 digests. The raw token exists
  in the minting response and nowhere else — not in the database, not in a log
  line, not re-displayable.
- Links carry an optional label, optional expiry, revocation, a use count and
  an audit trail (`created`/`viewed`/`denied`/`revoked`, with the viewer's
  salted IP hash).
- Every dead token — unknown, expired, revoked, malformed — answers the same
  `SHARE_LINK_INVALID`, so failures teach a guesser nothing. Resolution is
  rate limited per presenting address before any storage read.
- The shared page renders the report alone under a guest header: no owner
  navigation, no workspace, no account surface. `robots` meta plus an
  `X-Robots-Tag: noindex` and `no-store` header pair on `/shared/*`.
- Exports: the owner always; a visitor only via `?share=<token>` on a live
  link minted with `allow_download`, checked against the report the link
  names (`lib/share/authorize.ts`).

## Job recovery

The runner touches `heartbeat_at` at every stage transition. A non-terminal
job whose last pulse is older than `JOB_STALL_MINUTES` is dead — the process
running it is gone — and repair settles it exactly like any other failure:
`failed` with the refundable `JOB_STALLED` code, credit returned through the
ledger's idempotent refund key. Repairing twice, or racing a late settlement
from the dying run, replays the key and moves nothing twice.

Two triggers: the owner opening their own stalled job (repaired on sight, so
what renders is the honest failure page with the refund confirmation), and
the admin console's confirmed, rate-limited, logged sweep. A duplicate-active
guard in `create-job` completes the picture: the same brief submitted while
its research runs joins the running job instead of reserving twice.

## Admin authorisation

`requireAdmin()` (`lib/auth/admin.ts`) accepts exactly one thing: a verified
session whose JWT `app_metadata.role` is `'admin'`. `app_metadata` is issued
by the Auth server and writable only through its admin API — a user cannot
edit their own — which is the whole difference between a role claim and an
email string. There is no environment allowlist and nothing client-side in
the decision. A non-admin gets a 404, not a 403: an admin page that answers
"forbidden" has confirmed it exists.

Granting, from a privileged connection (never request-handling code):

    update auth.users
       set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
     where id = '<user uuid>';

The user signs out and in again to pick up the claim. The `/admin` console
shows operational metadata only — provider names and states, job health,
stall repair, feedback aggregates, share audit events — never keys, prompts,
raw provider payloads or full customer content. Token grants remain the
separate secret-gated API route.

## Privacy: export and deletion

`/api/account/export` streams one JSON file: profiles, drafts, assessments
with reports and sources, scenarios, actions, feedback, share-link metadata
(never token hashes) and the full credit ledger.

Deletion is a typed-phrase confirmation. Order matters: every live share link
is revoked (and audited) first, then the auth user is deleted through the
Auth admin API and the schema's cascades take everything else. Retention,
truthfully: **the ledger deletes with the account** — the deliberate decision
migration `0006` encoded — and operational logs never contained identifying
values to anonymise (the logger redacts; rate limiting stores salted hashes).

## Research caching

Two different things, deliberately separated:

- **First-party result caching** exists and stays: a completed report
  satisfies an identical brief from the same user within
  `RESEARCH_CACHE_TTL_HOURS`, free and labelled as cached. User-scoped by
  query, so one customer's inputs can never surface another's report.
- **Provider-response caching does not exist and remains off.** Tavily's
  current terms could not be verified from the build environment (egress to
  tavily.com is blocked), and the rule for that situation is to document the
  decision rather than guess. What the pipeline persists today is already the
  conservative shape: source identifiers, bounded excerpts (≤1200 chars),
  retrieval metadata and timestamps — never complete raw provider responses.
  Anyone enabling reuse later must first confirm the terms permit durable
  storage of the content class in question, and scope any cache per user.

## Deployment checklist

Environment variables — names only, values never printed anywhere:

| Variable                                                                  | Needed for                                                                                                            |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                    | Canonical URLs, auth redirects                                                                                        |
| `NEXT_PUBLIC_SUPABASE_URL`                                                | Auth and storage                                                                                                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `…_ANON_KEY`)                  | Browser auth client                                                                                                   |
| `SUPABASE_SERVICE_ROLE_KEY`                                               | Server-side storage. Never in a browser bundle                                                                        |
| `ANTHROPIC_API_KEY`, `AI_PROVIDER=anthropic`, `AI_MODEL`                  | Report synthesis                                                                                                      |
| `RESEARCH_PROVIDER=tavily`, `TAVILY_API_KEY`                              | Finding public sources                                                                                                |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                      | Limits that span instances                                                                                            |
| `IP_HASH_SALT`                                                            | Hashing IPs. Raw addresses are never stored                                                                           |
| `RESEARCH_DAILY_GLOBAL_CAP`                                               | The cost ceiling. **Set before the first public link**                                                                |
| `ADMIN_GRANT_SECRET`                                                      | The grant route. Absent ⇒ route disabled. Min 24 chars                                                                |
| `WELCOME_TOKEN_GRANT`                                                     | Leave at `0` in production                                                                                            |
| `JOB_STALL_MINUTES`                                                       | Optional. Heartbeat age before a run counts as stalled (default 15)                                                   |
| `LINKEDIN_MODE`                                                           | Optional. `disabled` (default, healthy) · `openid_only` · `partner_sales_access` (grants nothing extra in this build) |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` / `LINKEDIN_REDIRECT_URI` | Only when `LINKEDIN_MODE` ≠ `disabled`; health reports the mode as failing without them                               |

Steps:

1. Apply `supabase/migrations/0011`–`0024` in order (`0001`–`0010` are already
   on the live project; nothing after them is), then regenerate
   `supabase/database.types.ts` from the live schema and run the verification
   queries under **The product-depth migrations** above. The lead-intelligence
   tables are listed under **The lead-intelligence migrations** near the top of
   this document.
   1a. Bootstrap the first administrator: set `app_metadata.role = 'super_admin'`
   on your operator account (see **Admin authorisation**), sign in, then create
   your own `team_members` row from `/team` — after which the table, not the
   claim, is the authority. Invite the rest of the team from the same page.
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
7. Grant your operator account the admin role (see **Admin authorisation**),
   sign out and in, and check `/admin` loads for you and 404s for a customer.

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
