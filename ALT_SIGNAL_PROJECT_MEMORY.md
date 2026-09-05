# ALT SIGNAL — Project Memory

Canonical, single-source project memory for the repository `MrMolegend/AISEO`.
Last updated: **2026-09-05T18:58Z**.

Labels used throughout:
`Verified` (checked directly in this session against Git, GitHub, Supabase or
the code) · `Reported` (carried from a prior session's handoff, not
independently confirmed here) · `Planned` · `Superseded`.

---

## 1. Purpose and instructions for future agents

This file exists so that a **new session with no access to earlier
conversations** can understand what this project is, what has already been
done to it, what is unsafe, and what the next correct action is.

Standing rules — these apply to every future session:

- **Read this file completely before making any project change.**
- **Verify before you act.** Treat every statement here as a lead, not proof.
  Confirm state against Git, GitHub, Supabase and Vercel. State moves; this
  file does not move by itself.
- **Update this file** whenever a meaningful implementation, deployment,
  database, environment, architectural or product decision occurs.
- **"Current status" is the single present-tense truth.** Replace stale
  status rather than appending a contradicting line beside it.
- Append major decisions to the **Decision log**; append a short dated entry
  to the **Change log**.
- Use **UTC timestamps in ISO 8601** format.
- Mark information `Verified`, `Reported`, `Planned` or `Superseded` where the
  distinction matters.
- **Never store secrets** — API-key values, passwords, tokens, service-role
  keys, private customer data, or the contents/checksums of backups.
- **Never claim an external action occurred without evidence.** If you did not
  see the result, say so.
- **Record failed attempts** when they affect future safety.
- Keep this file short enough that a new session can read all of it.
- Preserve historical reasoning, but move obsolete operational instructions
  into **Superseded decisions** rather than leaving them where they could be
  followed by mistake.
- **After each task, explicitly decide whether this file needs updating**, and
  say so in your final message.

---

## 2. Current status — read this first

`Verified 2026-09-05T18:58Z` unless marked otherwise.

| Item                                                       | State                                                                                                     |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Default branch `origin/main`                               | `3c17704` — PR #9 (CORRIDOR) merged. `Verified`                                                           |
| Integration branch `claude/release-alt-signal-integration` | `87ad9be`, 31 commits ahead of `main`, 0 behind. `Verified`                                               |
| Integration PR #12 → `main`                                | **Open, not merged.** All 3 checks green. `Verified`                                                      |
| PR #10 (CORRIDOR depth), PR #11 (ALT SIGNAL)               | Open, kept for traceability. `Verified`                                                                   |
| Production code                                            | Still CORRIDOR. ALT SIGNAL is **not** deployed. `Reported`                                                |
| Supabase migrations applied in production                  | `0001`–`0010` **plus `0011`–`0023`**. `Verified`                                                          |
| Supabase migrations still pending                          | **`0024` only.** `Verified`                                                                               |
| Public tables in production                                | **37** (8 legacy + 29 new), all with RLS enabled. `Verified`                                              |
| Legacy row counts                                          | Unchanged from the pre-migration baseline. `Verified`                                                     |
| `supabase/database.types.ts`                               | Still hand-extended; **not yet regenerated** from the live schema. `Verified`                             |
| Pre-migration data snapshot                                | Created in an earlier session's container; **not present in the current container**. `Reported` — see §9. |

> **This supersedes the handoff statement that migrations `0011`–`0024` were
> unapplied.** Between 2026-09-05T18:37Z and 2026-09-05T18:54Z, migrations
> `0011` through `0023` were applied to the live project — `0023` landed while
> this file was being written. **Migration work was actively in progress at
> the time of writing**, so **always re-run `list_migrations` before doing
> anything database-related**: `0024` may already have landed, and another
> session may be operating on this project.

**Next safe action:** §13, step 1 — re-verify migration state, then apply
`0024` (if still pending) through the authenticated Supabase MCP
`apply_migration` operation. Do **not** run `supabase db push` (see §8).

---

## 3. Product identity and intended users

**ALT SIGNAL** is the private, invitation-only lead-intelligence and wholesale
sales operating system of **Arab Land Trading LLC** (Dubai pet-supply
wholesaler, est. 2001, Al Quoz). It is an internal tool, not a public SaaS.

