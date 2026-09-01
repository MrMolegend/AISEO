import 'server-only';
import { cookies } from 'next/headers';
import { usingTestAuthDriver } from '@/lib/env';
import type { AuthenticatedUser } from './server';

/**
 * A session without Supabase, for the end-to-end suite.
 *
 * CI has no Supabase project and cannot receive email, so without this there is
 * no way to open a browser on a signed-in page — which would leave the header,
 * the sign-out button and every protected route unproven in exactly the state
 * users spend all their time in.
 *
 * The whole design is about making it impossible to reach in production:
 *
 *   · It is off unless AUTH_TEST_DRIVER is set, and `usingTestAuthDriver()`
 *     *throws* rather than returning false when that flag is set under
 *     NODE_ENV=production. Not a warning, not a fallback — the process does not
 *     start.
 *   · It carries no secret and grants no privilege of its own. It reads a plain
 *     cookie and reports whoever it names. That is only safe *because* of the
 *     rule above, which is why the rule is enforced at the environment layer
 *     rather than here.
 *   · /api/health reports it, so a deployment running on it is visibly broken.
 *
 * If you are reading this because you are considering using it for anything
 * other than tests: don't. Every property that makes it convenient is a
 * property that makes it an authentication bypass.
 */

/** Deliberately unlike a Supabase cookie, so it can never be mistaken for one. */
export const TEST_SESSION_COOKIE = 'e2e-test-session';

export interface TestSession {
  id: string;
  email: string | null;
  role?: 'admin';
}

/** Reads the fake session, or null. Returns null whenever the driver is off. */
export async function getTestSessionUser(): Promise<AuthenticatedUser | null> {
  if (!usingTestAuthDriver()) return null;

  const store = await cookies();
  const raw = store.get(TEST_SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof parsed !== 'object' || parsed === null) return null;

    const { id, email, role } = parsed as {
      id?: unknown;
      email?: unknown;
      role?: unknown;
    };
    if (typeof id !== 'string' || id.length === 0) return null;

    return {
      id,
      email: typeof email === 'string' ? email : null,
      role: role === 'admin' ? 'admin' : null,
    };
  } catch {
    return null;
  }
}

/** Serialises a session for the test cookie. */
export function encodeTestSession(session: TestSession): string {
  return encodeURIComponent(JSON.stringify(session));
}
