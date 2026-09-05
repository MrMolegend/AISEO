import { requireMember, recordAudit } from '@/lib/auth/membership';
import { getRelationshipStore } from '@/lib/relationships/store';
import { getLeadStore } from '@/lib/leads/store';
import { attestationSchema, CONFIRMATION_ACTIONS } from '@/schemas/relationship';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * Relationship attestations.
 *
 * A member speaks only for themselves: the edge written is always
 * (the caller, the contact), the state comes from the confirmation verbs —
 * none of which can write an official-API state — and the provenance
 * records who confirmed and when. Nothing here can label anyone a
 * verified direct connection except the member's own explicit word.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { user, member } = await requireMember(...ROLES_WHO_WORK_LEADS);

    const body = await request.json().catch(() => null);
    const parsed = attestationSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Attestation validation failed');
    }

    const leads = await getLeadStore();
    const contact = await leads.getContact(parsed.data.contactId);
    if (!contact) throw new PlatformError('NOT_FOUND', 'No such contact');

    const relationshipStore = await getRelationshipStore();

    const state = CONFIRMATION_ACTIONS[parsed.data.action];
    const edge = await relationshipStore.upsert({
      employeeId: user.id,
      contactId: parsed.data.contactId,
      state,
      provenance: `employee_confirmation:${member.displayName}:${new Date().toISOString().slice(0, 10)}`,
      confirmedBy: user.id,
      confidence: state === 'employee_confirmed_direct' ? 'high' : 'medium',
      note: parsed.data.note || null,
      // Confirmations age: ask again after a year.
      expiresOn: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
    });

    await recordAudit(user.id, 'relationship.attested', 'lead_contact', edge.contactId, {
      state,
    });
    return jsonResponse({ relationship: edge }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
