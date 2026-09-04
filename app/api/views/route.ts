import { z } from 'zod';
import { requireMember } from '@/lib/auth/membership';
import { getPipelineStore } from '@/lib/pipeline/store';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/** The caller's saved views: same-site filter paths under a name. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const saveSchema = z.object({
  name: z.string().trim().min(1, { error: 'Name the view.' }).max(80),
  path: z
    .string()
    .regex(/^\/[^\s]*$/, { error: 'A view is a same-site path.' })
    .max(600),
});

export async function GET() {
  try {
    const { user } = await requireMember();
    const store = await getPipelineStore();
    return jsonResponse({ views: await store.viewsForUser(user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireMember();
    const body = await request.json().catch(() => null);
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'View validation failed');
    }
    const store = await getPipelineStore();
    const view = await store.saveView({
      userId: user.id,
      name: parsed.data.name,
      path: parsed.data.path,
    });
    return jsonResponse({ view }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireMember();
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new PlatformError('INVALID_INPUT', 'Missing view id');
    const store = await getPipelineStore();
    const removed = await store.deleteView(id, user.id);
    if (!removed) throw new PlatformError('NOT_FOUND', 'No such view');
    return jsonResponse({ removed: true });
  } catch (error) {
    return errorResponse(error);
  }
}
