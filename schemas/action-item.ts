import { z } from 'zod';

/* Client-safe vocabulary; the server store imports these from here. */

export const ACTION_PHASES = ['days-1-30', 'days-31-60', 'days-61-90', 'later'] as const;
export type ActionPhase = (typeof ACTION_PHASES)[number];

export const ACTION_PHASE_LABEL: Record<ActionPhase, string> = {
  'days-1-30': 'First 30 days',
  'days-31-60': 'Days 31–60',
  'days-61-90': 'Days 61–90',
  later: 'Later',
};

export const ACTION_STATUSES = ['todo', 'in-progress', 'done', 'deferred'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  todo: 'To do',
  'in-progress': 'In progress',
  done: 'Done',
  deferred: 'Deferred',
};

export const ACTION_PRIORITIES = ['critical', 'high', 'normal'] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

export const ACTION_PRIORITY_LABEL: Record<ActionPriority, string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
};

/**
 * Action workspace validation.
 *
 * Bounds mirror the table's CHECK constraints, one notch tighter, so a
 * customer meets this schema's message rather than a database error. The
 * date is a plain calendar date: due dates are promises about days, not
 * instants, and a timezone on one invites the classic off-by-one.
 */

const optionalBounded = (max: number) =>
  z
    .string({ error: 'Enter text, or leave this blank' })
    .trim()
    .max(max, { error: `Keep this under ${max} characters` })
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .default(null);

const dueDate = z
  .string({ error: 'Choose a date' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Choose a date' })
  .nullable()
  .default(null);

export const createActionSchema = z.object({
  title: z
    .string({ error: 'Give the action a title' })
    .trim()
    .min(2, { error: 'Give the action a title' })
    .max(200, { error: 'Keep the title under 200 characters' }),
  rationale: optionalBounded(1000),
  phase: z.enum(ACTION_PHASES, { error: 'Choose a phase' }).default('days-1-30'),
  priority: z.enum(ACTION_PRIORITIES, { error: 'Choose a priority' }).default('normal'),
  ownerLabel: optionalBounded(80),
  dueDate,
  notes: optionalBounded(4000),
});

export const updateActionSchema = z
  .object({
    title: z
      .string({ error: 'Give the action a title' })
      .trim()
      .min(2, { error: 'Give the action a title' })
      .max(200, { error: 'Keep the title under 200 characters' }),
    rationale: optionalBounded(1000),
    phase: z.enum(ACTION_PHASES, { error: 'Choose a phase' }),
    status: z.enum(ACTION_STATUSES, { error: 'Choose a status' }),
    priority: z.enum(ACTION_PRIORITIES, { error: 'Choose a priority' }),
    ownerLabel: optionalBounded(80),
    dueDate,
    notes: optionalBounded(4000),
    sortOrder: z.number().int().min(-1_000_000).max(1_000_000),
  })
  .partial();

export type CreateActionRequest = z.infer<typeof createActionSchema>;
export type UpdateActionRequest = z.infer<typeof updateActionSchema>;
