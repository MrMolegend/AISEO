/**
 * Pipeline stages.
 *
 * One exported list, imported by both the runner that writes the current stage
 * and the screen that renders it. That is deliberate: with two lists, the
 * progress screen can show a stage the server never performs, which is the most
 * common way a "live progress" display becomes a lie. Here it is structurally
 * impossible.
 */

export const STAGES = [
  { id: 'validating', label: 'Checking your request' },
  { id: 'reserving', label: 'Reserving tokens' },
  { id: 'understanding', label: 'Reading your website' },
  { id: 'discovering', label: 'Searching public sources' },
  { id: 'crawling', label: 'Reading the sources we found' },
  { id: 'extracting', label: 'Extracting facts' },
  { id: 'building', label: 'Building the candidate list' },
  { id: 'analysing', label: 'Analysing' },
  { id: 'checking', label: 'Checking every claim against its sources' },
  { id: 'saving', label: 'Saving your report' },
  { id: 'settling', label: 'Finalising' },
] as const;

export type StageId = (typeof STAGES)[number]['id'];

export const STAGE_IDS = STAGES.map((s) => s.id) as readonly StageId[];

export function isStageId(value: unknown): value is StageId {
  return typeof value === 'string' && (STAGE_IDS as readonly string[]).includes(value);
}

export function stageIndex(id: StageId): number {
  return STAGES.findIndex((s) => s.id === id);
}

export function stageLabel(id: StageId): string {
  return STAGES.find((s) => s.id === id)?.label ?? 'Working';
}

/**
 * Fraction of the way through, for a progress bar.
 *
 * Deliberately derived from stage position rather than a percentage the runner
 * invents. Stages do not take equal time, and pretending otherwise produces the
 * bar that sits at 94% for a minute. The UI shows this as a coarse indicator
 * with the stage name doing the real work.
 */
export function stageProgress(id: StageId): number {
  const index = stageIndex(id);
  if (index < 0) return 0;
  return Math.round(((index + 1) / STAGES.length) * 100);
}

export const JOB_STATUSES = [
  'queued',
  'researching',
  'analysing',
  'validating',
  'complete',
  'failed',
  'cancelled',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && (JOB_STATUSES as readonly string[]).includes(value);
}

export function isTerminal(status: JobStatus): boolean {
  return status === 'complete' || status === 'failed' || status === 'cancelled';
}

/** Which coarse status a stage belongs to, so the two cannot disagree. */
export function statusForStage(id: StageId): JobStatus {
  switch (id) {
    case 'validating':
    case 'reserving':
      return 'queued';
    case 'understanding':
    case 'discovering':
    case 'crawling':
    case 'extracting':
    case 'building':
      return 'researching';
    case 'analysing':
      return 'analysing';
    case 'checking':
      return 'validating';
    case 'saving':
    case 'settling':
      return 'validating';
  }
}