Lineage of this repository:

1. **AISEO** — website-audit SaaS (original product; tables retained).
2. **CORRIDOR** — market-entry intelligence reports (merged as PR #9; still
   what production serves today).
3. **ALT SIGNAL** — the current product (integration PR #12, unmerged).

What ALT SIGNAL does:

- Discovers and researches prospective wholesale customers across the UAE/GCC
  from the public record.
- Organises accounts, contacts, territories and campaigns.
- Produces evidence-backed, decomposed lead scores with explanations.
- Maintains a relationship graph with explicit provenance states.
- Surfaces colleague-confirmed or API-verified introductions only.
- Drafts grounded outreach for human review — **it never sends**.
- Manages pipeline, tasks, playbooks and meeting briefs.
- Monitors watchlists and commercial signals within budget caps.
- Provides internal analytics with sample-size safeguards.
- Supports controlled imports, exports and administrative operations.

What it is **not**: a public self-service marketplace, and not dependent on a
customer website URL. There is no public sign-up — a signed-in non-member sees
`/request-access` and nothing else. `Verified` in code (`config/brand.ts`,
`lib/auth/membership.ts`, `app/request-access`).

---

## 4. Repository, branches and pull requests

- Repository: `MrMolegend/AISEO` · local checkout `/home/user/AISEO`.
- Default branch: `main`.

| PR  | Title                           | Head → base                                                             | State                        |
| --- | ------------------------------- | ----------------------------------------------------------------------- | ---------------------------- |
| #9  | CORRIDOR market-entry           | `claude/corridor-market-entry` → `main`                                 | **Merged** 2026-09-01T23:39Z |
| #10 | CORRIDOR product depth          | `claude/corridor-product-depth` → `claude/corridor-market-entry`        | Open (traceability)          |
| #11 | ALT SIGNAL lead intelligence    | `claude/alt-signal-lead-intelligence` → `claude/corridor-product-depth` | Open (traceability)          |
| #12 | Release integration onto `main` | `claude/release-alt-signal-integration` → `main`                        | **Open — the release**       |

All `Verified` via the GitHub API in this session.

Integration facts (`Verified`):

- `claude/release-alt-signal-integration` was cut from `origin/main` and
  carries exactly **31** unique commits from PR #10 and PR #11, replayed in
  order, with no duplication of PR #9's work.
- The integration head tree (`87ad9be`) is **byte-identical** to the CI-tested
  PR #11 head tree (`cf03608`) — both resolve to tree
  `fe7e29e96a5983be6321eb66756e37e2c368e19f`, and `git diff` between the two
  commits is empty.
- PR #12 checks, all `success`: _Typecheck, lint, test, build_, _End-to-end_,
  _Vercel Preview Comments_.
- Commit hashes age. **Always re-resolve them; never assume `87ad9be` is still
  the head.**

Working branch for this documentation task:
`claude/alt-signal-project-memory-yenxwz`.

---

## 5. Architecture and external services

Stack (`Verified` from `package.json` on the integration branch): Next.js 16 /
React 19 / TypeScript 5.9, Tailwind 4, Zod 4, Supabase JS + SSR, Anthropic SDK,
Upstash Redis, Vitest 4, Playwright, ESLint 9, Prettier 3. Node ≥ 20.9.

Production services:

| Service       | Detail                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| Vercel        | `https://aiseo-three-omega.vercel.app` (`Reported` — not reachable from the build sandbox; egress proxy denies it) |
| Supabase      | project `euyhkmtxdigdnvmboebf`, region `eu-west-1`, **Free plan** (`Verified`)                                     |
| Anthropic     | report/brief synthesis                                                                                             |
| Tavily        | web research provider                                                                                              |
| Upstash Redis | rate limiting and caching across instances                                                                         |

**No Google dependency of any kind.** Google Places and related APIs were
deliberately removed; `GOOGLE_PLACES_API_KEY` is not read and must not be set.
`/api/health` reporting `places: "disabled"` is the healthy result.

Code shape (`Verified`, `ARCHITECTURE.md` §"Domain map"): every domain store
follows a two-driver pattern — an in-memory driver (tests, keyless local dev)
and a Supabase driver using the least-privileged service role with ownership
enforced inside every query. Domains: `lib/alt`, `lib/icps`, `lib/campaigns`,
`lib/discovery`, `lib/leads`, `lib/relationships`, `lib/linkedin`,
`lib/scoring`, `lib/outreach`, `lib/pipeline`, `lib/signals`, `lib/insights`,
`lib/imports`. The brand name lives only in `config/brand.ts`, enforced by a
unit test.

With no environment configured, the whole product runs on fixtures with no
network egress and no cost. `/api/health` names the driver serving each
subsystem and returns **503** if a development driver is serving in
production.

---

## 6. Implemented capabilities

All `Verified` present on the integration branch (routes under `app/`,
domain logic under `lib/`, covered by the test suite).

- **Roles, membership, invitations** — five roles (`super_admin`,
  `sales_manager`, `sales_rep`, `analyst`, `viewer`) in `team_members`, read
  per request; `/team`, `/request-access`.
- **Commercial configuration and ICPs** — `/commercial`, `/icps` — ALT facts
  with provenance, brands, territories, proof points, scoring weights, budget
  caps.
- **Campaigns and bounded discovery** — `/campaigns` — cost preview,
  explicit confirmation, per-campaign and workspace-daily caps, budget
  decremented before each provider call, cancellation-safe terminal states.
- **Lead Explorer and account intelligence** — `/leads`, `/leads/[id]` —
  filters, saved views, audited CSV export, evidence, contacts, score
  decomposition, activity log, merge with undo.
- **Relationship graph and LinkedIn boundary** — `/relationships` —
  eight-state provenance edges plus the capability truth panel.
- **Explainable scoring and honest matching** — pure integer arithmetic,
  named missing inputs, overrides preserved beside the computed number;
  matching distinguishes `already_stocked` / `observed_opportunity` /
  `not_verified` / `restricted`.
- **Outreach Studio** — `/outreach` — deterministic bilingual drafts,
  approval checkbox, copy-only exit, suppression enforced everywhere.
- **Pipeline, tasks, playbooks, command palette** — `/pipeline`, `/tasks`,
  `Ctrl/Cmd-K`.
- **Watchlists, signals, territories, insights** — `/watchlists`,
  `/territories` (schematic SVG GCC map, no mapping provider),
  `/intelligence` (sample-size floors).
- **Meeting briefs** — `/leads/[id]/brief`, assembled from stored records only.
- **Admin operations, imports, exports, privacy** — `/admin`, `/imports`,
  `/privacy`, `/account`.
- **Signature ALT SIGNAL motion and responsive UI** — mobile, accessibility
  and reduced-motion support, verified by the e2e suite and visual QA.
- **Legacy compatibility** — earlier products' tables untouched, report URLs
  (`/research/[publicId]`, `/shared/[token]`) still work for their owners,
  nothing reinterprets legacy rows as ALT leads; marketing routes redirect to
  the sign-in gateway; `robots.ts` disallows everything.

---

## 7. Security, privacy and LinkedIn boundaries

Non-negotiable rules for every future session:

- Authorization roles come from Supabase **`app_metadata`** (and, for ALT
  SIGNAL, from the `team_members` table read per request) — **never** from
  user-writable `user_metadata`. `app_metadata.role` is only the bootstrap for
  the first administrator.
- `super_admin` is assigned deliberately, to a named operator account.
- The Supabase **service-role key must never reach the browser**. Never expose
  any server credential through a `NEXT_PUBLIC_` variable.
- RLS is enabled on every exposed public table. New internal tables use RLS
  with **no policies** (deny-all) and are reached only through the service
  role, with ownership enforced inside each query.
- Every authorization denial renders a 404, not a 403.
- Do not fabricate sources, contacts, relationships, metrics or company facts.
- Preserve legacy report access and data; never treat a legacy report as an
  ALT lead.
- Never silently send outreach. Keep imports bounded and validated. Preserve
  audit trails and idempotency protections.

**LinkedIn boundary** (`Verified` in `lib/linkedin/`, `.env.example`,
`ARCHITECTURE.md`):

- `LINKEDIN_MODE` ∈ `disabled` (default) · `openid_only` ·
  `partner_sales_access`.
- **`disabled` is a healthy, fully functional operating state.**
- `openid_only` enables Sign In with LinkedIn — identity verification only.
- `partner_sales_access` is a capability **contract slot** that ships **no**
  partner-data functionality in this release; setting it grants nothing beyond
  `openid_only`, and the admin panel says so.
- Capabilities derive from **granted OAuth scopes**, never from the presence of
  an environment variable.
- Never scrape LinkedIn, automate its website, reuse cookies, bypass
  restrictions, or call unofficial endpoints. `linkedin.com` is on the
  non-crawlable host list.
- Public LinkedIn URLs found via search are labelled `public_search_index`.
- "Verified direct connection" renders only for `official_api_verified_direct`
  and `employee_confirmed_direct`.
- ALT SIGNAL never sends messages. A human approves and copies the draft.

---

## 8. Database and migration state

**Do not run `supabase db push` or `supabase db push --include-all` against
this project.** `Verified` reason: production migration-history entries use
14-digit timestamp versions (e.g. `20260823192240`) while the repository's
migration files use four-digit ordinals (`0001`…`0024`). The two version sets
have **no literal overlap**, so `db push` can attempt to replay migrations that
are already applied. Apply pending migrations **individually and in numeric
order** through the authenticated Supabase MCP `apply_migration` operation, and
**stop at the first error**. Never improvise a repair; never run a `-- down`
block without a separate, reviewed plan.

> Note the contradiction: `ARCHITECTURE.md` still instructs `supabase db push`
> in two places. **This memory file wins.** Correcting `ARCHITECTURE.md` is
> tracked in §12.

### Applied in production (`Verified 2026-09-05T18:58Z`)

`0001`–`0010` (recorded under legacy names such as `research_platform`,
`market_entry_source_evidence`) **and** `0011_business_profiles` through
`0023_pipeline_and_productivity`, applied 2026-09-05T18:37Z–18:54Z with
ordinal-prefixed names but still 14-digit versions.

### Pending (`Verified 2026-09-05T18:58Z`)

| File                              | Adds                    |
| --------------------------------- | ----------------------- |
| `0024_watchlists_and_signals.sql` | `watchlists`, `signals` |

### Static review of `0011`–`0024` (`Verified` by reading the SQL)

- Additive only — nothing dropped, renamed or rewritten.
- **31 new tables** in total, every one with `enable row level security` and
  **no** `create policy`.
- Grants target **`service_role` only**; each file revokes from
  `anon, authenticated, public` first.
- Exactly **two** migrations add columns to the existing `research_jobs`
  table: `0013` (`profile_id`) and `0016` (`attempt_count`, `heartbeat_at`,
  stall-sweep index). `0023` also adds columns to the new `lead_accounts`.
- Partial unique indexes carry the idempotency guarantees (one active run per
  campaign; one task per playbook step per account; one signal per watch+URL).
- Each file ships a commented `-- down` block.
- Personal data cascades from `auth.users`; shared work records use
  `ON DELETE SET NULL` so team history survives a member's deletion.

### Verified production state after `0011`–`0023`

- 37 public tables, **all** with RLS enabled.
- Security advisors (read at 2026-09-05T18:53Z, when 33 tables existed):
  32 × `rls_enabled_no_policy` at level **INFO** — this is the intended
  deny-all design, not a defect — plus one **WARN**,
  `auth_leaked_password_protection` (see §12). Re-read the advisors after the
  remaining migration.
- Legacy row counts unchanged: `audits` 8, `leads` 1, `audit_events` 0,
  `user_profiles` 1, `token_wallets` 1, `research_jobs` 2, `token_ledger` 5,
  `research_sources` 45.
- `alt_territories` holds 13 seeded GCC rows; every other new table is empty.
- `0023`'s tables (`pipeline_history`, `activities`, `sales_tasks`,
  `saved_views`) are present, empty and RLS-enabled.

