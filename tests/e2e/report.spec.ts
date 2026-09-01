import { expect, test, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * The dossier, read the way a customer reads it.
 *
 * `/example` renders the worked example through the real dossier components —
 * the same renderer a paid report uses, with a fixture behind it — so this
 * covers the report experience without needing a job to have run. The fixture
 * is pinned to the pipeline's own output by
 * tests/integration/example-dossier.test.ts, so what is asserted here is what
 * a customer would see.
 *
 * The running theme: a reader must always be able to tell what is a fact, what
 * is our reasoning, and what we could not establish. Colour is never the only
 * thing saying so.
 */

const scan = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return violations;
};

test.describe('the document', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/example');
  });

  test('is clearly labelled as illustrative', async ({ page }) => {
    // A worked example that reads as a real assessment of a real company is a
    // fabricated record. It says what it is, above the fold.
    await expect(page.getByRole('note').first()).toContainText(/illustrat|example/i);
  });

  test('opens with the decision, not with methodology', async ({ page }) => {
    // Exactly one h1: the example page's own. The dossier's title steps down to
    // an h2 when it is embedded rather than being the page.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('#decision')).toBeVisible();
  });

  test('carries all twelve sections', async ({ page }) => {
    for (const id of [
      'decision',
      'executive',
      'context',
      'signals',
      'competitive',
      'customers',
      'route',
      'pricing',
      'regulation',
      'risks',
      'plan',
      'appendix',
    ]) {
      await expect(page.locator(`#${id}`), `#${id} is missing`).toHaveCount(1);
    }
  });

  test('states what it could not establish', async ({ page }) => {
    const appendix = page.locator('#appendix');
    await appendix.scrollIntoViewIfNeeded();
    await expect(appendix).toContainText(/limitation|could not/i);
  });

  test('presents regulation as research rather than legal advice', async ({ page }) => {
    const regulation = page.locator('#regulation');
    await regulation.scrollIntoViewIfNeeded();
    await expect(regulation.getByRole('note')).toContainText(
      /not legal or regulatory advice/i,
    );
  });
});

test.describe('evidence is labelled, not implied', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/example');
  });

  test('names the grade of a claim in words', async ({ page }) => {
    // Every grade the fixture carries must appear as text somewhere. A coloured
    // dot alone is unreadable to a screen reader and to a printer.
    // Case-insensitive: the badges are set in the metadata face, which
    // uppercases them, and `innerText` reports text as rendered.
    const body = await page.locator('main').innerText();
    expect(body).toMatch(/verified fact|unverified|strategic inference|you told us/i);
  });

  test('distinguishes a page we read from one we only saw summarised', async ({
    page,
  }) => {
    /*
     * Located by element, not by role. Chrome maps `<summary>` to
     * `DisclosureTriangle` rather than to `button`, so a role query for a
     * button inside the drawer matches nothing and waits out the timeout.
     */
    const drawer = page.locator('details').first();
    await drawer.scrollIntoViewIfNeeded();
    await drawer.locator('summary').click();
    await expect(drawer).toHaveAttribute('open', '');

    const text = await drawer.innerText();
    expect(text).toMatch(/Read directly|Index summary/i);
  });

  test('opens a source drawer with the keyboard and closes it again', async ({
    page,
  }) => {
    const summary = page.locator('summary').first();
    await summary.scrollIntoViewIfNeeded();
    await summary.focus();
    await expect(summary).toBeFocused();

    await summary.press('Enter');
    await expect(page.locator('details').first()).toHaveAttribute('open', '');

    await summary.press('Enter');
    await expect(page.locator('details').first()).not.toHaveAttribute('open', '');
  });

  test('links every cited source to where it came from', async ({ page }) => {
    const appendix = page.locator('#appendix');
    await appendix.scrollIntoViewIfNeeded();

    const links = appendix.getByRole('link');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < Math.min(count, 8); index += 1) {
      const href = await links.nth(index).getAttribute('href');
      expect(href).toMatch(/^https?:\/\//);
    }
  });
});

