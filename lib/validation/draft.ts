import { FIELD_STAGE } from '@/schemas/market-entry/input';

/**
 * Draft payload hygiene.
 *
 * A draft is allowed to be incomplete and even invalid — that is what makes
 * it a draft — but it is not allowed to be arbitrary. The intake owns a fixed
 * set of fields, so anything else is dropped, and every kept value is bounded:
 * a draft row is user-controlled storage on our disk, and unbounded
 * user-controlled storage is a cost problem first and an abuse surface second.
 *
 * Values are kept as typed, not validated: "12.5" in a money field stays the
 * string the customer is mid-way through typing. The full brief schema gets
 * its say exactly once, at submission.
 */

const KNOWN_FIELDS = new Set(Object.keys(FIELD_STAGE));

const MAX_STRING = 4_000;
const MAX_ARRAY_ITEMS = 20;
const MAX_ARRAY_STRING = 300;
/** Serialized ceiling; far above any real brief, far below an abuse payload. */
export const MAX_DRAFT_BYTES = 32_000;

/**
 * Returns the cleaned payload, or null when the input is not even the right
 * shape of thing (not an object, or too large after cleaning).
 */
export function sanitiseDraftPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!KNOWN_FIELDS.has(key)) continue;

    if (typeof value === 'string') {
      cleaned[key] = value.slice(0, MAX_STRING);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      cleaned[key] = value;
    } else if (typeof value === 'boolean' || value === null) {
      cleaned[key] = value;
    } else if (Array.isArray(value)) {
      cleaned[key] = value
        .filter((item): item is string => typeof item === 'string')
        .slice(0, MAX_ARRAY_ITEMS)
        .map((item) => item.slice(0, MAX_ARRAY_STRING));
    }
    // Objects, functions, undefined: dropped without comment.
  }

  if (JSON.stringify(cleaned).length > MAX_DRAFT_BYTES) return null;
  return cleaned;
}
