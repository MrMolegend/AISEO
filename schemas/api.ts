import { z } from 'zod';

/**
 * Request contracts for the public API routes.
 *
 * Kept separate from the audit schema: these describe what a stranger may send
 * us, which is a different concern from what an audit contains.
 */

export const leadSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name').max(120),
  email: z.email('Please enter a valid email address').max(200),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  website: z.string().trim().max(300).optional().or(z.literal('')),
  message: z.string().trim().max(2_000).optional().or(z.literal('')),
  auditPublicId: z.string().max(32).optional(),
  /**
   * Honeypot. A real person never sees this field, so anything in it came from
   * a bot filling every input it found. Named plausibly enough to be tempting.
   */
  companyWebsiteUrl: z.string().max(200).optional(),
  /**
   * Milliseconds the form was on screen before submission. A form completed in
   * under a second was not read by a human.
   */
  elapsedMs: z.number().int().min(0).optional(),
});

export type LeadRequest = z.infer<typeof leadSchema>;

/** Below this, the submission was almost certainly automated. */
export const MIN_HUMAN_FORM_MS = 2_000;
