import {
  assertAdminGrantAuthorised,
  grantTokensAsAdmin,
  adminGrantsEnabled,
} from '@/lib/tokens/admin-grant';
import { toPlatformError, PlatformError } from '@/lib/errors';

/**
 * Operator token grant.
 *
 * Disabled entirely unless ADMIN_GRANT_SECRET is set, and a wrong secret gets
 * the same 404 as a missing one — an endpoint that admits it exists is an
 * endpoint worth attacking. There is no UI for this and there should not be;
 * see the README for the curl invocation.
 *
 * This is the only route in the application that can create spendable value,
 * so it is deliberately the most boring one: no user lookup by email, no
 * bulk mode, no partial success.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    if (!adminGrantsEnabled()) {
      throw new PlatformError('NOT_FOUND', 'Admin grants are not enabled');
    }

    assertAdminGrantAuthorised(request.headers.get('x-admin-secret'));

    const body = (await request.json().catch(() => null)) as {
      userId?: unknown;
      amount?: unknown;
      reference?: unknown;
      reason?: unknown;
    } | null;

    if (
      typeof body?.userId !== 'string' ||
      typeof body.amount !== 'number' ||
      typeof body.reference !== 'string'
    ) {
      throw new PlatformError(
        'INVALID_INPUT',
        'userId, amount and reference are required',
      );
    }

    const result = await grantTokensAsAdmin({
      userId: body.userId,
      amount: body.amount,
      reference: body.reference,
      reason: typeof body.reason === 'string' ? body.reason : 'Operator grant',
    });

    return Response.json(
      {
        available: result.available,
        reserved: result.reserved,
        replayed: result.replayed,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const platform = toPlatformError(error);
    return Response.json({ error: platform.code }, { status: platform.status });
  }
}