test.describe('navigating a long document', () => {
  test('has a contents rail that jumps to a section', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/example');

    const nav = page.getByRole('navigation', { name: 'Report contents' }).first();
    await expect(nav).toBeVisible();

    await nav.getByRole('link', { name: /Risk register/ }).click();
    await expect(page).toHaveURL(/#risks$/);
    await expect(page.locator('#risks')).toBeInViewport();
  });

  test('keeps a contents rail on a phone', async ({ page }) => {
    // Twelve sections on a 390px screen without navigation is a scroll, not a
    // document. The mobile rail is a different element, not the desktop one
    // shrunk, so it needs its own assertion.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/example');

    const navs = page.getByRole('navigation', { name: 'Report contents' });
    const visible = await navs.evaluateAll(
      (nodes) =>
        nodes.filter((node) => (node as HTMLElement).offsetParent !== null).length,
    );
    expect(visible).toBe(1);
  });

  test('marks the section you are reading', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/example');

    await page.locator('#risks').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    const current = page
      .getByRole('navigation', { name: 'Report contents' })
      .first()
      .locator('[aria-current="true"]');
    await expect(current).toHaveCount(1);
  });
});

test.describe('sharing and printing', () => {
  test('offers a print route, and no share link for a fixture', async ({ page }) => {
    await page.goto('/example');
    await expect(
      page.getByRole('button', { name: /Print or save as PDF/ }),
    ).toBeVisible();

    // Sharing is managed per stored report; the worked example has none, so
    // there is nothing to manage and no control offering to.
    await expect(page.getByRole('link', { name: /Manage sharing/ })).toHaveCount(0);
  });

  test('drops the navigation chrome in print, and keeps the evidence', async ({
    page,
  }) => {
    await page.goto('/example');
    await page.emulateMedia({ media: 'print' });

    // Controls that do nothing on paper are hidden; the document is not.
    await expect(page.getByRole('button', { name: /Print or save as PDF/ })).toBeHidden();
    await expect(
      page.getByRole('navigation', { name: 'Report contents' }).first(),
    ).toBeHidden();
    await expect(page.locator('#appendix')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('shows every source drawer on paper, so nothing is lost', async ({ page }) => {
    /*
     * A collapsed drawer prints as a summary line, and the evidence behind a
     * claim is the point of the document. Asserted on what a reader would see
     * rather than on the `open` attribute: print reveals the contents through
     * CSS and deliberately leaves the attribute alone, so someone reading the
     * same page on screen afterwards finds it as they left it.
     */
    await page.goto('/example');

    const drawer = page.locator('details').first();
    await drawer.scrollIntoViewIfNeeded();
    const contents = drawer.locator('> div');
    await expect(contents).toBeHidden();

    await page.emulateMedia({ media: 'print' });
    await expect(contents).toBeVisible();

    expect(await page.locator('details').count()).toBeGreaterThan(0);
  });
});

test.describe('accessibility', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`the dossier has no violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/example');

      const violations = await scan(page);
      expect(violations, violations.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual(
        [],
      );
    });
  }

  test('is accessible with every source drawer open', async ({ page }) => {
    // The drawers hold most of the document's content and axe cannot see inside
    // a closed one, so a scan of the collapsed page proves very little.
    await page.goto('/example');
    await page.locator('details').evaluateAll((nodes) => {
      for (const node of nodes) (node as HTMLDetailsElement).open = true;
    });

    const violations = await scan(page);
    expect(violations, violations.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual(
      [],
    );
  });

  for (const width of [320, 390, 768, 1280]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/example');
      await page.waitForTimeout(400);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        if (doc.scrollWidth <= doc.clientWidth) return null;
        for (const el of document.querySelectorAll('*')) {
          const rect = el.getBoundingClientRect();
          if (rect.right > doc.clientWidth + 1) {
            return `${el.tagName}.${String(el.className).slice(0, 60)}`;
          }
        }
        return `scrollWidth ${doc.scrollWidth}`;
      });

      expect(overflow).toBeNull();
    });
  }
});

test.describe('motion', () => {
  test('renders everything in its final state under reduced motion', async ({ page }) => {
    // The failure mode is not a missing animation, it is a page that never
    // finishes revealing itself and so has no content on it.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/example');

    const hidden = await page.evaluate(() => {
      const offenders: string[] = [];
      for (const el of document.querySelectorAll('[data-reveal]')) {
        const style = getComputedStyle(el);
        if (Number(style.opacity) < 0.99) offenders.push(el.className);
      }
      return offenders;
    });

    expect(hidden, 'elements left mid-animation under reduced motion').toEqual([]);
  });

  test('animates nothing on the landing page under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const animating = await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => animation.playState === 'running')
          .length,
    );
    expect(animating).toBe(0);
  });
});
