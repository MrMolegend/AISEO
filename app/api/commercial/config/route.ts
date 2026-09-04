import { requireMember, recordAudit } from '@/lib/auth/membership';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { CONFIG_KEYS, CONFIG_SCHEMAS, type ConfigKey } from '@/schemas/alt-config';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * The keyed commercial configuration.
 *
 * Any member can read it — proof points and prohibited claims are exactly
 * what a rep drafting outreach needs in front of them. Writing is for
 * super_admin and sales_manager, per key, validated against that key's
 * schema, and audited with the key name (never the full value, which can be
 * long; the row itself is the current state).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireMember();
    const store = await getAltConfigStore();
    const entries = await Promise.all(
      CONFIG_KEYS.map(async (key) => [key, await store.getConfig(key)] as const),
    );
    return jsonResponse({ config: Object.fromEntries(entries) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = await requireMember('super_admin', 'sales_manager');

    const body = (await request.json().catch(() => null)) as {
      key?: unknown;
      value?: unknown;
    } | null;
    const key = body?.key;
    if (typeof key !== 'string' || !(CONFIG_KEYS as string[]).includes(key)) {
      throw new PlatformError('INVALID_INPUT', 'Unknown configuration key');
    }

    const parsed = CONFIG_SCHEMAS[key as ConfigKey].safeParse(body?.value);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Configuration validation failed', {
        context: {
          issues: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }

    const store = await getAltConfigStore();
    await store.setConfig(key as ConfigKey, parsed.data as never, user.id);
    await recordAudit(user.id, 'commercial.config_updated', 'alt_config', key);

    return jsonResponse({ key, value: parsed.data });
  } catch (error) {
    return errorResponse(error);
  }
}
