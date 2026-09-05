import { z } from 'zod';
import { requireMember, recordAudit } from '@/lib/auth/membership';
import { getCampaignStore } from '@/lib/campaigns/store';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/** One campaign: read (with its latest run), cancel, archive. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function idFrom(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  if (!UUID_SHAPE.test(id)) throw new PlatformError('NOT_FOUND', 'No such campaign');
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireMember();
    const id = await idFrom(params);
    const store = await getCampaignStore();
    const campaign = await store.get(id);
    if (!campaign) throw new PlatformError('NOT_FOUND', 'No such campaign');
    const run = await store.latestRun(id);
    return jsonResponse({ campaign, run });
  } catch (error) {
    return errorResponse(error);
  }
}

const patchSchema = z.object({ action: z.enum(['cancel', 'archive']) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMember(...ROLES_WHO_MANAGE_CAMPAIGNS);
    const id = await idFrom(params);

    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError(
        'INVALID_INPUT',
        'Expected { action: "cancel" | "archive" }',
      );
    }

    const store = await getCampaignStore();
    const campaign = await store.get(id);
    if (!campaign) throw new PlatformError('NOT_FOUND', 'No such campaign');

    if (parsed.data.action === 'cancel') {
      const run = await store.latestRun(id);
      if (run && ['queued', 'running'].includes(run.status)) {
        // The engine checks for this between stages and settles the run;
        // marking it here is what makes that check see it.
        await store.finishRun(run.id, 'cancelled');
      }
      await store.setStatus(id, 'cancelled');
    } else {
      if (campaign.status === 'running') {
        throw new PlatformError('INVALID_INPUT', 'Cancel the running research first.');
      }
      await store.setStatus(id, 'archived');
    }

    await recordAudit(user.id, `campaign.${parsed.data.action}`, 'campaign', id);
    const updated = await store.get(id);
    return jsonResponse({ campaign: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
