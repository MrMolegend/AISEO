import { requireMember, recordAudit } from '@/lib/auth/membership';
import { generateDraftsForAccount } from '@/lib/outreach/service';
import { getOutreachStore } from '@/lib/outreach/store';
import { generateDraftsSchema } from '@/schemas/outreach';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';

/** Generate drafts (POST) and list the review queue (GET). */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireMember();
    const status = new URL(request.url).searchParams.get('status');
    const store = await getOutreachStore();
    const drafts = await store.listByStatus(
      status === 'approved' || status === 'rejected' ? status : 'draft',
    );
    return jsonResponse({ drafts });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireMember(...ROLES_WHO_WORK_LEADS);

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`outreach:${user.id}`, 60, 3_600));

    const body = await request.json().catch(() => null);
    const parsed = generateDraftsSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Generation validation failed');
    }

    const result = await generateDraftsForAccount({
      accountId: parsed.data.accountId,
      contactId: parsed.data.contactId,
      channels: parsed.data.channels,
      language: parsed.data.language,
      createdBy: user.id,
    });
    await recordAudit(
      user.id,
      'outreach.generated',
      'lead_account',
      parsed.data.accountId,
      {
        channels: parsed.data.channels,
        created: result.drafts.length,
      },
    );
    return jsonResponse(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
