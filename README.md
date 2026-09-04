# ALT SIGNAL

**Wholesale Growth Intelligence.**

ALT SIGNAL is the private, invitation-only lead-intelligence and wholesale
sales workspace of **Arab Land Trading LLC** — the Dubai pet-supply wholesaler
(est. 2001, Al Quoz). It finds prospective wholesale customers across the UAE
and the wider GCC from the public record, explains every judgement it makes,
and helps the sales team work those accounts — without ever sending a message,
inventing a fact, or touching a channel the team did not choose.

There is no public sign-up. A signed-in person who is not a team member sees a
request-access page and nothing else; membership is granted by an
administrator and read from the database on every request, never from a token
a browser can keep.

The product name lives in exactly one file,
[`config/brand.ts`](config/brand.ts), and a unit test fails if it appears as a
string literal anywhere else.

## The ideas that shape everything

**Nothing sends, ever.** The outreach studio drafts; a person reviews,
approves, copies and sends on their own channels. There is no delivery
integration, no recipient column in the schema, no queue that could grow one.
Playbooks create tasks with dates — recommendations, not automation.

**Evidence-led, website-optional.** Accounts are discovered from sources that
actually name them — a directory listing, a news profile, their own site if
they have one. A listicle headline never becomes a company; a business without
a website is a normal case, not an error. Every claim carries its source URL,
category, retrieval mode and date.

**Not verified is not a gap.** Product matching distinguishes an _observed
opportunity_ (a page said something) from _not verified_ (nothing said either
way). Scoring is deterministic integer arithmetic with configurable weights;
every score renders its decomposition, missing inputs are named in the
denominator, and a manager's override preserves the computed number beside
the reason.

**Relationships are provenance, not vibes.** A connection edge carries one of
eight states, and the words "Verified direct connection" render only for the
two that earn them (an official API verification or a colleague's explicit
confirmation). "Might know them" is stored as exactly that.

**LinkedIn is honest or it is off.** Three modes: `disabled` (default, fully
functional product), `openid_only` (Sign In with LinkedIn — identity
verification, nothing else), and a `partner_sales_access` contract slot that
ships **no** capability in this build. No mode scrapes, automates a browser,
reuses cookies, or calls unofficial endpoints — the admin panel states
capability-by-capability what is on, off, and why. Public LinkedIn URLs found
through a search index are labelled `public_search_index` and are never
crawled.

**Spending is capped before it happens.** A campaign shows its cost ceiling
and requires confirmation; the engine decrements budget before each provider
call; per-campaign and workspace-daily caps refuse over-budget work with the
numbers in the message. Watchlist checks spend from the same daily cap. Tests,
CI and screenshots never call a paid API — a deterministic fixture world
answers instead.

**Small samples are not truths.** Outcome analytics compute from recorded
results only, every rate carries its `n`, and below the sample floor the page
says "not enough data" instead of a percentage.

**Suppression is absolute.** An account, contact or channel on the suppression
list is excluded from drafting everywhere, and the exclusion survives
re-discovery.

## Roles

Five roles, stored server-side in `team_members` (never in user metadata,
never as an email list in code): `super_admin`, `sales_manager`, `sales_rep`,
`analyst`, `viewer`. Authorisation is read per request; an explicit revocation
beats any claim a stale JWT still carries; a denial renders the same 404 a
mistyped URL gets.

## The workspace

| Surface                            | What it does                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/dashboard`                       | Command Center: role-aware first steps and the day's work                                                                      |
| `/commercial`                      | ALT's facts, brands, territories, proof points, scoring weights, budget caps — configuration with provenance, not doctrine     |
| `/icps`                            | Ideal customer profiles: territory, segment, category mix, evidence bar                                                        |
| `/campaigns`                       | Campaign builder with cost preview + confirmation; live run console                                                            |
| `/leads`                           | Lead explorer with filters, saved views and (for export roles) audited CSV export                                              |
| `/leads/[id]`                      | Account intelligence: evidence, contacts, relationships, score decomposition, pipeline controls, activity log, merge with undo |
| `/leads/[id]/brief`                | Printable meeting brief assembled from stored records only                                                                     |
| `/relationships`                   | Confirmation queue and the LinkedIn capability truth panel                                                                     |
| `/watchlists`                      | Bounded, budgeted signal checks on accounts and segments                                                                       |
| `/territories`                     | Schematic SVG GCC map (no mapping provider) with the exact table beside it                                                     |
| `/pipeline`, `/tasks`, `/outreach` | Stage-grouped pipeline, personal task queue, draft review studio                                                               |
| `/intelligence`                    | Outcome analytics with sample sizes                                                                                            |
| `/imports`                         | CSV import with row-by-row preview, idempotent commit and guarded undo                                                         |
| `/admin`                           | Operations: providers, LinkedIn capabilities, budgets, stalled-run repair, team and suppression counts                         |

`Ctrl/Cmd-K` opens the command palette: navigation, saved views, account
search, and save-current-page-as-view.

## Running it

```bash
npm install
cp .env.example .env.local   # defaults run fully in-memory with fixtures
npm run dev
```

With no Supabase configured everything runs on in-memory drivers and the
deterministic fixture research world — a whole discovery campaign works end to
end with no keys and no cost. `/api/health` names the provider serving each
subsystem and reports LinkedIn's mode; `disabled` is a healthy state.

```bash
npm run verify                       # typecheck + unit/integration tests + lint
npx playwright test --project=desktop
```

## Database

Migrations `0001`–`0010` are applied to the live project. Migrations
**`0011`–`0024` exist in this repository and are NOT applied** — they ship
with this work and are applied at deploy time, in order. Each file carries
that warning in its header, RLS enabled with no policies (service-role only),
revoke-then-grant least privilege, and a commented `-- down` block.
`supabase/database.types.ts` is hand-extended for the pending tables and
should be regenerated (`supabase gen types typescript`) once they are applied.

## Legacy

The platform's earlier products (research reports, market-entry assessments)
are preserved: their tables are untouched, their report URLs keep working for
their owners, and nothing reinterprets their data as leads. Marketing routes
redirect to the sign-in gateway; robots are disallowed everywhere — this is an
internal tool.

## What this system will never do

Send messages automatically. Scrape LinkedIn or any site that forbids it.
Invent a contact, a connection, or a commercial fact. Present a rented search
snippet as verified evidence. Spend research budget without a cap and a
confirmation. Show a percentage computed from three data points as if it were
knowledge.
