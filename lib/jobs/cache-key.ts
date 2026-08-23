import { createHash } from 'node:crypto';
import type { ResearchInput } from '@/schemas/research/inputs';

/**
 * The cache key for a research job.
 *
 * A completed report satisfies a later identical request, which saves the user
 * tokens and saves us the cost of running it again. The key decides what
 * "identical" means, and getting it wrong is a privacy incident rather than a
 * performance regression: two users researching the same company have written
 * *their own* text into the brief — their offer description, their exclusions,
 * the specific questions they wanted answered. Serving one user's report to
 * another because the domains matched would leak all of it.
 *
 * So the key covers every material input, not the domain. It is also scoped to
 * the user at the query level (see the storage layer), which means the hash
 * alone can never cross an account boundary even if this function were wrong.
 *
 * Keys are computed over a canonical JSON form so that field order and
 * insignificant whitespace do not produce two keys for one brief.
 */

/** Recursively sorts object keys so serialisation is order-independent. */
function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonicalise(v)]),
    );
  }
  if (typeof value === 'string') {
    // Case and surrounding whitespace should not fork the cache; the schemas
    // have already collapsed internal whitespace.
    return value.trim().toLowerCase();
  }
  return value;
}

export function computeInputHash(input: ResearchInput): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalise(input)))
    .digest('hex');
}
