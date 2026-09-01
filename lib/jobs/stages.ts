/**
 * Pipeline stages.
 *
 * One exported list, imported by both the runner that writes the current stage
 * and the screen that renders it. That is deliberate: with two lists, the
 * progress screen can show a step the server never performs, which is the most
 * common way a "live progress" display becomes a lie. Here it is structurally
 * impossible — and it matters more now than it did, because the previous
 * pipeline wrote a "reading the sources we found" stage while doing no
 * retrieval at all.
 *
 * Every stage below is a stage that does work. There is no settling step,
 * because settlement happens after the row reaches its terminal state and a
 * progress write afterwards would move a finished job back to unfinished.
 */

export const STAGES = [
  { id: 'context', label: 'Validating commercial context' },
  { id: 'mapping', label: 'Mapping the target market' },
  { id: 'competitors', label: 'Discovering competitors and substitutes' },
  { id: 'channels', label: 'Checking distribution and buyer signals' },
  { id: 'regulatory', label: 'Reviewing regulatory sources' },
  { id: 'strategy', label: 'Building the entry strategy' },
  { id: 'evidence', label: 'Validating evidence' },
  { id: 'dossier', label: 'Finalising the dossier' },
] as const;

export type StageId = (typeof STAGES)[number]['id'];

export const STAGE_IDS = STAGES.map((s) => s.id) as readonly StageId[];

/**
 * Stage ids written by the previous product, still present in stored rows.
 *
 * Load-bearing, and the subtlest breakage in this whole transformation: the
 * storage layer runs `isStageId` over the `stage` column when it reads a row,
 * so dropping these names would make an existing completed report throw on
 * read — the precise outcome "legacy reports must remain readable" forbids.
 * They are never written and never shown in the progress list; they exist so a
 * row from August still parses.
 */
export const LEGACY_STAGE_IDS = [
  'validating',
  'reserving',
  'understanding',
  'discovering',
  'crawling',
  'extracting',
  'building',
  'analysing',
  'checking',
  'saving',
  'settling',
] as const;

export type LegacyStageId = (typeof LEGACY_STAGE_IDS)[number];

/**
 * Any stage id that may appear in the `stage` column.
 *
 * The storage layer is typed with this rather than with `StageId`, because a
 * row written by the previous product is a perfectly valid row and reading one
 * must not be a type error or a runtime throw.
 */
export type StoredStageId = StageId | LegacyStageId;

/** Accepts current stages and the legacy ones stored rows may still carry. */
export function isStageId(value: unknown): value is StageId | LegacyStageId {
  return (
    typeof value === 'string' &&
    ((STAGE_IDS as readonly string[]).includes(value) ||
      (LEGACY_STAGE_IDS as readonly string[]).includes(value))
  );
}

/** True only for a stage this pipeline still writes. */
export function isCurrentStageId(value: unknown): value is StageId {
  return typeof value === 'string' && (STAGE_IDS as readonly string[]).includes(value);
}

export function stageIndex(id: string): number {
  return STAGES.findIndex((s) => s.id === id);
}

export function stageLabel(id: string): string {
  return STAGES.find((s) => s.id === id)?.label ?? 'Working';
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

/**
 * Which coarse status a stage belongs to, so the two cannot disagree.
 *
 * Exhaustive over the current stages with no default, so adding one is a
 * compile error rather than a job that silently reports the wrong status.
 */
export function statusForStage(id: StageId): JobStatus {
  switch (id) {
    case 'context':
      return 'queued';
    case 'mapping':
    case 'competitors':
    case 'channels':
    case 'regulatory':
      return 'researching';
    case 'strategy':
      return 'analysing';
    case 'evidence':
    case 'dossier':
      return 'validating';
  }
}
