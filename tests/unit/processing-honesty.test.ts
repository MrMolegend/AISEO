import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STAGES, STAGE_IDS, statusForStage, isTerminal } from '@/lib/jobs/stages';
import { INVESTIGATION_AREAS } from '@/lib/research/plan';
import { SEARCH_BUDGET } from '@/config/report';

/**
 * The progress screen must not lie.
 *
 * The previous product's screen said "Reading the sources we found" while the
 * runner wrote the crawling and extracting stages back to back with no work
 * between them. That is the failure this file guards, from two directions:
 * every stage the screen can show is a stage the runner performs, and there is
 * no invented percentage anywhere.
 */

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('the stages the screen shows are the stages the server runs', () => {
  it('come from one list, imported by both', () => {
    // Structural rather than asserted: with two lists they can drift, and the
    // drift is invisible until someone reads the runner.
    const screen = source('components/research/processing-screen.tsx');
    expect(screen).toMatch(/from '@\/lib\/jobs\/stages'/);
    expect(screen).not.toMatch(/const STAGES\s*=/);
  });

  it('are eight, each with a label that describes work', () => {
    expect(STAGES).toHaveLength(8);
    for (const stage of STAGES) {
      expect(stage.label.length).toBeGreaterThan(8);
      expect(stage.label).not.toMatch(/please wait|loading|working\.\.\./i);
    }
  });

  it('each map to exactly one non-terminal status', () => {
    for (const id of STAGE_IDS) {
      const status = statusForStage(id);
      expect(isTerminal(status), `${id} maps to a terminal status`).toBe(false);
    }
  });

  it('are named for what the server does, not for what sounds impressive', () => {
    // Every stage id appears in the runner. A label with no matching stage
    // write is a screen describing work nobody performs.
    const runner = source('lib/jobs/run-job.ts');
    for (const id of STAGE_IDS) {
      expect(runner, `no stage write for ${id}`).toContain(`'${id}'`);
    }
  });
});

describe('there is no invented percentage', () => {
  it('the screen computes no progress fraction', () => {
    const screen = source('components/research/processing-screen.tsx');

    // A percentage here can only be made up: a twelve-query search phase and a
    // single synthesis call have no comparable unit of work between them.
    const code = screen
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');

    expect(code).not.toMatch(/\bprogress\s*[=:]/i);
    expect(code).not.toMatch(/percent/i);
    expect(code).not.toMatch(/\/\s*STAGES\.length\s*\)\s*\*\s*100/);
    expect(code).not.toMatch(/role="progressbar"/);
  });
});

describe('the marketing copy counts what the code plans', () => {
  /*
   * The landing page said "ten investigation areas" while the planner had
   * twelve, and the list beside the sentence rendered all twelve — so the page
   * contradicted itself in the same section. A number in prose is the easiest
   * thing in a product to leave behind, so it is derived here rather than
   * trusted.
   */
  const spelled: Record<number, string> = {
    8: 'eight',
    9: 'nine',
    10: 'ten',
    11: 'eleven',
    12: 'twelve',
    13: 'thirteen',
  };

  it('names the right number of investigation areas', () => {
    const expected = spelled[INVESTIGATION_AREAS.length];
    expect(expected, 'add the spelling for this count').toBeTruthy();

    const page = source('app/page.tsx');
    const claim = page.match(/(\w+) investigation areas/i);
    expect(claim, 'the landing page no longer names a count').toBeTruthy();
    expect(claim![1]!.toLowerCase()).toBe(expected);
  });

  it('names the right number of searches', () => {
    // The same trap, on the numbers that cost money.
    const page = source('app/page.tsx');
    for (const field of ['advanced', 'basic', 'total'] as const) {
      expect(page, `the page hard-codes the ${field} search cap`).toContain(
        `SEARCH_BUDGET.${field}`,
      );
    }
    // And the caps themselves are what the runner enforces.
    expect(SEARCH_BUDGET.advanced + SEARCH_BUDGET.basic).toBe(SEARCH_BUDGET.total);
  });
});
