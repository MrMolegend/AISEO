import { requireMember, recordAudit } from '@/lib/auth/membership';
import { getCampaignStore } from '@/lib/campaigns/store';
import { getIcpStore } from '@/lib/icps/store';
import { campaignInputSchema } from '@/schemas/campaign';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';

/**
 * Campaigns: list and create.
 *
 * Creation validates the ICP actually exists and clamps the campaign's caps
 * to its profile's ceilings — a campaign can narrow its profile, never
 * exceed it. Cost is not committed here: the preview and the start route
 * own spending.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireMember();
    const store = await getCampaignStore();
    const campaigns = await store.list();
    return jsonResponse({ campaigns });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireMember(...ROLES_WHO_MANAGE_CAMPAIGNS);

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`campaigns:${user.id}`, 30, 3_600));

    const body = await request.json().catch(() => null);
    const parsed = campaignInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Campaign validation failed', {
        context: {
          issues: parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? ''),
            message: issue.message,
          })),
        },
      });
    }

    const icps = await getIcpStore();
    const icp = await icps.get(parsed.data.icpId);
    if (!icp || icp.archivedAt) {
      throw new PlatformError('INVALID_INPUT', 'Choose a live ideal customer profile', {
        context: {
          issues: [
            { field: 'icpId', message: 'That profile does not exist or is archived.' },
          ],
        },
      });
    }

    // A campaign narrows its profile; it never exceeds it.
    const input = {
      ...parsed.data,
      maxAccounts: Math.min(parsed.data.maxAccounts, icp.maxAccounts),
      maxContactsPerAccount: Math.min(
        parsed.data.maxContactsPerAccount,
        icp.maxContactsPerAccount,
      ),
      budgetUnits: Math.min(parsed.data.budgetUnits, icp.researchBudgetUnits),
      territoryKeys: parsed.data.territoryKeys.filter((key) =>
        icp.territoryKeys.includes(key),
      ),
    };
    if (input.territoryKeys.length === 0) {
      throw new PlatformError('INVALID_INPUT', 'Campaign validation failed', {
        context: {
          issues: [
            {
              field: 'territoryKeys',
              message: 'Choose territories the profile itself covers.',
            },
          ],
        },
      });
    }

    const store = await getCampaignStore();
    const campaign = await store.create(input, user.id);
    await recordAudit(user.id, 'campaign.created', 'campaign', campaign.id, {
      name: campaign.name,
    });
    return jsonResponse({ campaign }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
