# ALT SIGNAL — Project Memory

Canonical, single-source project memory for the repository `MrMolegend/AISEO`.
Last updated: **2026-09-05T19:20Z**.

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

`Verified 2026-09-05T19:15Z` unless marked otherwise.

| Item                                                       | State                                                                                               |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Default branch `origin/main`                               | `3c17704` — PR #9 (CORRIDOR) merged. `Verified`                                                     |
| Integration branch `claude/release-alt-signal-integration` | `87ad9be` plus this session's release commits. `Verified`                                           |
| Integration PR #12 → `main`                                | **Open, not merged.** `Verified`                                                                    |
| PR #10 (CORRIDOR depth), PR #11 (ALT SIGNAL)               | Open, kept for traceability. `Verified`                                                             |
| Production code                                            | Still CORRIDOR. ALT SIGNAL is **not** deployed. `Reported`                                          |
| Supabase migrations applied in production                  | `0001`–`0010` **plus `0011`–`0024`** — every one recorded **exactly once**. `Verified`              |
| Supabase migrations still pending                          | **None.** The migration set for this release is complete. `Verified`                                |
| Public tables in production                                | **39** (8 legacy + 31 new). **All 39 have RLS enabled**, 0 policies. `Verified`                     |
| Legacy row counts and content                              | `8, 1, 0, 1, 1, 2, 5, 45` — unchanged, and byte-identical to the pre-migration snapshot. `Verified` |
| Advisors after `0024`                                      | **Zero errors.** Security 39 INFO + 1 WARN; performance 71 INFO. `Verified` — see §8.               |
| `supabase/database.types.ts`                               | Regenerated from the live schema in this session; hand-maintained note removed. `Verified`          |
| Pre-migration data snapshot                                | Re-created and verified in this session, outside Git. `Verified` — see §9.                          |

> **This supersedes every earlier statement that migrations `0011`–`0024` are
> unapplied or that `0024` is pending.** Between 2026-09-05T18:37Z and
> 2026-09-05T19:03Z, `0011` through `0024` were applied to the live project,
> one `apply_migration` operation per file, in numeric order, with verification
> between each. A re-check at 19:15Z confirmed `0024_watchlists_and_signals` is
> recorded exactly once (version `20260905190346`) and was **not** reapplied.
>
> Still **always re-run `list_migrations` before doing anything
> database-related** — another session may be operating on this project.

**Next safe action:** §13 — regenerate types (done in this session) and drive
PR #12's CI to green. There is **no migration left to apply**. Do **not** run
`supabase db push` (see §8).

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

> `ARCHITECTURE.md` was corrected in this session and no longer instructs
> `supabase db push` for this project. If any document contradicts this
> section, **this memory file wins.**

### Applied in production (`Verified 2026-09-05T19:15Z`)

**All of `0001`–`0024`. Nothing is pending.** `0001`–`0010` are recorded under
legacy names (`research_platform`, `market_entry_source_evidence` and so on);
`0011_business_profiles` through `0024_watchlists_and_signals` were applied
2026-09-05T18:37Z–19:03Z under their exact file stems, one `apply_migration`
call per file, in numeric order, each verified before the next began.

Every one of `0011`–`0024` appears in `supabase_migrations.schema_migrations`
**exactly once** — re-checked at 19:15Z, with `0024` at version
`20260905190346`. History holds 24 rows: the 10 pre-existing plus these 14.

### Pending (`Verified 2026-09-05T19:15Z`)

**None.** There is no migration left to apply for this release. A future agent
finding this section unchanged should still re-run `list_migrations` before
acting, but should not "re-apply" anything on the strength of an older
handoff note.

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

### Verified production state after `0024` (`Verified 2026-09-05T19:15Z`)

- **39 public tables** (8 legacy + 31 new). **All 39 have RLS enabled**; no
  table anywhere in `public` is without it.
- **0 RLS policies** in `public` — the deny-all posture is intact, and no
  unintended policy exists.
- **No grants to `anon`, `authenticated` or `PUBLIC`** on any public table. The
  only grantees are the table owner (`postgres`, implicit) and `service_role`.
  All 31 new tables carry their intended `service_role` grants.
- **Advisors: zero errors.** Security — 39 × `rls_enabled_no_policy` at level
  **INFO** (the intended deny-all design, and it fires on the 8 legacy tables
  too, so this is not a regression) plus one **WARN**,
  `auth_leaked_password_protection`, a pre-existing Auth setting unrelated to
  the migrations (see §12). Performance — 71 **INFO** (31 unindexed FKs on
  nullable attribution columns, 40 unused indexes on tables that hold no rows
  yet). No ERROR in either category.
- **Legacy row counts and content unchanged**: `audits` 8, `leads` 1,
  `audit_events` 0, `user_profiles` 1, `token_wallets` 1, `research_jobs` 2,
  `token_ledger` 5, `research_sources` 45 — and each table's content MD5 is
  **byte-identical** to the pre-migration snapshot. `research_jobs` was checked
  twice mid-run (after `0013` and after `0016`), comparing only its original
  columns; it matched both times.
