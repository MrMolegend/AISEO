import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * One product, one credit, and nothing about tokens.
 *
 * Three promises this suite exists to keep honest, each of which is about
 * something *not* being on a screen:
 *
 *   · There are no packages, bundles or price comparisons anywhere.
 *   · The customer is told about report credits, never about the hundred
 *     internal tokens one costs.
 *   · Purchasing is not in the navigation, because there is nothing to buy.
 *
 * Absences are the easiest thing to reintroduce by accident and the hardest to
 * notice, so they are asserted across every route rather than spot-checked.
 */

const SESSION = { id: '11111111-1111-4111-8111-111111111111', email: 'sam@example.com' };

async function signIn(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    {
      name: 'e2e-test-session',
      value: encodeURIComponent(JSON.stringify(SESSION)),
      url: baseURL,
    },
  ]);
}

const SIGNED_OUT = ['/', '/example', '/methodology', '/privacy', '/terms'] as const;
const SIGNED_IN = ['/dashboard', '/account', '/wallet', '/assess'] as const;

const bodyText = async (page: Page) =>
  (await page.locator('body').innerText()).toLowerCase();

test.describe('tokens never reach the customer', () => {
  test('no signed-out page mentions them', async ({ page }) => {
    for (const path of SIGNED_OUT) {
      await page.goto(path);
      const text = await bodyText(page);
      expect(text, `${path} mentions tokens`).not.toMatch(/\btokens?\b/);
    }
  });

  test('no signed-in page mentions them', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    for (const path of SIGNED_IN) {
      await page.goto(path);
      const text = await bodyText(page);
      expect(text, `${path} mentions tokens`).not.toMatch(/\btokens?\b/);
    }
  });

  test('the account page counts credits, not the hundred behind one', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    await page.goto('/account');

    const text = await bodyText(page);
    expect(text).toMatch(/report credits?/);
    expect(text).not.toMatch(/\b100\b/);
  });

  test('the credit history reads in credits', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.goto('/wallet');

    const text = await bodyText(page);
    expect(text).toMatch(/credit/);
    expect(text).not.toMatch(/\btokens?\b/);
  });
});

test.describe('there is one product', () => {
  test('no page offers bundles, packages or a price comparison', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    for (const path of [...SIGNED_OUT, ...SIGNED_IN]) {
      await page.goto(path);
      const text = await bodyText(page);
      for (const forbidden of [
        'competitor intelligence',
        'lead finder',
        'influencer outreach',
        'market pack',
        'token bundle',
        'choose a package',
      ]) {
        expect(text, `${path} offers "${forbidden}"`).not.toContain(forbidden);
      }
    }
  });

  test('the old package routes redirect to the one that exists', async ({ page }) => {
    for (const path of [
      '/research/new',
      '/research/new/competitor-intelligence',
      '/research/new/lead-finder',
    ]) {
      await page.goto(path);
      await expect(page, `${path} did not redirect`).toHaveURL(/\/(assess|sign-in)/);
    }
  });

  test('pricing redirects to methodology, where the credit is explained', async ({
    page,
  }) => {
    await page.goto('/pricing');
    await expect(page).toHaveURL(/\/methodology$/);
    await expect(page.locator('body')).toContainText(/credit/i);
  });
});

test.describe('purchasing is not in the navigation', () => {
  test('no navigation offers to sell anything', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);

    for (const path of ['/dashboard', '/account', '/assess']) {
      await page.goto(path);
      const navs = page.getByRole('navigation');
      const text = (await navs.allInnerTexts()).join(' ').toLowerCase();
      expect(text, `${path} navigation sells something`).not.toMatch(
        /buy|purchase|pricing|top up|checkout/,
      );
    }
  });

  test('the account menu reaches the desk, dossiers, account and sign-out', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: /Account menu/ }).click();
    const menu = page.getByRole('menu', { name: 'Account' });

    await expect(menu.getByRole('menuitem', { name: 'Intelligence Desk' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'My dossiers' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Account' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  });

  test('the wallet is still reachable directly, for anyone who has the link', async ({
    page,
    context,
    baseURL,
  }) => {
    // De-navigated is not deleted: the credit history is the customer's record
    // of what happened to their account.
    await signIn(context, baseURL!);
    await page.goto('/wallet');
    await expect(page).toHaveURL(/\/wallet$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('the landing page', () => {
  test('says what the product is, in the words it promised', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Enter new markets with evidence.',
    );
  });

  test('offers the two ways in', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('link', { name: 'Assess a market' }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Explore an example' }).first(),
    ).toBeVisible();
  });

  test('does not claim to read your website', async ({ page }) => {
    await page.goto('/');
    const text = await bodyText(page);
    expect(text).not.toMatch(/enter your (website|url|domain)/);
    expect(text).not.toMatch(/we.ll (crawl|scan) your site/);
  });

  test('every hero and section reveals rather than staying blank', async ({ page }) => {
    // Reveal-on-scroll that never fires is an empty page, and it has happened
    // here: an element shorter than a scroll step was skipped by the observer.
    await page.goto('/');
    await page.evaluate(async () => {
      const step = window.innerHeight / 2;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    });
    await page.waitForTimeout(800);

    const unrevealed = await page.evaluate(() =>
      [...document.querySelectorAll('[data-reveal]')]
        .filter((el) => el.getAttribute('data-reveal') !== 'shown')
        .map((el) => String(el.className).slice(0, 60)),
    );
    expect(unrevealed).toEqual([]);
  });
});

test.describe('the intelligence desk', () => {
  test('shows the credit balance and a way to start', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    await page.goto('/dashboard');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Assess a market' }).first(),
    ).toBeVisible();
    await expect(page.locator('body')).toContainText(/credit/i);
  });

  test('has no package cards on it', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.goto('/dashboard');
    const text = await bodyText(page);
    expect(text).not.toMatch(/\d+\s*(tokens|credits) · /);
    expect(text).not.toContain('choose a package');
  });
});

test.describe('the health endpoint', () => {
  test('names its providers and reports places as disabled', async ({ request }) => {
    const response = await request.get('/api/health');
    const body = (await response.json()) as {
      providers: Record<string, string>;
      status: string;
    };

    expect(body.providers.places).toBe('disabled');
    expect(body.providers).toHaveProperty('research');
    expect(body.providers).toHaveProperty('ai');

    // No credential of any kind, in any state.
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]/);
    expect(text).not.toMatch(/sk-ant-/);
    expect(text).not.toMatch(/tvly-/);
    expect(text).not.toMatch(/sb_(publishable|secret)_/);
  });
});

test.describe('accessibility of the signed-in surface', () => {
  for (const path of SIGNED_IN) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${path} has no violations (${scheme})`, async ({
        page,
        context,
        baseURL,
      }) => {
        await signIn(context, baseURL!);
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);

        const { violations } = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();

        expect(
          violations,
          violations.map((v) => `${v.id}: ${v.help}`).join('\n'),
        ).toEqual([]);
      });
    }
  }

  for (const width of [320, 390, 768, 1280]) {
    test(`the signed-in surface does not overflow at ${width}px`, async ({
      page,
      context,
      baseURL,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(context, baseURL!);

      for (const path of SIGNED_IN) {
        await page.goto(path);
        await page.waitForTimeout(250);

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return doc.scrollWidth > doc.clientWidth
            ? `${doc.scrollWidth} > ${doc.clientWidth}`
            : null;
        });
        expect(overflow, `${path} at ${width}px`).toBeNull();
      }
    });
  }
});
