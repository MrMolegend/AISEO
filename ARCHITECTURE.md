# Architecture

## Layers

Each layer may only import from the ones above it. The boundaries are enforced by
ESLint where they can be, and by module structure where they cannot.

```
lib/security/     URL validation, SSRF guard, hardened fetch, rate limits
lib/retrieval/    robots.txt, page fetch, favicon        → RawFetchResult
lib/extraction/   parsing, extractors, deterministic checks → SiteFacts
lib/ai/           provider interface, Anthropic, mock, retry → unknown
lib/validation/   schema, cross-reference, sanitise, score  → AuditAnalysis
lib/storage/      Supabase and in-memory drivers
lib/pipeline/     intake and orchestration
components/       presentation
```

## Request flow

```
POST /api/audits
  ├─ validate + normalise URL          (syntactic, isomorphic)
  ├─ reject non-public IP literals     (no DNS needed)
  ├─ cache lookup by url hash          → hit returns instantly, no AI spend
  ├─ global daily cap                  → circuit breaker
  ├─ per-IP sliding window
  ├─ in-flight lock on the url hash    → a double-click costs one call
  └─ create row, return 202 { publicId }
        │
        └─ after() → runAuditPipeline(publicId)
             robots.txt → fetch → extract → analyse → validate → save
                                                          │
GET /audit/{publicId} ─────────────────────────────────────┘
  status decides: processing | report | designed error
```

The response is returned before the work starts. A 90-second synchronous request
is fragile against browser, proxy and mobile-network timeouts, and a refresh would
abandon it. `runAuditPipeline` is a pure function of an audit id, so replacing
`after()` with a queue later changes how it is called, not what it does.

## The two-halves schema

`AuditReport` splits into `facts` (measured) and `analysis` (generated).

Reasoning:

1. **Anti-hallucination.** The model interprets measurements it is given rather
   than producing them. `evidence` on each issue points at the real value, so a
   fabricated finding has nowhere to hide.
2. **Computed overall score.** A weighted mean over six categories, calculated
   server-side. Reproducible, and the model cannot contradict its own breakdown.
3. **Stable ids.** Issues carry kebab-case ids, so priorities and action items
   _reference_ them rather than restating them and drifting out of sync.
4. **Declared confidence.** Each category states `basis`: `measured`, `heuristic`
   or `inferred`. V1 has no page-speed data, so Performance and Mobile are
   heuristic — and the UI says so at the point the number is read.
5. **Mandatory limitations.** Never empty. A reader who catches the product
   pretending to know something it does not will discount everything else.

## Security

### SSRF

This service fetches arbitrary user-supplied URLs from inside a cloud network,
which makes it a confused deputy by construction. Four layers:

1. **Canonicalisation.** The WHATWG URL parser expands `2130706433`,
   `0x7f.0.0.1` and `127.1` all into `127.0.0.1`, so the address check sees the
   real destination rather than an obfuscated string. This is load-bearing, not
   incidental.
2. **Address classification.** Every non-public IPv4 and IPv6 range, with
   IPv4-mapped IPv6 unwrapped first — otherwise `::ffff:127.0.0.1` passes a
   v6-only test while the OS connects it to loopback.
3. **Per-hop redirect validation.** Redirects are followed manually and every hop
   is re-validated. A public URL that bounces to `169.254.169.254` is the
   canonical payload, and following redirects automatically would permit it.
4. **Connect-time re-validation.** A custom undici connector checks the socket's
   real peer address before a request byte is written. Validating DNS once and
   then connecting is a race an attacker with a low-TTL record wins.

### Prompt injection

Page content is hostile input that ends up in a prompt. Defence in depth:

- **Extraction.** Scripts, comments, `[hidden]`, `aria-hidden`, `display:none` and
  off-screen text are removed before any content is read — the usual hiding
  places, gone for free.
- **Structure.** Facts are JSON-encoded inside a block delimited by a per-request
  nonce. Page content cannot forge a terminator it has never seen.
- **Instruction.** The boundary is stated in the system prompt and repeated after
  the data, where recency matters.
- **Output.** Every string is scrubbed of markup, dangerous schemes, markdown link
  targets and any URL outside the audited domain. `react/no-danger` is a lint
  error repo-wide, so AI text can only ever render as React children.

The worst a fully successful injection achieves is odd prose.

## Cost control

| Control                  | Effect                                                      |
| ------------------------ | ----------------------------------------------------------- |
| URL cache (24h)          | A repeat audit costs nothing                                |
| In-flight lock           | A double-click costs one call, not two                      |
| Tracking-param stripping | One page is one cache key, not five                         |
| Per-IP limits            | 3/hour, 10/day by default                                   |
| Global daily cap         | The backstop between a runaway and an invoice               |
| Capped extraction        | 2MB HTML, 40k chars, 150 links, 50 images                   |
| Prompt caching           | The static system prompt is marked ephemeral                |
| Recorded usage           | Tokens and cost stored per audit — a SQL query, not a guess |

## Swapping the AI provider

Implement `AIProvider` in one new file under `lib/ai/`. Nothing outside
`lib/ai/anthropic-provider.ts` may import an SDK; a `no-restricted-imports` rule
makes a violation a build failure. The provider returns `unknown` — validation is
a separate layer, because a component that could declare its own output valid
would be marking its own homework.

## Adding data sources later

Each slots into an existing seam:

| Addition         | Where it goes                                                      |
| ---------------- | ------------------------------------------------------------------ |
| Multi-page crawl | `lib/retrieval/crawler.ts`; `SiteFacts` gains `pages[]`            |
| JS rendering     | `lib/retrieval/renderer.ts`, triggered by `likelyClientRendered`   |
| PageSpeed / CrUX | New signals module; `basis` flips to `measured`, weights rebalance |
| Search Console   | Needs auth first; `facts.searchData`                               |
| Local SEO        | A seventh category — a keyed record plus one weight constant       |
| Authentication   | `owner_id` and RLS already exist; backfill on sign-in              |
| PDF export       | A second renderer over the same `AuditReport`                      |

## Testing

| Suite               | What it proves                                                                 |
| ------------------- | ------------------------------------------------------------------------------ |
| `tests/unit`        | Rules: URL and address classification, extraction, checks, sanitising, scoring |
| `tests/integration` | Plumbing: real HTTP through the guards, AI retry and repair, abuse controls    |
| `tests/e2e`         | The journey, both themes, both viewports, plus accessibility and overflow      |
| `tests/manual`      | Real websites. Excluded from CI — needs ordinary outbound access               |

CI runs everything except `tests/manual`, always against the mock provider: no
key, no egress, no cost.
