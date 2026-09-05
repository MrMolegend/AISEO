import { requireMember } from '@/lib/auth/membership';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';
import { importTemplate } from '@/lib/imports/parse';
import { contentDispositionFor } from '@/lib/export/csv';
import { errorResponse } from '@/lib/api/respond';

/** The import template, exactly as the parser reads it back. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireMember(...ROLES_WHO_MANAGE_CAMPAIGNS);
    return new Response('\uFEFF' + importTemplate() + '\r\n', {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': contentDispositionFor('alt-signal-import-template.csv'),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
