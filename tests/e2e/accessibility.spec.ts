import { expect, test, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * Accessibility and layout regressions, in both themes.
 *
 * These began as ad-hoc probes during development; they belong in CI because
 * every one of them caught something real. The contrast rules in particular are
 * easy to break by adjusting a single token, and impossible to notice by eye.
 */

/*
 * The signed-out surface.
 *
 * Everything behind sign-in needs a real Supabase project, which this suite
 * deliberately does not have — it runs with no credentials, no network egress
 * and no cost. The signed-in pages are covered by the integration suite, which
 * exercises the same server code without a browser.
 */
const PAGES = ['/', '/pricing', '/privacy', '/terms', '/sign-in'] as const;

async function scan(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations;
}

test.describe('accessibility — light theme', () => {
  for (const path of PAGES) {
    test(`${path} has no violations`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(path);
      const violations = await scan(page);
      expect(violations, violations.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual(
        [],
      );
    });
  }
});

test.describe('accessibility — dark theme', () => {
  for (const path of PAGES) {
    test(`${path} has no violations`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(path);
      const violations = await scan(page);
      expect(violations, violations.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual(
        [],
      );
    });
  }
});

test.describe('accessibility — designed error states', () => {
  test('the 404 page is accessible in both themes', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/no-such-page-exists');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const violations = await scan(page);
      expect(
        violations,
        `${scheme}: ${violations.map((v) => `${v.id}: ${v.help}`).join('\n')}`,
      ).toEqual([]);
    }
  });
});

test.describe('the signed-out surface', () => {
  test('sends an anonymous visitor to sign-in rather than showing an empty dashboard', async ({
    page,
  }) => {
    for (const path of ['/dashboard', '/wallet', '/account', '/research/new']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in/);
    }
  });

  test('keyboard focus reaches the skip link first', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  });
});

test.describe('layout', () => {
  /**
   * Horizontal overflow is invisible on a desktop viewport and ruins a page on a
   * phone. It has already been caused once here by a CSS rotation expanding an
   * SVG's bounding box beyond its layout box.
   */
  for (const width of [360, 390, 768, 1280, 1536]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });

      for (const path of ['/', '/pricing', '/privacy', '/sign-in']) {
        await page.goto(path);
        await page.waitForTimeout(300);

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          if (doc.scrollWidth <= doc.clientWidth) return null;
          for (const el of document.querySelectorAll('*')) {
            const rect = el.getBoundingClientRect();
            if (rect.right > doc.clientWidth + 1) {
              return `${el.tagName}.${String(el.className).slice(0, 60)} extends to ${Math.round(rect.right)}px`;
            }
          }
          return `scrollWidth ${doc.scrollWidth} > clientWidth ${doc.clientWidth}`;
        });

        expect(overflow, `${path} at ${width}px`).toBeNull();
      }
    });
  }
});
