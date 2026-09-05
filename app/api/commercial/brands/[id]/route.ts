import { requireMember, recordAudit } from '@/lib/auth/membership';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { brandInputSchema } from '@/schemas/alt-config';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/** One catalogue brand: full replace (including deactivation via active:false). */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMember('super_admin', 'sales_manager');
    const { id } = await params;
    if (!UUID_SHAPE.test(id)) throw new PlatformError('NOT_FOUND', 'No such brand');

    const body = await request.json().catch(() => null);
    const parsed = brandInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Brand validation failed', {
        context: {
          issues: parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? ''),
            message: issue.message,
          })),
        },
      });
    }

    const store = await getAltConfigStore();
    const brand = await store.updateBrand(id, parsed.data);
    if (!brand) throw new PlatformError('NOT_FOUND', 'No such brand');

    await recordAudit(user.id, 'commercial.brand_updated', 'alt_brand', id, {
      name: brand.name,
      active: brand.active,
    });
    return jsonResponse({ brand });
  } catch (error) {
    return errorResponse(error);
  }
}
