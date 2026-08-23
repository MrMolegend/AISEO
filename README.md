# AISEO

Enter a website address, get an AI-powered SEO and growth audit in about a minute:
scores, prioritised issues with evidence, an impact-versus-effort view, a phased
action plan, and a plain statement of what the audit could not determine.

## The one idea that shapes everything

**The crawler owns facts. The AI owns interpretation.**

The model is never asked how long a title tag is — it is told. Every significant
finding carries `evidence`: the real value read from the page, rendered beside the
model's commentary so a reader can check it. The overall score is computed from
weighted category scores server-side, never generated.

The second half of that idea: **the AI produces data, never presentation.** Claude
returns a strictly-typed object; React components own all rendering. That is what
makes the report identical for every site, safe against injected page content,
storable, diffable, and exportable later.

## Running it locally

```bash
npm install
npm run dev
```

That is the whole setup. With no `.env` at all the application runs end to end on
the mock AI provider and an in-memory store: no API key, no accounts, no cost, no
network egress. Visit http://localhost:3000 and audit any public site.

To use a real model, copy `.env.example` to `.env.local` and set:

```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

Everything else is optional and documented in `.env.example`.

## Commands

| Command            | What it does                                          |
| ------------------ | ----------------------------------------------------- |
| `npm run dev`      | Development server                                    |
| `npm run verify`   | Typecheck, lint and the full unit + integration suite |
| `npm test`         | Unit and integration tests                            |
| `npm run test:e2e` | Playwright, against a real build                      |
| `npm run build`    | Production build                                      |

The end-to-end suite audits the application's own landing page — a real HTML
document over real HTTP — so retrieval and extraction do genuine work rather than
being stubbed, with no fixture server to coordinate.

## Going to production

Three services turn the development drivers into real ones. Each is independent;
the app degrades to a labelled fallback and logs an error rather than breaking.

| What                  | Why it is needed                       | Without it                                                    |
| --------------------- | -------------------------------------- | ------------------------------------------------------------- |
| **Anthropic API key** | Real analysis                          | Every audit returns fixture data                              |
| **Supabase**          | Audits persist and are shareable       | Audits vanish on restart and are invisible to other instances |
| **Upstash Redis**     | Rate limits that hold across instances | Limits apply per-instance only — not a real limit under load  |

`GET /api/health` reports which drivers are live and returns 503 if any
development driver is active in production, so a misconfigured deploy fails its
health check rather than quietly serving fixture data.

Apply `supabase/migrations/0001_initial_schema.sql` before the first real audit.

### Before the first public link

Set `AUDIT_DAILY_GLOBAL_CAP`. It is the circuit breaker that turns a runaway into
an error message rather than an invoice.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## What V1 deliberately does not do

Stated plainly because the product's whole pitch is honesty about its own limits:

- **One page per audit.** The homepage only. Multi-page crawling is the next
  retrieval-layer addition.
- **No JavaScript rendering.** Pages are analysed as served. A client-rendered
  shell is detected and refused with an explanation rather than audited as though
  it were empty — which is itself a true finding about that site.
- **No measured performance data.** Performance and Mobile are inferred from HTML
  signals and are labelled `heuristic` in the data and "Estimated" in the UI.
- **No search, ranking or backlink data.**

Every generated report states these in its own limitations section.
