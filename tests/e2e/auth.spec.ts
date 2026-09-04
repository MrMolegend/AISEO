import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * Authentication and the three header states, in a real browser.
 *
 * This workspace has exactly three kinds of visitor: a signed-out stranger
 * (wordmark + Sign in, nothing to market), a signed-in account without
 * membership (the account control and the request-access holding page,
 * nothing else), and a member (the workspace for their role). The session
 * comes from the in-memory driver (AUTH_TEST_DRIVER=1, set in
 * playwright.config.ts); the header, membership resolution, sign-out route
 * and protected-route redirects are the real ones.
 */

const MEMBER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'sam@example.com',
  role: 'sales_manager' as const,
};

const OUTSIDER = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'stranger@example.com',
};

async function signIn(
  context: BrowserContext,
  baseURL: string,
  session: object = MEMBER,
) {
  await context.addCookies([
    {
      name: 'e2e-test-session',
      value: encodeURIComponent(JSON.stringify(session)),
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

test.describe('the three header states', () => {
  test('signed out: the gateway, the wordmark and one way in', async ({ page }) => {
    await page.goto('/');

    const header = page.locator('header');
    await expect(header.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(header.getByRole('button', { name: /Account menu/ })).toHaveCount(0);

    // An internal tool markets nothing: no pricing, no feature tour, no
    // sign-up pitch — one sentence and the door.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/invitation/i).first()).toBeVisible();
  });

  test('a member sees the workspace navigation for their role', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    await page.goto('/dashboard');

    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const label of ['Command Center', 'Leads', 'Campaigns', 'Pipeline']) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }

    const account = page.getByRole('button', { name: new RegExp(MEMBER.email) });
    await expect(account).toBeVisible();
    await account.click();
    const menu = page.getByRole('menu', { name: 'Account' });
    await expect(menu).toBeVisible();
    await expect(menu.getByText(MEMBER.email)).toBeVisible();
    for (const item of ['Relationships', 'Territories', 'Team', 'Account']) {
      await expect(menu.getByRole('menuitem', { name: item })).toBeVisible();
    }
    await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
  });

  test('a signed-in non-member gets the holding page, not the workspace', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!, OUTSIDER);
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/request-access$/);
    // Their email is shown so they can quote it to the administrator.
    await expect(page.getByText(OUTSIDER.email, { exact: true })).toBeVisible();
    // No workspace navigation leaks to someone without membership.
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
  });

  test('the workspace is reachable on a phone through the menu', async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(context, baseURL!);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.getByRole('menu', { name: 'Site' });
    for (const item of ['Command Center', 'Leads', 'Pipeline', 'Watchlists']) {
      await expect(menu.getByRole('menuitem', { name: item })).toBeVisible();
    }
  });
});

test.describe('signing out', () => {
  test('returns to the gateway and says so', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: new RegExp(MEMBER.email) }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();

    await expect(page).toHaveURL(/\/\?signed-out=1$/);
    await expect(page.getByText('You have been signed out.')).toBeVisible();
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
    await page.getByRole('button', { name: new RegExp(MEMBER.email) }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/signed-out=1/);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe('protected routes', () => {
  for (const path of ['/dashboard', '/leads', '/campaigns', '/account']) {
    test(`${path} sends an anonymous visitor to sign-in, remembering where`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL(
        new RegExp(`/sign-in\\?next=${encodeURIComponent(path).replace(/%/g, '%')}`),
      );
    });

    test(`${path} opens for a member`, async ({ page, context, baseURL }) => {
      await signIn(context, baseURL!);
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  }

  test('a signed-in member is sent away from sign-in', async ({
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
    await page.goto('/sign-in?next=%2Fleads');
    await expect(page).toHaveURL(/\/leads$/);
  });

  test('an external next is refused', async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!);
    await page.goto('/sign-in?next=https%3A%2F%2Fevil.test%2Fsteal');
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
});