### Generated types

`supabase/database.types.ts` still carries a hand-written header saying the
`0011`+ tables were typed by hand because those migrations "have deliberately
not been applied". That note is now **stale for `0011`–`0023`**. Regenerate the
file from the live schema once `0024` is applied, and delete the note with it.

---

## 9. Backups and recovery

A pre-migration application-data snapshot was reported as created outside Git
at `../AISEO-private-backups/2026-09-05-pre-alt-signal/`, containing separate
JSON exports for the eight legacy public tables, migration history, schema
metadata and SHA-256 checksums. `Reported`.

**Verification result (`Verified 2026-09-05T18:56Z`): that directory does not
exist in the current container.** Sessions run in ephemeral containers, and
this one was provisioned after the snapshot was taken. Treat the snapshot as
**unavailable to this session** unless an operator confirms it exists on a
machine that persists. Do not assume a restore path is in reach.

Rules that stand regardless:

- The snapshot is private and untracked. It must **never** be committed, and
  its row contents and checksums must never appear in this file or any other
  repository file.
- Keep it until production has been stable on ALT SIGNAL for a meaningful
  period.
- The row counts in §8 are the integrity baseline: legacy counts must remain
  unchanged through the release.
- Application-level rollback is a Vercel instant rollback. The migrations are
  additive, so an application rollback never orphans data.

