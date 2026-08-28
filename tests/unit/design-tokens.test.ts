import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COLOR_TOKENS, type ColorToken } from '@/config/design';
import { parseOklch, contrastRatio, CONTRAST, type Oklch } from '@/lib/design/contrast';

/**
 * The palette, checked arithmetically.
 *
 * "All colours must pass appropriate WCAG contrast requirements" is the kind of
 * requirement that is true on the day it is written and false four commits
 * later. A palette drifts one token at a time, each change looks fine in
 * whichever scheme the author had open, and the regression surfaces as an axe
 * failure on a page nobody touched.
 *
 * So this reads app/globals.css — the shipped values, not a copy — resolves
 * each of the three surfaces the product actually renders on, and computes the
 * contrast of every pair a component is allowed to produce. A token that is
 * lightened without checking fails here rather than in CI's browser run, with a
 * number attached rather than a rule id.
 */

const CSS = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');

/** Pulls `--color-x: <value>;` declarations out of one region of the file. */
function tokensIn(region: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of region.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)) {
    found.set(match[1]!, match[2]!.trim());
  }
  return found;
}

function region(startMarker: string, endMarker: string): string {
  const start = CSS.indexOf(startMarker);
  expect(start, `missing region: ${startMarker}`).toBeGreaterThan(-1);
  const end = CSS.indexOf(endMarker, start + startMarker.length);
  return CSS.slice(start, end === -1 ? undefined : end);
}

const OBSIDIAN = tokensIn(region('@theme {', '\n}'));
const PARCHMENT_OVERRIDES = tokensIn(
  region('@media (prefers-color-scheme: light) {', '\n}'),
);
const LEAF_OVERRIDES = tokensIn(region("[data-surface='leaf'] {", '\n  }'));

/**
 * The three surfaces the product renders on.
 *
 * Leaf is one surface, not two, because its values are shared by both schemes —
 * a warm sheet is light whichever way the desk around it goes.
 */
const SURFACES = {
  obsidian: new Map(OBSIDIAN),
  parchment: new Map([...OBSIDIAN, ...PARCHMENT_OVERRIDES]),
  leaf: new Map([...OBSIDIAN, ...LEAF_OVERRIDES]),
} as const;

type SurfaceName = keyof typeof SURFACES;

function resolve(surface: SurfaceName, token: string): Oklch {
  let raw = SURFACES[surface].get(token);
  // The leaf surface points a few tokens at others rather than restating them.
  let hops = 0;
  while (raw?.startsWith('var(--color-') && hops < 4) {
    raw = SURFACES[surface].get(raw.slice('var(--color-'.length, -1));
    hops += 1;
  }
  const parsed = raw ? parseOklch(raw) : null;
  expect(
    parsed,
    `${surface}: --color-${token} is missing or not an oklch value`,
  ).not.toBeNull();
  return parsed!;
}

function ratio(surface: SurfaceName, foreground: string, background: string): number {
  return contrastRatio(resolve(surface, foreground), resolve(surface, background));
}

