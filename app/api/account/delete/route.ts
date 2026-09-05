import { requireUser } from '@/lib/auth/server';
import { deleteAccount } from '@/lib/privacy/delete';
import { PlatformError } from '@/lib/errors';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';

/**
 * Account deletion, behind a typed confirmation.
 *
 * The body must carry the exact phrase the UI asks the customer to type.
 * That is the "are you recently you and certainly sure" step: this
 * application uses short-lived server-verified sessions (no remember-me
 * that outlives the auth provider's own refresh), so a fresh deliberate
 * phrase — which no drive-by CSRF or stray click can produce — is the
 * proportionate second factor for a destructive action.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CONFIRMATION = 'DELETE MY ACCOUNT';

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`account-delete:${user.id}`, 5, 3_600));

    const body = (await request.json().catch(() => null)) as {
      confirm?: unknown;
    } | null;
    if (body?.confirm !== CONFIRMATION) {
      throw new PlatformError('INVALID_INPUT', 'Type the confirmation phrase exactly', {
        context: {
          issues: [
            { field: 'confirm', message: `Type “${CONFIRMATION}” exactly to continue` },
          ],
        },
      });
    }

    const result = await deleteAccount(user.id);
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