---

## 10. Testing and verification

Baseline recorded before the production migration work (`Reported`, from the
prior session's authoritative run — replace these figures whenever a newer
authoritative run supersedes them):

- `npm run verify` passed (typecheck + ESLint + Prettier check + tests).
- **1,118** unit/integration tests across **57** files passed.
  (`Verified`: the integration branch contains exactly 57 `*.test.ts` files.)
- Production build passed.
- Full desktop Playwright suite: **116/116**.
- CI, desktop + mobile: **232/232**.
- 56 visual captures inspected across desktop, phone, 320px, light, dark and
  reduced-motion; responsive defects found were fixed and reverified.

`Verified` independently: PR #12's three GitHub checks are all green on
`87ad9be`, including _Typecheck, lint, test, build_ and _End-to-end_.

Commands (`Verified` in `package.json`): `npm run verify`, `npm test`,
`npm run test:e2e`, `npm run build`, `npm run shots`, `npm run format:check`.
No test makes a paid API call; providers pin to deterministic fixtures.

---

## 11. Environment-variable contract

**Names and shapes only — never record a value here.**

| Variable                                                                                             | Purpose                                                                                                     |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                                               | Canonical URLs and auth redirects                                                                           |
| `NEXT_PUBLIC_SUPABASE_URL`                                                                           | Auth and storage (needed at **build** time)                                                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `…_ANON_KEY`)                                             | Browser auth client (build time)                                                                            |
| `SUPABASE_SERVICE_ROLE_KEY`                                                                          | Server-only storage. **Never in a browser bundle**                                                          |
| `AI_PROVIDER`, `AI_MODEL`, `ANTHROPIC_API_KEY`                                                       | Synthesis (`mock` \| `anthropic`)                                                                           |
| `RESEARCH_PROVIDER`, `TAVILY_API_KEY`                                                                | Web research (`mock` \| `tavily`)                                                                           |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`                                                 | Cross-instance rate limits                                                                                  |
| `IP_HASH_SALT`                                                                                       | Hashing IPs; raw addresses are never stored                                                                 |
| `RESEARCH_RATE_LIMIT_PER_HOUR` / `_PER_DAY`, `RESEARCH_DAILY_GLOBAL_CAP`, `RESEARCH_CACHE_TTL_HOURS` | Abuse and cost controls                                                                                     |
| `WELCOME_TOKEN_GRANT`                                                                                | Leave at `0` in production                                                                                  |
| `ADMIN_GRANT_SECRET`                                                                                 | Operator grant route; absent ⇒ route disabled; min 24 chars                                                 |
| `JOB_STALL_MINUTES`                                                                                  | Optional; heartbeat age before a run counts as stalled (default 15)                                         |
| `LINKEDIN_MODE`                                                                                      | `disabled` (default, healthy) \| `openid_only` \| `partner_sales_access`                                    |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` / `LINKEDIN_REDIRECT_URI`                            | Only when `LINKEDIN_MODE` ≠ `disabled`                                                                      |
| `LOG_LEVEL`                                                                                          | Logging verbosity                                                                                           |
| `AUTH_TEST_DRIVER`, `E2E_ALLOW_LOCAL_FETCH`                                                          | **Test-only.** The app refuses to start with these alongside real credentials or on a production deployment |

