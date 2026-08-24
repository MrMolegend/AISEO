import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { BRAND, pageTitle } from '@/config/brand';

/**
 * The product name lives in one file.
 *
 * "Research Suite" is a working title, not a decision, and the whole point of
 * routing every user-facing string through config/brand.ts is that renaming the
 * product is one edit rather than a search-and-replace across the app directory
 * — the kind of search that always misses a page title, an email subject and one
 * error message.
 *
 * This test is what makes that claim true rather than aspirational. It reads the
 * source tree and fails if the name appears as a literal anywhere but its own
 * config file. Nothing else enforces it: a hard-coded name compiles perfectly.
 */

const ROOT = process.cwd();

const SEARCHED_DIRS = ['app', 'components', 'lib', 'schemas', 'prompts', 'config'];

/** config/brand.ts is where the name is *supposed* to be. */
const ALLOWED = new Set([join('config', 'brand.ts')]);

function sourceFiles(dir: string): string[] {
  const found: string[] = [];

  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (/\.(ts|tsx)$/.test(entry)) {
        found.push(path);
      }
    }
  };

  walk(join(ROOT, dir));
  return found;
}

describe('the product name', () => {
  it('appears as a literal only in config/brand.ts', () => {
    const offenders: string[] = [];

    for (const dir of SEARCHED_DIRS) {
      for (const file of sourceFiles(dir)) {
        const relativePath = relative(ROOT, file);
        if (ALLOWED.has(relativePath)) continue;

        const contents = readFileSync(file, 'utf8');
        contents.split('\n').forEach((line, index) => {
          if (line.includes(BRAND.name)) {
            offenders.push(`${relativePath.split(sep).join('/')}:${index + 1}`);
          }
        });
      }
    }

    expect(
      offenders,
      `The product name is hard-coded in ${offenders.length} place(s). ` +
        'Import BRAND from @/config/brand instead:\n  ' +
        offenders.join('\n  '),
    ).toEqual([]);
  });

  it('has no placeholder left in the identity that ships', () => {
    // A working title is fine. "TODO" in a page title is not.
    for (const value of [BRAND.name, BRAND.shortName, BRAND.tagline, BRAND.legalEntity]) {
      expect(value.trim().length).toBeGreaterThan(0);
      expect(value).not.toMatch(/todo|tbd|xxx|lorem|changeme/i);
    }
  });
});

describe('the internal currency', () => {
  it('says what it is not, because "tokens" is an overloaded word', () => {
    const disclaimer = BRAND.currency.disclaimer.toLowerCase();

    // Users arrive assuming one of two wrong things. Both are addressed
    // explicitly wherever a balance is shown for the first time on a page.
    expect(disclaimer).toContain('cryptocurrency');
    expect(disclaimer).toMatch(/provider|model|ai/);
    expect(disclaimer).toContain('no cash value');
  });
});

describe('pageTitle', () => {
  it('suffixes a page name and falls back to the tagline', () => {
    expect(pageTitle('Dashboard')).toBe(`Dashboard — ${BRAND.shortName}`);
    expect(pageTitle()).toBe(`${BRAND.name} — ${BRAND.tagline}`);
  });
});
