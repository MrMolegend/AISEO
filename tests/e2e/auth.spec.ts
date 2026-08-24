import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * The signed-in surface, in a real browser.
 *
 * The outage this release fixes was invisible to every other kind of test: the
 * build passed, the types passed, the route returned a redirect. What nobody
 * could see was a user arriving on a page that did not know who they were. So
 * these open an actual browser and look.
 *
 * The session comes from the in-memory driver (AUTH_TEST_DRIVER=1, set in
 * playwright.config.ts). It stands in for Supabase and nothing else — the
 * header, the account menu, the sign-out route, the protected-route redirects
 * and every page below are the real ones.
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

async function scan(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations;
}

const AUTH_PAGES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/auth/error?reason=expired',
] as const;

test.describe('the header tells you whether you are signed in', () => {
  test('signed out: offers both ways in', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header');
    // Sign in is visible at every width. Create account moves into the menu
    // below `sm`, where three controls plus the trigger would overflow.
    await expect(header.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(header.getByRole('button', { name: /Account menu/ })).toHaveCount(0);

    const viewport = page.viewportSize();
    if ((viewport?.width ?? 0) >= 640) {
      await expect(header.getByRole('link', { name: 'Create account' })).toBeVisible();
    } else {
      await page.getByRole('button', { name: 'Open menu' }).click();
      await expect(
        page.getByRole('menu', { name: 'Site' }).getByRole('menuitem', {
          name: 'Create account',
        }),
      ).toBeVisible();
    }
  });

  test('signed in: shows who you are and what you have', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    await page.goto('/');

    // The whole point of the fix: a page that knows the visitor.
    const account = page.getByRole('button', { name: new RegExp(SESSION.email) });
    await expect(account).toBeVisible();

    await account.click();
    const menu = page.getByRole('menu', { name: 'Account' });
    await expect(menu).toBeVisible();
    await expect(menu.getByText(SESSION.email)).toBeVisible();
    for (const item of ['Dashboard', 'My reports', 'Account']) {
      await expect(menu.getByRole('menuitem', { name: item })).toBeVisible();
    }
    await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  });

  test('the account control is reachable on a phone too', async ({
    page,
    context,
    baseURL,
  }) => {
    // The old header hid the nav below md and the balance below sm, with no
    // menu in their place — a signed-in phone user saw a logo and a circle.
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(context, baseURL!);
    await page.goto('/dashboard');

    await expect(
      page.getByRole('button', { name: new RegExp(SESSION.email) }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.getByRole('menu', { name: 'Site' });
    await expect(menu.getByRole('menuitem', { name: 'Dashboard' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Pricing' })).toBeVisible();
  });
});

test.describe('signing out', () => {
  test('returns home and says so', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: new RegExp(SESSION.email) }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();

    await expect(page).toHaveURL(/\/\?signed-out=1$/);
    // A redirect on its own is not evidence that anything happened.
    await expect(page.getByText('You have been signed out.')).toBeVisible();

    // And the session is genuinely gone, not merely navigated away from.
    await expect(
      page.locator('header').getByRole('link', { name: 'Sign in' }),
    ).toBeVisible();
  });

  test('a protected page is closed again afterwards', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    await page.goto('/dashboard');
    await page.getByRole('button', { name: new RegExp(SESSION.email) }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/signed-out=1/);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe('protected routes', () => {
  for (const path of ['/dashboard', '/wallet', '/account', '/research/new']) {
    test(`${path} sends an anonymous visitor to sign-in, remembering where`, async ({
      page,
    }) => {
      await page.goto(path);

      await expect(page).toHaveURL(
        new RegExp(`/sign-in\\?next=${encodeURIComponent(path).replace(/%/g, '%')}`),
      );
    });

    test(`${path} opens for a signed-in visitor`, async ({ page, context, baseURL }) => {
      await signIn(context, baseURL!);
      await page.goto(path);

      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  }

  test('an already signed-in visitor is sent away from sign-in', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    await page.goto('/sign-in');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('and is returned to where they were going', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.goto('/sign-in?next=%2Fwallet');
    await expect(page).toHaveURL(/\/wallet$/);
  });

  test('an external next is refused', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.goto('/sign-in?next=https%3A%2F%2Fevil.test%2Fsteal');

    // Signed in on the real site, then handed to an attacker, is the whole
    // value of an open redirect through an auth flow.
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(page.url()).not.toContain('evil.test');
  });
});

test.describe('the authentication pages', () => {
  for (const path of AUTH_PAGES) {
    test(`${path} is usable and gets you home`, async ({ page }) => {
      await page.goto(path);

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const back = page.getByRole('link', { name: 'Back to home' });
      await expect(back).toBeVisible();
      await back.click();
      await expect(page).toHaveURL(/\/$/);
    });
  }

  test('sign-in offers a password, a link, recovery and sign-up', async ({ page }) => {
    await page.goto('/sign-in');

    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Email me a sign-in link instead' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create an account' })).toBeVisible();
  });

  test('the sign-in form can switch to the magic-link fallback', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: 'Email me a sign-in link instead' }).click();

    await expect(page.getByLabel('Password')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Email me a sign-in link' }),
    ).toBeVisible();
  });

  for (const path of AUTH_PAGES) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${path} has no accessibility violations (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);

        const violations = await scan(page);
        expect(
          violations,
          violations.map((v) => `${v.id}: ${v.help}`).join('\n'),
        ).toEqual([]);
      });
    }
  }

  for (const width of [360, 768, 1280]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });

      for (const path of AUTH_PAGES) {
        await page.goto(path);
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

test.describe('the signed-in surface is accessible too', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`the dashboard has no violations (${scheme})`, async ({
      page,
      context,
      baseURL,
    }) => {
      await signIn(context, baseURL!);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/dashboard');

      const violations = await scan(page);
      expect(violations, violations.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual(
        [],
      );
    });
  }

  test('the open account menu is accessible', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.goto('/dashboard');
    await page.getByRole('button', { name: new RegExp(SESSION.email) }).click();

    const violations = await scan(page);
    expect(violations, violations.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual(
      [],
    );
  });

  test('Escape closes the menu and returns focus', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.goto('/dashboard');

    const trigger = page.getByRole('button', { name: new RegExp(SESSION.email) });
    await trigger.click();
    await expect(page.getByRole('menu', { name: 'Account' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu', { name: 'Account' })).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});
