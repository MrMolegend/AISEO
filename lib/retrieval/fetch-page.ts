import 'server-only';
import { safeFetch } from '@/lib/security/safe-fetch';
import { checkRobots } from './robots';
import { resolveFavicon } from './favicon';
import { parseHtml } from '@/lib/extraction/parse-html';
import { buildFacts, assertAuditable } from '@/lib/extraction/build-facts';
import { AuditError } from '@/lib/errors';
import type { SiteFacts } from '@/schemas/facts';

/**
 * The retrieval layer's single entry point: a URL in, validated SiteFacts out.
 *
 * Everything in here is deterministic and free of AI. Keeping that boundary
 * strict is what lets the pipeline retry an AI failure without re-crawling the
 * site — the facts are already good.
 */
export async function retrieveSiteFacts(normalizedUrl: string): Promise<SiteFacts> {
  const robots = await checkRobots(normalizedUrl);

  if (!robots.allowsOurAgent) {
    throw new AuditError('ROBOTS_DISALLOWED', 'robots.txt disallows our agent', {
      context: { url: normalizedUrl },
    });
  }

  const fetched = await safeFetch(normalizedUrl);

  // The favicon needs the parsed document, which buildFacts parses again. The
  // duplicate parse costs a few milliseconds and keeps buildFacts a pure
  // function of its inputs, which is worth more than the saving.
  const { raw } = parseHtml(fetched.body);
  const faviconUrl = resolveFavicon(raw, fetched.finalUrl);

  const facts = buildFacts({
    requestedUrl: normalizedUrl,
    fetched,
    robots,
    faviconUrl,
  });

  assertAuditable(facts);

  return facts;
}
