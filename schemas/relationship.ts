import { z } from 'zod';

/**
 * Relationship states and the exact words the UI may use for each.
 *
 * The copy rules are the product's honesty contract:
 *
 *   · "Verified direct connection" appears ONLY for the two strong states —
 *     an authorised official API response, or the employee's own explicit
 *     confirmation.
 *   · Shared public context is never "you know this person"; it is a
 *     possible warm path awaiting confirmation, and it says so.
 *
 * tests/unit/relationship-truth.test.ts pins this table.
 */

export const RELATIONSHIP_STATES = [
  'official_api_verified_direct',
  'employee_confirmed_direct',
  'employee_confirmed_acquaintance',
  'crm_history',
  'previous_alt_interaction',
  'public_shared_context',
  'possible_unverified',
  'rejected_or_stale',
] as const;

export type RelationshipState = (typeof RELATIONSHIP_STATES)[number];

/** The states allowed to render as a verified direct connection. */
export const VERIFIED_DIRECT_STATES: readonly RelationshipState[] = [
  'official_api_verified_direct',
  'employee_confirmed_direct',
];

export const RELATIONSHIP_STATE_LABEL: Record<RelationshipState, string> = {
  official_api_verified_direct: 'Verified direct connection (official API)',
  employee_confirmed_direct: 'Verified direct connection (confirmed by colleague)',
  employee_confirmed_acquaintance: 'Acquaintance (confirmed by colleague)',
  crm_history: 'Known from authorised CRM history',
  previous_alt_interaction: 'Previous ALT interaction on record',
  public_shared_context: 'Shared public context — not a confirmed connection',
  possible_unverified: 'Possible warm path — needs confirmation',
  rejected_or_stale: 'Not connected, or stale',
};

/** Whether an edge in this state may be described as a warm path at all. */
export function isWarmPath(state: RelationshipState): boolean {
  return (
    state === 'official_api_verified_direct' ||
    state === 'employee_confirmed_direct' ||
    state === 'employee_confirmed_acquaintance' ||
    state === 'crm_history' ||
    state === 'previous_alt_interaction'
  );
}

/** The one sentence shown beside an edge, per state. */
export function warmPathSentence(state: RelationshipState, employeeName: string): string {
  switch (state) {
    case 'official_api_verified_direct':
    case 'employee_confirmed_direct':
      return `Verified direct connection via ${employeeName}.`;
    case 'employee_confirmed_acquaintance':
      return `${employeeName} knows them indirectly and has said so.`;
    case 'crm_history':
      return `Appears in authorised CRM history imported by ${employeeName}.`;
    case 'previous_alt_interaction':
      return `Previous ALT interaction recorded by ${employeeName}.`;
    case 'public_shared_context':
      return `Shared public context with ${employeeName} — possible warm path, confirm with them before relying on it.`;
    case 'possible_unverified':
      return `Possible warm path — confirm with ${employeeName}.`;
    case 'rejected_or_stale':
      return `${employeeName} has said they are not connected, or the record is stale.`;
  }
}

/**
 * The quick confirmation workflow's verbs, mapped to the state each writes.
 * There is no verb that writes an official_api state: only an authorised
 * API response may.
 */
export const CONFIRMATION_ACTIONS = {
  confirm_direct: 'employee_confirmed_direct',
  know_indirectly: 'employee_confirmed_acquaintance',
  not_connected: 'rejected_or_stale',
} as const;

export type ConfirmationAction = keyof typeof CONFIRMATION_ACTIONS;

export const attestationSchema = z.object({
  contactId: z.uuid(),
  action: z.enum(
    Object.keys(CONFIRMATION_ACTIONS) as [ConfirmationAction, ...ConfirmationAction[]],
  ),
  note: z.string().trim().max(500).default(''),
});

export type AttestationInput = z.infer<typeof attestationSchema>;
