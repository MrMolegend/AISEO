# CORRIDOR

**Enter new markets with evidence.**

CORRIDOR produces one thing: a **Market Entry Intelligence Report** for a small
brand, wholesaler, distributor or founder deciding whether to sell into a new
country. You describe what you sell and where you want to take it; the research
runs against the public record; the report tells you what the evidence supports,
what it does not, and what it could not establish at all.

The product name lives in exactly one file,
[`config/brand.ts`](config/brand.ts), and a unit test fails if it appears as a
string literal anywhere else.

## The ideas that shape everything

**We do not ask for your website.** There is no URL field, no crawl of your
domain, and nothing in the schema shaped like one — a test reads the intake
source file and fails if a field named for a website, URL or domain ever appears.
What you sell is something you can describe better than a homepage can, and a
homepage was never evidence about a market you have not entered.

**External retrieval is enrichment, never a dependency.** After the search phase
the pipeline opens a handful of the sources it found, and gives up on any of them
freely. `retrieveSources()` does not throw — not for a robots refusal, not for a
timeout, not if every single fetch fails. A blocked page becomes a recorded
limitation the report shows, not an error the customer sees. An authority's
website being slow on a Tuesday is not a reason to fail a report someone paid
for.

**A claim that cannot be supported is marked, not asserted.** A regulatory,
financial or market-size claim needs a source we opened ourselves; a search-index
summary is a weak signal and is labelled as one. Where the support is not there,
the claim is demoted to unverified with the gap recorded, and the report ships.

**The evidence grade is derived, never awarded.** Verified fact · you told us ·
modelled estimate · strategic inference · unverified. One pure function maps
basis, source category and retrieval mode onto a grade, so a confident sentence
cannot dress itself up as a researched one.

**The verdict is arithmetic, not prose.** Readiness is seven weighted factors,
each computed from validated fields, each carrying the sentence shown beside it.
Nobody has to take 62 on trust — they can see which factor they disagree with.

**A balance is only ever the result of an operation with a reason attached.**
There is no `setBalance` anywhere in the system. Credit is reserved, then either
finalised or refunded, by database functions that take a row lock and an
idempotency key. Finalisation happens **after** the quality gate, so a customer
is only ever charged for a report that was worth producing.

## Running it locally

```bash
npm install
npm run dev
```

That is the whole setup. With no `.env` at all the application runs end to end on
in-memory drivers and fixture data: no API key, no accounts, no cost, no network
egress. `/api/health` reports which provider is serving each subsystem.

To use real services, copy `.env.example` to `.env.local`. Every variable is
validated at boot, so a typo fails immediately with the variable's name rather
than surfacing later as an undefined-property crash.

There is no Google dependency of any kind. `GOOGLE_PLACES_API_KEY` is not read,
not required and not supported; `/api/health` reports `places: "disabled"`, and
that is a healthy steady state rather than something to fix.

## Commands

| Command            | What it does                                      |
| ------------------ | ------------------------------------------------- |
| `npm run dev`      | Development server                                |
| `npm run verify`   | Typecheck, lint, format check, unit + integration |
| `npm test`         | Unit and integration tests                        |
| `npm run test:e2e` | Playwright, against a real production build       |
| `npm run build`    | Production build                                  |
| `npm run shots`    | Screenshot QA across the twelve reviewed views    |

`npm run verify` is exactly what CI runs before the build step, so a green local
run means a green CI run.

No test makes a paid API call. The synthesis provider and the research provider
both fall back to deterministic fixtures when no key is configured, and the test
setup pins them there. A production deployment does the opposite: it refuses to
start a customer's job at all when either provider is a fixture.

## What one report costs

One Market Entry Intelligence Report costs **one report credit**. That is the
only unit a customer ever sees.

Internally a credit is 100 tokens on the existing append-only ledger, which is
what lets balances granted before this release keep working unchanged. The
conversion happens on the server; no token figure is ever sent to a browser, and
an end-to-end test walks every page signed in and signed out and fails on the
word.

**Purchasing is not implemented, and is not part of this release.** There is no
payment integration and no simulated one. During the beta, credits are granted
manually through the operator route below. Wiring a payment provider means
crediting a wallet through the existing `grant()` path — the accounting is
already there.

## Granting credit

The one operation that creates spendable value from nothing, so its reachability
matters more than its implementation.

`POST /api/admin/grant-tokens` requires `ADMIN_GRANT_SECRET`. If that variable is
absent the route is **disabled outright** — not open, not warning — and a wrong
secret returns 404 rather than 403, because an endpoint that admits it exists is
an endpoint worth attacking. The secret must be at least 24 characters or the
application refuses to boot. Every grant carries an operator reference that
becomes its idempotency key, so re-running a command does not stack credit.

`WELCOME_TOKEN_GRANT` defaults to `0`. Leave it there in production: an account
that silently receives spendable credit is a cost leak.

## The workspace around a report

A report is the middle of the product, not the end of it:

- **Business profiles** (`/profiles`) describe what you sell once; every new
  brief starts prefilled from one. The website field is optional everywhere —
  when present it is one research seed among many, and a site that cannot be
  read is a recorded limitation, never a failed report.
