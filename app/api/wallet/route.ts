import { getCurrentUser } from '@/lib/auth/server';
import { getTokenWallet } from '@/lib/tokens';
import { toPlatformError } from '@/lib/errors';

/** The signed-in user's balance. Never takes a user id from the request. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
    }

    const wallet = await getTokenWallet();
    const balance = await wallet.getBalance(user.id);

    return Response.json(balance, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const platform = toPlatformError(error);
    return Response.json({ error: platform.code }, { status: platform.status });
  }
}