- `alt_territories` holds exactly **13** seeded GCC rows; every other new table
  is empty.
- All required uniqueness/idempotency indexes exist, three of them partial and
  unique as designed (`campaign_runs_one_active`, `sales_tasks_playbook_unique`,
  `action_items_import_unique`) plus the total-unique `signals_dedup_unique`.
- **0 triggers** with a missing or dangling function.

### Generated types

`supabase/database.types.ts` was **regenerated from the live production schema**
in this session and now covers all 39 public tables. The old hand-written header
claiming the `0011`+ tables were typed by hand because those migrations "have
deliberately not been applied" is **gone** — it was false. Do not reintroduce a
hand-maintained table definition; regenerate from the live schema instead.

---

## 9. Backups and recovery

A pre-migration application-data snapshot was reported as created outside Git
at `../AISEO-private-backups/2026-09-05-pre-alt-signal/`, containing separate
JSON exports for the eight legacy public tables, migration history, schema
metadata and SHA-256 checksums. `Reported`.

**Verification result (`Verified 2026-09-05T19:20Z`): the snapshot exists and
is complete in this session's container.** It was re-created before the
migration run: ten JSON files (the eight legacy tables, `schema_migrations`,
and schema metadata covering columns, constraints, indexes, RLS state and
grants), plus a `SHA256SUMS` manifest that verifies clean. Every table's row
count matched production, and each file's content hash matched a hash computed
inside Postgres over the same rows — so the export is provably complete, not
merely plausible. Directory and files are mode `0700`/`0600`.

Sessions run in ephemeral containers, so a **later** session may again find the
directory missing. That is expected: re-verify before relying on it, and never
assume a restore path is in reach without checking.

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
  reviewed migration-history reconciliation project is completed. Future
  production migrations use individually reviewed `apply_migration` operations.
- Supabase **leaked-password protection is disabled** (`Verified`, security
  advisor WARN). Handle separately from this release.
- The production domain is not reachable from the agent sandbox, so production
  state cannot be verified from here — it must be checked by an operator or
  from an environment with egress to it.

---

## 13. Exact next actions

Do these in order. Stop at the first failure and record it here.

**The database work is finished. The next action is type regeneration and
PR #12 verification — not migration application.** Steps 1–5 below are done;
they are kept so a future agent can see what was verified rather than repeat it.

1. ~~**Re-verify migration state**~~ — done. `0001`–`0024` applied, each exactly
   once, 39 public tables (`Verified 2026-09-05T19:15Z`). Still re-run
   `list_migrations` before any database action: another session may move this
   on, and the live answer always beats this line.
2. ~~**Apply `0024`**~~ — done 2026-09-05T19:03Z. **Nothing is pending. Do not
   re-apply `0011`–`0024`.**
3. ~~**Verify**~~ — done: history, 39 tables, RLS on all 39 with 0 policies,
   grants limited to `service_role`, indexes and triggers intact, 13 seeded
   territories, legacy counts and content unchanged, advisors with zero errors
   (§8).
4. ~~**Regenerate `supabase/database.types.ts`**~~ — done in this session from
   the live production schema; all 39 public tables present.
5. ~~**Remove the obsolete pending-migration note**~~ — done; the stale header
   is gone from the generated types.
6. **Commit and push** the regenerated types, this memory file and the
   documentation corrections to `claude/release-alt-signal-integration`.
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
  `0001`–`0010`."~~ **Superseded 2026-09-05T19:15Z** — all of `0011`–`0024`
  are applied, each exactly once. Nothing is pending.
- ~~"Only `0024` remains."~~ **Superseded 2026-09-05T19:15Z** — `0024` landed
  at 19:03Z.
- ~~"Apply the pending migrations with `supabase db push`" (`README.md`,
  `ARCHITECTURE.md`).~~ **Superseded 2026-09-05** — prohibited; see §8. Both
  documents were corrected in this session.
- ~~"Production has eight public tables."~~ **Superseded 2026-09-05T19:15Z** —
  39 public tables.
- ~~"Production has 37 public tables."~~ **Superseded 2026-09-05T19:15Z** —
  39, after `0024`.
- ~~"The pre-migration snapshot is absent from this container."~~
  **Superseded 2026-09-05T19:20Z** — re-created and verified; see §9.

---

## 15. Change log

- **2026-09-05T19:20Z** — Release session. Applied migrations `0011`–`0024` to
  production, one `apply_migration` per file in numeric order, verifying after
  each; `0024` landed at 19:03Z and a re-check at 19:15Z confirmed it is
  recorded exactly once, so it was not reapplied. Final state: 39 public
  tables, RLS on all 39, 0 policies, no `anon`/`authenticated`/`PUBLIC` grants,
  13 seeded territories, legacy row counts and content byte-identical to the
  snapshot, advisors with **zero errors**. Re-created and verified the private
  pre-migration snapshot outside Git. Regenerated `supabase/database.types.ts`
  from the live schema and removed the false "pending migrations" header.
  Corrected `ARCHITECTURE.md` and `README.md` where they contradicted reality.
  No merge, no deploy, no environment-variable change, no role assignment.
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
