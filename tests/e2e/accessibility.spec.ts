import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * Accessibility, layout and motion honesty across the workspace, in both
 * themes. Every check here caught something real at some point; the
 * contrast rules in particular are easy to break by adjusting one token
 * and impossible to notice by eye.
 */

const MEMBER = {
  id: '44444444-4444-4444-8444-444444444444',
  email: 'a11y@example.com',
  role: 'super_admin' as const,
};

async function signIn(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    {
      name: 'e2e-test-session',
      value: encodeURIComponent(JSON.stringify(MEMBER)),
      url: baseURL,
    },
  ]);
}

async function scan(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations;
}

const PUBLIC_PAGES = ['/', '/privacy', '/terms', '/sign-in'] as const;

const WORKSPACE_PAGES = [
  '/dashboard',
  '/leads',
  '/campaigns',
  '/icps',
  '/pipeline',
  '/tasks',
  '/outreach',
  '/relationships',
  '/watchlists',
  '/territories',
  '/intelligence',
  '/imports',
  '/commercial',
  '/team',
  '/admin',
] as const;

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility — ${scheme} theme`, () => {
    for (const path of PUBLIC_PAGES) {
      test(`${path} has no violations`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        const violations = await scan(page);
        expect(
          violations,
          violations.map((v) => `${v.id}: ${v.help}`).join('\n'),
        ).toEqual([]);
      });
    }

    for (const path of WORKSPACE_PAGES) {
      test(`${path} has no violations`, async ({ page, context, baseURL }) => {
        await signIn(context, baseURL!);
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        const violations = await scan(page);
        expect(
          violations,
          violations.map((v) => `${v.id}: ${v.help}`).join('\n'),
        ).toEqual([]);
      });
    }
  });
}

test.describe('no page scrolls sideways', () => {
  for (const width of [320, 390, 768, 1280]) {
    test(`the workspace fits ${width}px`, async ({ page, context, baseURL }) => {
      await signIn(context, baseURL!);
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/dashboard', '/leads', '/pipeline', '/territories']) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} overflows at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test.describe('motion honesty', () => {
  test('reduced motion lands every page in its final, complete state', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    await page.emulateMedia({ reducedMotion: 'reduce' });

    for (const path of ['/dashboard', '/territories', '/pipeline']) {
      await page.goto(path);
      // Nothing waits hidden for an observer, and nothing keeps looping.
      const pending = await page.$$eval(
        '[data-reveal="pending"]',
        (nodes) => nodes.length,
      );
      expect(pending, `${path} holds content hidden under reduced motion`).toBe(0);

      const looping = await page.evaluate(
        () =>
          [...document.querySelectorAll('*')].filter((element) => {
            const animations = element.getAnimations?.() ?? [];
            return animations.some((animation) => {
              const timing = animation.effect?.getTiming();
              return timing?.iterations === Infinity && animation.playState === 'running';
            });
          }).length,
      );
      expect(looping, `${path} keeps looping animations under reduced motion`).toBe(0);
    }
  });
});
