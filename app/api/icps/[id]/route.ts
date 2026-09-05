import { z } from 'zod';
import { requireMember, recordAudit } from '@/lib/auth/membership';
import { getIcpStore } from '@/lib/icps/store';
import { icpInputSchema } from '@/schemas/icp';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/** One ideal customer profile: read, replace, archive/restore. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function idFrom(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  if (!UUID_SHAPE.test(id)) throw new PlatformError('NOT_FOUND', 'No such profile');
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireMember();
    const id = await idFrom(params);
    const store = await getIcpStore();
    const icp = await store.get(id);
    if (!icp) throw new PlatformError('NOT_FOUND', 'No such profile');
    return jsonResponse({ icp });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMember(...ROLES_WHO_MANAGE_CAMPAIGNS);
    const id = await idFrom(params);

    const body = await request.json().catch(() => null);
    const parsed = icpInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Profile validation failed', {
        context: {
          issues: parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? ''),
            message: issue.message,
          })),
        },
      });
    }

    const store = await getIcpStore();
    const icp = await store.update(id, parsed.data);
    if (!icp) throw new PlatformError('NOT_FOUND', 'No such profile');
    await recordAudit(user.id, 'icp.updated', 'icp', id, { name: icp.name });
    return jsonResponse({ icp });
  } catch (error) {
    return errorResponse(error);
  }
}

const archiveSchema = z.object({ archived: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMember(...ROLES_WHO_MANAGE_CAMPAIGNS);
    const id = await idFrom(params);

    const body = await request.json().catch(() => null);
    const parsed = archiveSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Expected { archived: boolean }');
    }

    const store = await getIcpStore();
    const changed = await store.setArchived(id, parsed.data.archived);
    if (!changed) throw new PlatformError('NOT_FOUND', 'No such profile');
    await recordAudit(user.id, 'icp.archived', 'icp', id, {
      archived: parsed.data.archived,
    });
    return jsonResponse({ archived: parsed.data.archived });
  } catch (error) {
    return errorResponse(error);
  }
}
