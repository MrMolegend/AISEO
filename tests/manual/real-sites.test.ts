import { describe, expect, it } from 'vitest';
import { retrieveSiteFacts } from '@/lib/retrieval/fetch-page';
import { validateAndNormalizeUrl } from '@/lib/security/url-validator';
import { isPlatformError } from '@/lib/errors';

/**
 * Smoke test against the real internet.
 *
 * Excluded from the default `npm test` run because it needs public network
 * access and depends on sites we do not control. Run it deliberately:
 *
 *   npx vitest run --config vitest.manual.config.ts
 *
 * It exists because unit tests prove the rules and integration tests prove the
 * plumbing, but neither proves the extractors cope with pages written by someone
 * else — which is the entire job.
 *
 * KNOWN LIMITATION IN SANDBOXED DEVELOPMENT ENVIRONMENTS
 *
 * safeFetch connects directly, which is correct for production: Vercel has no
 * egress proxy, and routing through one would defeat the connect-time SSRF
 * check, because the socket would land on the proxy's address rather than the
 * target's. In a sandbox that forces egress through a policy proxy, these
 * requests are refused with 403 at the gateway and this suite cannot run.
 *
 * That is an environment constraint, not a product defect. Run this against a
 * machine with ordinary outbound access before trusting the retrieval layer on
 * real-world markup — tests/integration/retrieval.test.ts covers the same code
 * path over real HTTP, but only against HTML we wrote ourselves.
 */

const TARGETS = [
  'example.com',
  'nodejs.org',
  'developer.mozilla.org',
  'news.ycombinator.com',
  'w3.org',
];

describe('retrieval against real websites', () => {
  it.each(TARGETS)(
    'produces usable facts for %s',
    async (target) => {
      const validation = validateAndNormalizeUrl(target);
      expect(validation.ok).toBe(true);
      if (!validation.ok) return;

      const started = Date.now();
      try {
        const facts = await retrieveSiteFacts(validation.normalized);
        const failing = facts.checks.filter((c) => c.status === 'fail').map((c) => c.id);

        console.log(
          [
            validation.domain.padEnd(24),
            `${String(Date.now() - started).padStart(5)}ms`,
            `${String(facts.content.wordCount).padStart(5)}w`,
            `${String(Math.round(facts.htmlBytes / 1024)).padStart(4)}KB`,
            `h1:${facts.headingCounts.h1}`,
            `img:${facts.images.counts.total}/${facts.images.counts.missingAlt}noalt`,
            `links:${facts.links.counts.internal}i/${facts.links.counts.external}e`,
            `sd:[${facts.structuredData.types.slice(0, 3).join(',')}]`,
            `title:${facts.meta.titleLength}c`,
            `fail:[${failing.join(',')}]`,
          ].join('  '),
        );

        expect(facts.httpStatus).toBe(200);
        expect(facts.checks.length).toBeGreaterThan(5);
      } catch (error) {
        const code = isPlatformError(error) ? error.code : 'THREW';
        console.log(
          `${validation.domain.padEnd(24)} ${code}: ${error instanceof Error ? error.message.slice(0, 80) : ''}`,
        );
        throw error;
      }
    },
    45_000,
  );
});