Every variable is validated at boot by `lib/env.ts`. `GOOGLE_PLACES_API_KEY`
is not read and must not be set. `maxDuration` on the research route is 300s,
which needs Vercel Pro or Fluid Compute.

Supabase dashboard configuration is **not** optional: email sign-in enabled,
`${NEXT_PUBLIC_SITE_URL}/auth/confirm` in the redirect allow list, and all four
email templates rewritten to emit `token_hash` (the flow is `token_hash` +
`verifyOtp()`, chosen because PKCE's verifier cookie does not survive a mail
app's in-app browser). Exact HTML lives in `ARCHITECTURE.md`.

---

## 12. Known limitations and technical debt

- LinkedIn partner sales data is unavailable unless official approved access is
  obtained later. LinkedIn sign-in is optional and disabled by default.
- Outreach is deterministic and template-based; there is no automatic delivery
  of any kind, by design.
- Analytics require real recorded outcomes and enforce a minimum sample size.
- Arab Land Trading facts and brand assets must be reverified against official
  sources. `www.arablandtrading.com` was blocked by the egress proxy
  (`EGRESS_BLOCKED`, checked 2026-09-03), so the UI ships a typographic
  wordmark and provisional colours defined centrally in `app/globals.css`.
- **The migration-history naming mismatch remains unresolved** (ordinals vs.
  14-digit versions). `supabase db push` stays prohibited until a separate,
  reviewed migration-history reconciliation project is completed.
- **`ARCHITECTURE.md` contradicts the safe release procedure**: it instructs
  `supabase db push` and states that `0011`–`0024` are unapplied. Both are now
  wrong. Correcting it is deliberately out of scope for the documentation task
  that created this file, and should be done in a follow-up change.
- The `ARCHITECTURE.md` production smoke test is still written for CORRIDOR
  (e.g. it expects the headline "Enter new markets with evidence"). ALT SIGNAL
  has no public marketing page; use §13 instead.
- `supabase/database.types.ts` header is stale — see §8.
- Supabase **leaked-password protection is disabled** (`Verified`, security
  advisor WARN). Handle separately from this release.
- The pre-migration snapshot is not present in the current container (§9).
- The production domain is not reachable from the agent sandbox, so production
  state cannot be verified from here — it must be checked by an operator or
  from an environment with egress to it.

---

## 13. Exact next actions

Do these in order. Stop at the first failure and record it here.

1. **Re-verify migration state** with Supabase `list_migrations` and
   `list_tables` before touching anything. As of 2026-09-05T18:58Z:
   `0011`–`0023` applied, `0024` pending, 37 public tables. Another session may
   have moved this on — trust the live answer, not this line.
2. **Apply `0024`**, and anything else still pending, individually and in
   numeric order through the authenticated Supabase MCP `apply_migration`.
   Never `db push`. Stop immediately at the first error.
3. **Verify** afterwards: migration history, table count (expect **39** public
   tables once `0024` lands), RLS enabled with no policies on every new table, grants limited to
   `service_role`, expected indexes and triggers, seeded rows, legacy row
   counts unchanged (§8), and the security advisors.
4. **Regenerate `supabase/database.types.ts`** from the live production schema.
5. **Remove the obsolete hand-written pending-migration note** from the
   generated types header.
6. **Commit and push** the regenerated types to
   `claude/release-alt-signal-integration`.
7. **Wait for PR #12 CI to pass again** on the new head.
8. **Merge PR #12 into `main`.**
9. **Allow or promote the correct Vercel production deployment.**
10. **Verify `/api/health`** — expect 200 and no development driver in
    production.
11. **Test sign-in and the core ALT SIGNAL workflow** end to end.
12. **Set the operator account's `app_metadata.role` to `super_admin`.**
13. **Sign out and back in** so the refreshed JWT carries the role, then create
    the first `team_members` row from `/team`.
14. **Invite the rest of the team** from the same page.
15. **Keep the safety snapshot** until production has been stable.
16. **Close PRs #10 and #11** only after PR #12 is merged and production is
    verified.

Keep production code unchanged until step 8. Do not deploy ahead of the
migrations.

---

## 14. Decision log

- **2026-09-01 — Merge CORRIDOR (PR #9) to `main`.** Established the
  market-entry product as the production baseline. `Verified`.
- **2026-09-03 — Pivot to ALT SIGNAL.** The product becomes an internal,
  invitation-only wholesale lead-intelligence system for Arab Land Trading.
  No public sign-up, no dependency on a customer website URL. `Verified` in
  code.
- **2026-09-03 — LinkedIn is honest or it is off.** Three declared modes,
  capabilities derived from granted OAuth scopes, no scraping in any mode,
  `partner_sales_access` ships no capability. `Verified`.
- **2026-09-03 — Nothing sends.** No delivery integration, no recipient column
  in the schema, human approval and manual copy only. `Verified`.
- **2026-09-03 — Deny-all RLS for internal tables.** New tables enable RLS with
  no policies; access is exclusively through the least-privileged service role
  with ownership enforced in each query. `Verified`.
- **2026-09-03 — Brand assets deferred.** Official assets unreachable from the
  build environment; typographic wordmark and provisional colours used, both
  centralised for a one-place swap. `Verified`.
- **2026-09-05 — Clean integration branch instead of a chained merge.**
  `claude/release-alt-signal-integration` was cut from `origin/main` and 31
  unique PR #10/#11 commits were replayed in order, producing a tree
  byte-identical to the CI-tested PR #11 head, without duplicating PR #9.
  PRs #10 and #11 stay open for traceability. `Verified`.
- **2026-09-05 — `supabase db push` prohibited on this project.** Production
  migration history uses 14-digit timestamp versions with no literal overlap
  with the repository's four-digit ordinals, so a push risks replaying applied
  migrations. Migrations are applied individually via Supabase MCP
  `apply_migration`, stopping at the first error. `Verified` reasoning.
- **2026-09-05 — Private pre-migration snapshot taken outside Git.** Exports
  for the eight legacy tables plus history, schema metadata and checksums,
  stored untracked and never committed. `Reported`.
- **2026-09-05T18:37Z–18:54Z — Migrations `0011`–`0023` applied to
  production**, individually and in order, with legacy row counts unchanged
  afterwards. `Verified`. This was carried out by a session other than the one
  that wrote this file, and was still in progress while it was written.
- **2026-09-05 — This file becomes the canonical project memory.** Where it
  conflicts with `README.md` or `ARCHITECTURE.md` on release procedure or
  current state, this file wins until those documents are corrected.

### Superseded decisions

- ~~"Migrations `0011`–`0024` are pending; production contains only
  `0001`–`0010`."~~ **Superseded 2026-09-05T18:58Z** — `0011`–`0023` are
  applied; only `0024` remains.
- ~~"Apply the pending migrations with `supabase db push`" (`README.md`,
  `ARCHITECTURE.md`).~~ **Superseded 2026-09-05** — prohibited; see §8.
- ~~"Production has eight public tables."~~ **Superseded 2026-09-05T18:58Z** —
  37 public tables.

---

## 15. Change log

- **2026-09-05T18:58Z** — Re-verified live migration state immediately before
  finishing: `0023_pipeline_and_productivity` had been applied at
  2026-09-05T18:54Z by another session, taking production to 37 public tables
  with only `0024` pending. Status, database, next-action and decision-log
  sections updated accordingly.
- **2026-09-05T18:56Z** — Created `ALT_SIGNAL_PROJECT_MEMORY.md` as the
  canonical project memory. Verified branch/PR state, integration tree
  identity, PR #12 checks, the static review of migrations `0011`–`0024`, and
  live Supabase migration/table/advisor state. Recorded that migrations
  `0011`–`0022` were already applied (superseding the handoff), that the
  pre-migration snapshot is absent from this container, and that
  `ARCHITECTURE.md`'s `db push` instruction contradicts the safe procedure.
  No application code, migration, environment variable or deployment was
  changed.