- **Drafts** save server-side as you type, with a visible Saving/Saved state,
  and survive devices and sessions. Two tabs cannot silently overwrite each
  other — the stale one is told.
- **Versions**: a new run for the same profile is a new version, and any two
  versions compare structurally — verdict, readiness, factors, risks,
  requirements, plan — computed, not paraphrased.
- **Scenario Lab** (`/research/<id>/scenarios`): deterministic what-ifs on
  your own numbers, every figure carrying its formula, presets that never
  invent a demand range for you.
- **Actions** (`/actions`): the report's 30/60/90 plan as an editable
  workspace, imported exactly once however often you press the button.
- **Evidence** (`/research/<id>/evidence`): every source, filterable by
  publisher kind, retrieval mode, confidence, section and competitor, with
  what could not be read listed as limitations.
- **Sharing** (`/research/<id>/sharing`): reports are private by default.
  Sharing mints revocable, optionally expiring links; the server keeps only a
  hash of each token.
- **Your data** (`/account`): one-file export, typed-phrase deletion.

## The research, in outline

1. **Four-stage intake** — what you sell, where you want to go, your commercial
   position, what you need to know. Auto-saved for signed-in users; nothing is
   validated on the way back.
2. **A bounded query plan** across twelve investigation areas, built in code from
   your brief rather than by the model, so the number of paid calls is a budget
   decision. **At most 3 advanced and 9 basic searches, 12 in total**, enforced
   server-side by a budget object the runner cannot bypass.
3. **Best-effort retrieval** of the highest-authority sources found — at most 8
   fetches, 8MB, 45 seconds, two per publisher. SSRF-guarded, robots-respected,
   and never issued at all to platforms whose terms forbid it.
4. **One synthesis call, and at most one repair.** The model receives page text
   and search excerpts inside a nonce boundary and returns a strictly typed
   object. It never chooses a verdict, a score, a grade or a margin.
5. **Validation, grading and demotion** — citations are cross-referenced against
   the registry, and any sensitive claim without an accessible authority behind
   it is demoted to unverified with a limitation generated for it.
6. **The quality gate** decides whether the report is worth charging for. If it
   is not, the credit is refunded automatically and the failure explains why.

## Testing what matters

- `tests/integration/retrieval-best-effort.test.ts` — the central promise, tested
  at the limit: a report still completes and is charged for when **every** fetch
  is refused, and the claims that needed an authority are marked unverified
  rather than dropped or asserted anyway.
- `tests/integration/market-entry-lifecycle.test.ts` — the money path. Charged
  once and only after the gate, refunded automatically on a gate failure, never
  double-refunded however many times the failure path runs. Each assertion checks
  the balance _and_ the ledger, because a job can look correct and still have
  stranded a hold.
- `tests/integration/example-dossier.test.ts` — pins the published worked example
  to what the real pipeline produces from the same fixtures, so the marketing
  page cannot quietly stop being the product.
- `tests/integration/legacy-report.test.ts` — reports from the previous product
  still parse, still render and still live at the same URLs.
- `tests/unit/quality-gate.test.ts` — weighted towards what must **not** fire.
  One inaccessible page can never fail a report.
- `tests/unit/design-tokens.test.ts` — every foreground/background pair in the
  palette, resolved through oklch to sRGB and measured for WCAG contrast.
- `tests/e2e` — signed out and signed in, in both themes, from 320px up, with
  axe. The signed-in session comes from an in-memory driver that the application
  refuses to load alongside real credentials.

## Signing in

Create an account with an email address, confirm it, choose a password, then use
that password from then on. A magic link is available as a fallback, and there is
a password-recovery path.

The email link flow is `token_hash` + `verifyOtp()` at `/auth/confirm`, chosen
because it needs nothing from the browser that requested the link — PKCE needs a
verifier cookie that a mail app's in-app browser does not have, which is what
broke sign-in in production once. **The Supabase email templates must be edited
to match**; the exact HTML is in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Reports from the previous product

This repository previously shipped a four-package research platform. Those
reports are not migrated, not rewritten and not deleted: they remain readable at
their existing URLs, keep their CSV exports, and render through the renderer that
produced them with a banner saying where they came from. They are simply no
longer offered.

## Deploying

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the deployment checklist, the
migration list, and what to verify after a deploy.

## What this will not do

It does not ask for, store or fetch your website.

It does not use any Google service — no Places, no Maps, no Business Profile, no
Cloud billing, and no scraping of search results.

It does not scrape LinkedIn, Instagram, Facebook, TikTok or X, or attempt to work
around a CAPTCHA, a robots refusal or an authentication wall. Where a source can
be cited but not fetched, it is cited without being fetched and marked as such.

It does not invent numbers. Market size, growth rates, prices, tariff rates,
revenue, employee counts, certifications and contact details are reported where a
source supports them and named as gaps where none does. A margin scenario with a
missing input renders the missing input, never a plausible figure.

It is not legal advice. Regulatory findings are research with their sources
attached, and say so.