describe('every declared token exists', () => {
  it('is defined in the obsidian scheme', () => {
    const missing = COLOR_TOKENS.filter((token: ColorToken) => !OBSIDIAN.has(token));
    expect(
      missing,
      `config/design.ts declares tokens that app/globals.css does not define: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('defines nothing the design module does not declare', () => {
    // The other direction matters just as much: a token in the stylesheet that
    // TypeScript does not know about is a token no component can safely use.
    const declared = new Set<string>(COLOR_TOKENS);
    const undeclared = [...OBSIDIAN.keys()].filter((token) => !declared.has(token));
    expect(
      undeclared,
      `app/globals.css defines tokens config/design.ts does not declare: ${undeclared.join(', ')}`,
    ).toEqual([]);
  });

  it('overrides only tokens that already exist', () => {
    for (const [name, overrides] of [
      ['parchment', PARCHMENT_OVERRIDES],
      ['leaf', LEAF_OVERRIDES],
    ] as const) {
      const orphans = [...overrides.keys()].filter((token) => !OBSIDIAN.has(token));
      expect(orphans, `${name} overrides tokens with no base definition`).toEqual([]);
    }
  });
});

/** Foreground tokens that carry body-sized text on the page ground. */
const BODY_TEXT_ON_GROUND = [
  'text',
  'text-muted',
  'text-subtle',
  'text-faint',
  'signal',
  'cobalt',
  'copper',
  'grade-verified',
  'grade-provided',
  'grade-modelled',
  'grade-inference',
  'grade-unknown',
  'verdict-promising',
  'verdict-conditional',
  'verdict-risk',
  'verdict-insufficient',
] as const;

/** Every ground a foreground may land on within a surface. */
const GROUNDS = ['ground', 'ground-raised', 'ground-sunken'] as const;

describe('text contrast', () => {
  for (const surface of Object.keys(SURFACES) as SurfaceName[]) {
    for (const foreground of BODY_TEXT_ON_GROUND) {
      for (const background of GROUNDS) {
        it(`${surface}: ${foreground} on ${background}`, () => {
          const measured = ratio(surface, foreground, background);
          expect(
            Number(measured.toFixed(2)),
            `${foreground} on ${background} in the ${surface} surface`,
          ).toBeGreaterThanOrEqual(CONTRAST.bodyText);
        });
      }
    }
  }

  it('text on a signal-filled control is readable', () => {
    for (const surface of Object.keys(SURFACES) as SurfaceName[]) {
      const measured = ratio(surface, 'text-on-signal', 'signal');
      expect(
        Number(measured.toFixed(2)),
        `text-on-signal in ${surface}`,
      ).toBeGreaterThanOrEqual(CONTRAST.bodyText);
    }
  });

  it('tinted status surfaces carry their own text', () => {
    // A cobalt chip is cobalt text on cobalt-surface, not on the page ground.
    for (const surface of Object.keys(SURFACES) as SurfaceName[]) {
      for (const family of ['cobalt', 'copper', 'signal'] as const) {
        const measured = ratio(surface, family, `${family}-surface`);
        expect(
          Number(measured.toFixed(2)),
          `${family} on ${family}-surface in ${surface}`,
        ).toBeGreaterThanOrEqual(CONTRAST.bodyText);
      }
    }
  });

  it('the document sheet carries the page text ramp', () => {
    // text-on-leaf is used where a bone panel appears inside a ground-coloured
    // page rather than inside a [data-surface] block, so it is checked directly.
    for (const surface of ['obsidian', 'parchment'] as const) {
      for (const foreground of ['text-on-leaf', 'text-on-leaf-muted'] as const) {
        for (const background of ['leaf', 'leaf-sunken'] as const) {
          const measured = ratio(surface, foreground, background);
          expect(
            Number(measured.toFixed(2)),
            `${foreground} on ${background} in ${surface}`,
          ).toBeGreaterThanOrEqual(CONTRAST.bodyText);
        }
      }
    }
  });
});

describe('non-text contrast', () => {
  it('a strong rule is distinguishable from what it separates', () => {
    // WCAG 1.4.11. `rule` and `rule-faint` are deliberately not checked: they
    // are decorative hairlines and cartographic texture, never the only thing
    // delimiting a control. `rule-strong` is, so it is held to 3:1.
    for (const surface of Object.keys(SURFACES) as SurfaceName[]) {
      for (const background of GROUNDS) {
        const measured = ratio(surface, 'rule-strong', background);
        expect(
          Number(measured.toFixed(2)),
          `rule-strong on ${background} in ${surface}`,
        ).toBeGreaterThanOrEqual(CONTRAST.nonText);
      }
    }
  });

  it('the focus ring is visible on every surface', () => {
    for (const surface of Object.keys(SURFACES) as SurfaceName[]) {
      for (const background of GROUNDS) {
        const measured = ratio(surface, 'cobalt', background);
        expect(
          Number(measured.toFixed(2)),
          `focus ring on ${background} in ${surface}`,
        ).toBeGreaterThanOrEqual(CONTRAST.nonText);
      }
    }
  });
});
