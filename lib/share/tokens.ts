import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Share token primitives.
 *
 * A share token is 32 bytes of CSPRNG output, base64url — 256 bits of
 * entropy, unguessable in any budget an attacker has. The raw token exists in
 * exactly two places: the response that minted it and the link the owner
 * sends. The database holds only its SHA-256, so nothing that reads the
 * database — backups, logs, an over-broad query — can open a report.
 *
 * Lookup is by digest equality. Hashing the presented token first is what
 * makes the comparison safe to do in a database index: an attacker cannot
 * iterate "near" tokens because nearness in token space has no relation to
 * nearness in digest space. The in-memory driver compares digests with
 * timingSafeEqual for the same discipline.
 */

const TOKEN_BYTES = 32;

/** Base64url, no padding: safe in a path segment, ~43 characters. */
export function mintShareToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashShareToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/** Shape check before any storage round-trip: cheap rejection of junk. */
export function looksLikeShareToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{40,64}$/.test(value);
}

/** Constant-time hex-digest comparison, for drivers that compare in memory. */
export function digestsEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'hex');
  const bufferB = Buffer.from(b, 'hex');
  if (bufferA.length !== bufferB.length || bufferA.length === 0) return false;
  return timingSafeEqual(bufferA, bufferB);
}
