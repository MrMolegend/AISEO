/**
 * The audit pipeline's stages.
 *
 * A single exported list, imported by both the pipeline that writes the current
 * stage and the progress screen that renders it. That makes it structurally
 * impossible for the UI to show a stage the server never performs — which was a
 * hard requirement: a progress bar that invents activity is a lie, and a product
 * whose pitch is honesty cannot start by telling one.
 *
 * Adding a stage means adding it here and advancing it in run-audit.ts. If the
 * two disagree, the type system says so.
 */

export const STAGES = [
  { id: 'queued', label: 'Preparing' },
  { id: 'robots', label: 'Checking permissions' },
  { id: 'fetching', label: 'Retrieving the page' },
  { id: 'extracting', label: 'Reading the content' },
  { id: 'analysing', label: 'Analysing SEO signals' },
  { id: 'generating', label: 'Writing recommendations' },
  { id: 'validating', label: 'Checking the report' },
  { id: 'saving', label: 'Preparing your results' },
] as const;

export type StageId = (typeof STAGES)[number]['id'];

export const STAGE_IDS: readonly StageId[] = STAGES.map((s) => s.id);

export function stageIndex(id: StageId): number {
  return STAGE_IDS.indexOf(id);
}

export function stageLabel(id: StageId): string {
  return STAGES.find((s) => s.id === id)?.label ?? 'Working';
}

export function isStageId(value: unknown): value is StageId {
  return typeof value === 'string' && (STAGE_IDS as readonly string[]).includes(value);
}
