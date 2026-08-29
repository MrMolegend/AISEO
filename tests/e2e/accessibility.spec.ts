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
const PAGES = [
  '/',
  '/example',
  '/methodology',
  '/privacy',
  '/terms',
  '/sign-in',
] as const;

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
    for (const path of ['/dashboard', '/wallet', '/account', '/assess']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in/);
    }
  });

  test('a comparison table can be scrolled without a mouse', async ({ page }) => {
    /*
     * The route comparison is wider than a phone viewport, so its wrapper
     * scrolls. Nothing inside it is focusable — it is plain text — so without
     * an explicit focus stop a keyboard user cannot reach the scroll at all and
     * the right-hand columns are simply unavailable to them.
     *
     * axe catches the absence of the focus stop. This asserts the presence of a
     * working one: that it is reachable, that it is announced with the caption
     * it belongs to, and that scrolling it actually moves.
     */
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/example');

    const region = page.getByRole('region', {
      name: 'Routes to market compared by suitability, requirements and risks',
    });
    await region.scrollIntoViewIfNeeded();
    await expect(region).toBeVisible();

    await region.focus();
    await expect(region).toBeFocused();

    const scrolled = await region.evaluate((element) => {
      const before = element.scrollLeft;
      element.scrollLeft = 200;
      return { before, after: element.scrollLeft };
    });
    expect(scrolled.before).toBe(0);
    expect(scrolled.after).toBeGreaterThan(0);
  });

  test('the built app serves the Supabase origin in connect-src', async ({ request }) => {
    /*
     * The test that would have caught the outage.
     *
     * The policy is assembled in lib/security/csp.ts, read by next.config.ts
     * and baked into the routes manifest during the build. A break anywhere
     * along that path raises nothing — the build succeeds and the page simply
     * ships without a usable policy, which is exactly what happened: Vercel
     * built without NEXT_PUBLIC_SUPABASE_URL, connect-src went out as bare
     * 'self', and every sign-in was blocked in the browser.
     *
     * This suite's webServer deliberately does NOT set that variable, so this
     * runs in precisely the condition that broke production. The origin must
     * be there anyway.
     */
    const SUPABASE_ORIGIN = 'https://euyhkmtxdigdnvmboebf.supabase.co';

    const response = await request.get('/sign-in');
    const policy = response.headers()['content-security-policy'];

    expect(policy, 'no Content-Security-Policy header was served').toBeTruthy();
    if (!policy) throw new Error('unreachable: the assertion above already failed');

    // The literal directive production must serve, written out in full.
    expect(policy).toContain(`connect-src 'self' ${SUPABASE_ORIGIN}`);

    // Nothing broader standing in for it. A wildcard would satisfy the browser
    // and hand injected script an exfiltration channel to every host under it.
    const connectSrc = policy.split(';').find((d) => d.trim().startsWith('connect-src'));
    expect(connectSrc?.trim()).toBe(`connect-src 'self' ${SUPABASE_ORIGIN}`);
    expect(connectSrc).not.toMatch(/\*/);
    // The bare `https:` scheme source, which allows every https origin there
    // is. Note the lookahead: `https://host` is the allowance we want, and an
    // earlier version of this line matched that too.
    expect(connectSrc).not.toMatch(/\shttps:(?!\/\/)/);

    // No credential of any kind rode along into a header every visitor reads.
    expect(policy).not.toMatch(/eyJ[A-Za-z0-9_-]/);
    expect(policy).not.toMatch(/sb_(publishable|secret)_/);
    expect(policy).not.toMatch(/service[_-]?role/i);
    expect(policy).not.toContain('apikey');

    // And the rest of the policy is intact.
    expect(policy).toContain(`frame-ancestors 'none'`);
    expect(policy).toContain(`object-src 'none'`);
    expect(policy).toContain(`base-uri 'self'`);
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
  for (const width of [320, 360, 390, 768, 1280, 1536]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });

      for (const path of ['/', '/example', '/methodology', '/privacy', '/sign-in']) {
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
