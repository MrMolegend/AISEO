import { requireMember, recordAudit } from '@/lib/auth/membership';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { brandInputSchema } from '@/schemas/alt-config';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * The brand catalogue: list and create.
 *
 * The catalogue ships empty on purpose — no verified brand list was
 * reachable at build time — so every row here was entered by a person with
 * authority, and carries who and when.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireMember();
    const includeInactive =
      new URL(request.url).searchParams.get('inactive') === 'include';
    const store = await getAltConfigStore();
    const brands = await store.listBrands({ includeInactive });
    return jsonResponse({ brands });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireMember('super_admin', 'sales_manager');

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
    const brand = await store.createBrand(parsed.data, user.id);
    await recordAudit(user.id, 'commercial.brand_created', 'alt_brand', brand.id, {
      name: brand.name,
    });
    return jsonResponse({ brand }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
