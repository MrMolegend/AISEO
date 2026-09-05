import { z } from 'zod';

/** The sales pipeline vocabulary and the playbook shape, client-safe. */

export const PIPELINE_STAGES = [
  'discovered',
  'researching',
  'qualified_stage',
  'relationship_confirmation',
  'ready_for_outreach',
  'contacted',
  'replied',
  'meeting_booked',
  'sample_requested',
  'commercial_discussion',
  'customer_won',
  'nurture',
  'disqualified',
  'lost',
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  discovered: 'Discovered',
  researching: 'Researching',
  qualified_stage: 'Qualified',
  relationship_confirmation: 'Relationship confirmation needed',
  ready_for_outreach: 'Ready for outreach',
  contacted: 'Contacted',
  replied: 'Replied',
  meeting_booked: 'Meeting booked',
  sample_requested: 'Sample or catalogue requested',
  commercial_discussion: 'Commercial discussion',
  customer_won: 'Customer won',
  nurture: 'Nurture',
  disqualified: 'Disqualified',
  lost: 'Lost',
};

/** Terminal stages: history keeps counting, but the account stops moving. */
export const TERMINAL_STAGES: readonly PipelineStage[] = [
  'customer_won',
  'disqualified',
  'lost',
];

export const stageChangeSchema = z.object({
  stage: z.enum(PIPELINE_STAGES),
  note: z.string().trim().max(1000).default(''),
});

export const ACTIVITY_KINDS = [
  'note',
  'call',
  'meeting',
  'email',
  'whatsapp',
  'linkedin',
  'other',
] as const;

export const activitySchema = z.object({
  accountId: z.uuid(),
  contactId: z.uuid().nullable().default(null),
  kind: z.enum(ACTIVITY_KINDS).default('note'),
  body: z.string().trim().min(1, { error: 'Write the note first.' }).max(4000),
  private: z.boolean().default(false),
});

export const taskSchema = z.object({
  accountId: z.uuid().nullable().default(null),
  title: z.string().trim().min(1, { error: 'A task needs a title.' }).max(300),
  detail: z.string().trim().max(2000).default(''),
  dueOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  assigneeId: z.uuid().nullable().default(null),
});

/** Playbooks: recommended timing and tasks — never automatic sending. */
export const playbookStepSchema = z.object({
  offsetDays: z.number().int().min(0).max(120),
  title: z.string().trim().min(1).max(300),
  detail: z.string().trim().max(500).default(''),
});

export const playbookSchema = z.object({
  key: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(120),
  steps: z.array(playbookStepSchema).min(1).max(15),
});

export const playbooksSchema = z.array(playbookSchema).max(20);

export type Playbook = z.infer<typeof playbookSchema>;

export const DEFAULT_PLAYBOOKS: Playbook[] = [
  {
    key: 'warm_introduction',
    name: 'Warm introduction',
    steps: [
      {
        offsetDays: 0,
        title: 'Ask the colleague for the introduction',
        detail: 'Use the approved intro-request draft; they decide whether and how.',
      },
      {
        offsetDays: 3,
        title: 'Send the first message once introduced',
        detail: 'Approved draft only; reference the introduction, nothing else.',
      },
      { offsetDays: 10, title: 'First follow-up if no reply', detail: '' },
    ],
  },
  {
    key: 'cold_researched',
    name: 'Cold but researched account',
    steps: [
      { offsetDays: 0, title: 'Send the approved first-touch message', detail: '' },
      { offsetDays: 7, title: 'First follow-up', detail: '' },
      {
        offsetDays: 18,
        title: 'Second and final follow-up',
        detail: 'Two follow-ups is the ceiling; then nurture.',
      },
    ],
  },
  {
    key: 'new_opening',
    name: 'New retail opening',
    steps: [
      {
        offsetDays: 0,
        title: 'Congratulate via approved draft and offer the catalogue',
        detail: 'Only if the opening is an evidenced signal on the account.',
      },
      { offsetDays: 5, title: 'Offer an opening-stock consultation', detail: '' },
    ],
  },
  {
    key: 'assortment_expansion',
    name: 'Assortment expansion',
    steps: [
      {
        offsetDays: 0,
        title: 'Share the relevant category line sheet',
        detail: 'Categories from the observed-opportunity match only.',
      },
      { offsetDays: 7, title: 'Propose a small trial order', detail: '' },
    ],
  },
  {
    key: 'brand_launch',
    name: 'New ALT brand launch',
    steps: [
      {
        offsetDays: 0,
        title: 'Announce the launch to qualified accounts',
        detail: 'Approved launch draft; respects suppression as always.',
      },
      { offsetDays: 6, title: 'Offer launch samples', detail: '' },
    ],
  },
  {
    key: 'trade_show',
    name: 'Trade-show follow-up',
    steps: [
      {
        offsetDays: 1,
        title: 'Send the follow-up referencing the recorded meeting',
        detail: 'Only when the meeting is an activity on the account.',
      },
      { offsetDays: 8, title: 'Book the next conversation', detail: '' },
    ],
  },
  {
    key: 'reactivation',
    name: 'Dormant customer reactivation',
    steps: [
      { offsetDays: 0, title: 'Send the re-engagement draft', detail: '' },
      { offsetDays: 14, title: 'Close the loop or move to nurture', detail: '' },
    ],
  },
  {
    key: 'regional_distributor',
    name: 'Regional distributor conversation',
    steps: [
      {
        offsetDays: 0,
        title: 'Confirm territory boundaries internally',
        detail: 'Check exclusivity notes before any approach.',
      },
      {
        offsetDays: 2,
        title: 'Open the conversation with the approved detailed email',
        detail: '',
      },
    ],
  },
];
