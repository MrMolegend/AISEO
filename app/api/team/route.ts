import { z } from 'zod';
import { requireMember } from '@/lib/auth/membership';
import { getTeamStore } from '@/lib/team/store';
import { inviteMember } from '@/lib/team/invite';
import { ALT_ROLES } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';

/**
 * The team: list and invite.
 *
 * Listing is a manager's view (super_admin and sales_manager); inviting is
 * super_admin only. Both denials are 404s — the membership layer never
 * confirms an admin surface exists to someone outside it.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inviteSchema = z.object({
  email: z.email({ error: 'A valid email address is required.' }).max(320),
  role: z.enum(ALT_ROLES, { error: 'Choose a role from the list.' }),
  displayName: z
    .string()
    .trim()
    .min(1, { error: 'A display name is required.' })
    .max(120, { error: 'Keep the name under 120 characters.' }),
  territories: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
});

export async function GET() {
  try {
    await requireMember('super_admin', 'sales_manager');
    const store = await getTeamStore();
    const members = await store.list();
    return jsonResponse({ members });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireMember('super_admin');

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`team-invite:${user.id}`, 30, 3_600));

    const body = await request.json().catch(() => null);
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Invitation validation failed', {
        context: {
          issues: parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? ''),
            message: issue.message,
          })),
        },
      });
    }

    const member = await inviteMember(parsed.data, user.id);
    return jsonResponse({ member }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
