import { z } from 'zod';

/** Outreach channel vocabulary, client-safe. */

export const OUTREACH_CHANNELS = [
  'intro_request',
  'linkedin_note',
  'linkedin_message',
  'email_short',
  'email_detailed',
  'whatsapp',
  'call_opener',
  'voicemail',
  'meeting_request',
  'followup_1',
  'followup_2',
  'reengagement',
] as const;

export type OutreachChannel = (typeof OUTREACH_CHANNELS)[number];

export const OUTREACH_CHANNEL_LABEL: Record<OutreachChannel, string> = {
  intro_request: 'Warm-introduction request (to a colleague)',
  linkedin_note: 'LinkedIn connection note',
  linkedin_message: 'First LinkedIn message',
  email_short: 'Short email',
  email_detailed: 'Detailed partnership email',
  whatsapp: 'WhatsApp message',
  call_opener: 'Call opener',
  voicemail: 'Voicemail',
  meeting_request: 'Meeting request',
  followup_1: 'First follow-up',
  followup_2: 'Second follow-up',
  reengagement: 'Re-engagement',
};

export const generateDraftsSchema = z.object({
  accountId: z.uuid(),
  contactId: z.uuid().nullable().default(null),
  channels: z
    .array(z.enum(OUTREACH_CHANNELS))
    .min(1, { error: 'Choose at least one channel.' })
    .max(6),
  language: z.enum(['en', 'ar']).default('en'),
});

export const editDraftSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const draftDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  /** The explicit human confirmation the approval flow requires. */
  reviewed: z.boolean().default(false),
});
