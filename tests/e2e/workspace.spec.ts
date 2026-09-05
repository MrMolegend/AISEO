import { expect, test, type BrowserContext } from '@playwright/test';

/**
 * The workspace surface: who can see what, and what nobody sees.
 *
 * Role enforcement here is the browser-visible half of the membership
 * model tested in tests/integration — a role-gated page answers a member
 * outside the role with the same 404 a mistyped URL gets, the marketing
 * routes of the earlier product resolve to the gateway, and nothing on
 * the workspace sells, sends, or counts credits.
 */

function session(role?: string) {
  return {
    id: crypto.randomUUID(),
    email: `${role ?? 'person'}@example.com`,
    ...(role ? { role } : {}),
  };
}

async function signInAs(context: BrowserContext, baseURL: string, role?: string) {
  await context.addCookies([
    {
      name: 'e2e-test-session',
      value: encodeURIComponent(JSON.stringify(session(role))),
      url: baseURL,
    },
  ]);
}

test.describe('role-gated pages 404 outside the role', () => {
  const CASES: { path: string; deniedRole: string; allowedRole: string }[] = [
    { path: '/commercial', deniedRole: 'sales_rep', allowedRole: 'sales_manager' },
    { path: '/imports', deniedRole: 'sales_rep', allowedRole: 'sales_manager' },
    { path: '/team', deniedRole: 'sales_rep', allowedRole: 'sales_manager' },
    { path: '/admin', deniedRole: 'sales_manager', allowedRole: 'super_admin' },
    { path: '/watchlists', deniedRole: 'viewer', allowedRole: 'sales_rep' },
  ];

  for (const { path, deniedRole, allowedRole } of CASES) {
    test(`${path}: ${deniedRole} sees a 404, ${allowedRole} sees the page`, async ({
      browser,
      baseURL,
    }) => {
      const denied = await browser.newContext();
      await signInAs(denied, baseURL!, deniedRole);
      const deniedPage = await denied.newPage();
      const deniedResponse = await deniedPage.goto(path);
      expect(deniedResponse?.status()).toBe(404);
      await denied.close();

      const allowed = await browser.newContext();
      await signInAs(allowed, baseURL!, allowedRole);
      const allowedPage = await allowed.newPage();
      const allowedResponse = await allowedPage.goto(path);
      expect(allowedResponse?.status()).toBe(200);
      await allowedPage.getByRole('heading', { level: 1 }).waitFor({ state: 'visible' });
      await allowed.close();
    });
  }
});

test.describe('the earlier product is a redirect, not a surface', () => {
  for (const path of ['/pricing', '/example', '/methodology']) {
    test(`${path} resolves to the gateway`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/$/);
    });
  }

  test('robots are disallowed everywhere — this is an internal tool', async ({
    request,
    baseURL,
  }) => {
    const response = await request.get(`${baseURL}/robots.txt`);
    const body = await response.text();
    expect(body).toContain('Disallow: /');
  });
});

test.describe('what nobody sees', () => {
  test('the workspace never mentions credits or tokens', async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL!, 'sales_manager');
    for (const path of ['/dashboard', '/leads', '/campaigns', '/pipeline']) {
      await page.goto(path);
      const text = (await page.locator('main').innerText()).toLowerCase();
      expect(text, `${path} mentions credits`).not.toMatch(/\bcredits?\b|\btokens?\b/);
    }
  });

  test('every page carries the no-automatic-sending disclosure', async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL!, 'sales_rep');
    await page.goto('/dashboard');
    await expect(
      page.locator('footer').getByText(/nothing sends automatically/i),
    ).toBeVisible();
  });
});

test.describe('the command palette', () => {
  test('opens on Ctrl+K, navigates, and closes on Escape', async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL!, 'sales_manager');
    await page.goto('/dashboard');

    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    // The shortcut only exists once React has hydrated the header; retrying
    // the press is how a person behaves when the first tap lands too early.
    await expect(async () => {
      await page.keyboard.press('ControlOrMeta+k');
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });

    await dialog.getByRole('textbox').fill('Pipeline');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/pipeline$/);

    await expect(async () => {
      await page.keyboard.press('ControlOrMeta+k');
      await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible({
        timeout: 1_000,
      });
    }).toPass({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toHaveCount(0);
  });
});
