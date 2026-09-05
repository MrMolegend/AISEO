import { z } from 'zod';
import { requireMember, recordAudit } from '@/lib/auth/membership';
import { getLeadStore } from '@/lib/leads/store';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/** One account: the full intelligence record, and its working edits. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function idFrom(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  if (!UUID_SHAPE.test(id)) throw new PlatformError('NOT_FOUND', 'No such account');
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireMember();
    const id = await idFrom(params);
    const store = await getLeadStore();
    const account = await store.getAccount(id);
    if (!account) throw new PlatformError('NOT_FOUND', 'No such account');

    const [claims, contacts, merges] = await Promise.all([
      store.listClaims(id),
      store.listContacts(id),
      store.listMerges(id),
    ]);
    return jsonResponse({ account, claims, contacts, merges });
  } catch (error) {
    return errorResponse(error);
  }
}

const patchSchema = z.object({
  status: z.enum(['candidate', 'research_needed', 'qualified', 'rejected']).optional(),
  ownerId: z.uuid().nullable().optional(),
  summary: z.string().trim().max(4000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMember(...ROLES_WHO_WORK_LEADS);
    const id = await idFrom(params);

    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Update validation failed');
    }

    const store = await getLeadStore();
    const before = await store.getAccount(id);
    if (!before || before.status === 'merged') {
      throw new PlatformError('NOT_FOUND', 'No such account');
    }

    const account = await store.updateAccount(id, parsed.data);
    if (!account) throw new PlatformError('NOT_FOUND', 'No such account');

    await recordAudit(user.id, 'lead.updated', 'lead_account', id, {
      before: { status: before.status, ownerId: before.ownerId },
      after: { status: account.status, ownerId: account.ownerId },
    });
    return jsonResponse({ account });
  } catch (error) {
    return errorResponse(error);
  }
}
