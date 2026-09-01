import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * The product-depth surfaces, end to end in a browser: profile → prefilled
 * brief → submitted assessment → finished dossier → scenarios, actions,
 * evidence, sharing — one continuous customer journey on the fixture
 * pipeline, plus the isolation and authorisation edges around it.
 *
 * The long test is deliberately one test: the surfaces under it only exist
 * downstream of a real completed report, and sharing one costs less than
 * completing four.
 */

const SESSION = { id: '11111111-1111-4111-8111-111111111111', email: 'sam@example.com' };
const ADMIN = {
  id: '99999999-9999-4999-8999-999999999999',
  email: 'ops@example.com',
  role: 'admin' as const,
};

async function signIn(
  context: BrowserContext,
  baseURL: string,
  session: object = SESSION,
) {
  await context.addCookies([
    {
      name: 'e2e-test-session',
      value: encodeURIComponent(JSON.stringify(session)),
      url: baseURL,
    },
  ]);
}

async function chooseFrom(page: Page, label: string, query: string, option: RegExp) {
  const combobox = page.getByRole('combobox', { name: label });
  await combobox.click();
  await combobox.pressSequentially(query);
  await page.getByRole('option', { name: option }).first().click();
  await expect(combobox).toHaveValue(option);
}

async function chooseCard(page: Page, label: string) {
  await page.getByText(label, { exact: true }).click();
}

test.describe('business profiles', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!);
  });

  test('create, edit, archive and restore — with the website plainly optional', async ({
    page,
  }) => {
    await page.goto('/profiles/new');

    // The website field says it is optional before anyone asks.
    await expect(page.getByLabel('Website')).toBeVisible();
    await expect(page.getByText(/Entirely optional/)).toBeVisible();

    await page.getByLabel('Profile name').fill('Ardmore Sea Salt');
    await chooseFrom(page, 'Home market', 'Ireland', /^Ireland/);
    const offerings = page.getByRole('textbox', { name: 'Products and services' });
    await offerings.fill('Flaky sea salt');
    await offerings.press('Enter');
    await page.getByRole('button', { name: 'Create profile' }).click();

    // The list shows it, live, with no-website stated neutrally.
    await expect(page).toHaveURL(/\/profiles$/);
    await expect(page.getByRole('heading', { name: 'Ardmore Sea Salt' })).toBeVisible();

    // Edit it.
    await page.getByRole('link', { name: 'Edit' }).first().click();
    await page.getByLabel('Industry or category').fill('Speciality food');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page).toHaveURL(/\/profiles$/);

    // Archive, then restore. The card's badge and the section heading both
    // say "Archived"; the heading is the unambiguous witness.
    await page.getByRole('button', { name: 'Archive' }).first().click();
    await expect(page.getByRole('heading', { name: 'Archived' })).toBeVisible();
    await page.getByRole('button', { name: 'Restore' }).first().click();
    await expect(page.getByRole('heading', { name: 'Archived' })).toHaveCount(0);
  });

  test('another account sees none of it', async ({ browser, baseURL }) => {
    const mine = await browser.newContext();
    await signIn(mine, baseURL!);
    const minePage = await mine.newPage();
    await minePage.goto('/profiles/new');
    await minePage.getByLabel('Profile name').fill('Private Profile');
    await minePage.getByRole('button', { name: 'Create profile' }).click();
    await expect(minePage).toHaveURL(/\/profiles$/);
    await mine.close();

    const theirs = await browser.newContext();
    await signIn(theirs, baseURL!, {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'other@example.com',
    });
    const theirPage = await theirs.newPage();
    await theirPage.goto('/profiles');
    await expect(theirPage.getByText('Private Profile')).toHaveCount(0);
    await theirs.close();
  });
});

test.describe('admin authorisation', () => {
  test('a customer gets a 404, an admin gets the console', async ({
    browser,
    baseURL,
  }) => {
    const customer = await browser.newContext();
    await signIn(customer, baseURL!);
    const customerPage = await customer.newPage();
    const response = await customerPage.goto('/admin');
    expect(response?.status()).toBe(404);
    await customer.close();

    const admin = await browser.newContext();
    await signIn(admin, baseURL!, ADMIN);
    const adminPage = await admin.newPage();
    await adminPage.goto('/admin');
    await expect(
      adminPage.getByRole('heading', { name: /desk behind the desk/i }),
    ).toBeVisible();
    // Names and states, never secrets: the page admits which providers run,
    // and Google appears only as disabled.
    await expect(adminPage.getByText('Google Places')).toBeVisible();
    await expect(
      adminPage.getByText(/disabled — not part of this product/),
    ).toBeVisible();
    await admin.close();
  });
});

test.describe('account data controls', () => {
  test('export and deletion are offered, deletion behind a typed phrase', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    await page.goto('/account');

    await expect(page.getByRole('link', { name: 'Download my data' })).toBeVisible();

    await page.getByRole('button', { name: /Delete my account/ }).click();
    const confirmButton = page.getByRole('button', { name: 'Delete everything' });
    await expect(confirmButton).toBeDisabled();

    await page.getByLabel(/Type “DELETE MY ACCOUNT”/).fill('delete my account');
    await expect(confirmButton).toBeDisabled();

    // Backing out costs nothing.
    await page.getByRole('button', { name: 'Keep my account' }).click();
    await expect(confirmButton).toHaveCount(0);
  });
});

test.describe('the whole journey', () => {
  test('profile → brief → report → scenarios, actions, evidence, sharing', async ({
    page,
    context,
    baseURL,
    browser,
  }) => {
    test.setTimeout(180_000);
    await signIn(context, baseURL!);

    /* ── A profile, and a brief seeded from it ─────────────────────────── */
    await page.goto('/profiles/new');
    await page.getByLabel('Profile name').fill('Ardmore Sea Salt');
    await page
      .getByLabel('What the business does')
      .fill(
        'Hand-harvested flake sea salt in 100g and 250g retail tins, plus a 5kg catering pouch for hotel kitchens.',
      );
    await page.getByLabel('Industry or category').fill('Speciality food');
    await chooseFrom(page, 'Home market', 'Ireland', /^Ireland/);
    await chooseCard(page, 'Currently trading');
    await page.getByRole('button', { name: 'Create profile' }).click();
    await expect(page).toHaveURL(/\/profiles$/);

    await page
      .locator('main')
      .getByRole('link', { name: 'Assess a market' })
      .first()
      .click();
    await expect(page.getByText(/Prefilled from your/)).toBeVisible();
    // The prefill did the typing for stage 1.
    await expect(page.getByLabel('Business or brand name')).toHaveValue(
      'Ardmore Sea Salt',
    );
    await page.getByLabel('Product or service name').fill('Hand-harvested flake salt');
    await page.getByRole('button', { name: 'Continue' }).click();

    /* ── The rest of the brief ─────────────────────────────────────────── */
    await chooseFrom(
      page,
      'Which market do you want to enter?',
      'United Arab',
      /United Arab Emirates/,
    );
    await chooseCard(page, 'Distributor or agent');
    await chooseCard(page, 'Retailers');
    await page
      .getByLabel('Describe that buyer')
      .fill('Delicatessens, hotel procurement teams and premium grocery buyers.');
    await page
      .getByLabel('Why this market?')
      .fill('Two hotel groups there have asked us about supply.');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Stage 3: give the Lab something to start from.
    await chooseFrom(page, 'Currency these figures are in', 'Euro', /Euro/);
    await page.getByLabel(/Current selling price/).fill('8.90');
    await page.getByLabel(/Estimated unit cost/).fill('4.00');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page
      .getByLabel('What decision are you trying to make?')
      .fill('Whether to appoint a distributor this year or wait another season.');
    await page
      .getByLabel('What worries you most about it?')
      .fill('Committing to registration costs we cannot recover.');
    await page
      .getByLabel('The one question you most want answered')
      .fill('Can a producer of our size get listed without a local entity?');
    await page.getByRole('button', { name: 'Review' }).click();

    await page.getByRole('button', { name: 'Start the assessment' }).click();

    /* ── The report, on the fixture pipeline ───────────────────────────── */
    await expect(page).toHaveURL(/\/research\//, { timeout: 30_000 });
    await expect(page.getByRole('navigation', { name: 'Report workspace' })).toBeVisible({
      timeout: 120_000,
    });

    const reportUrl = page.url();

    /* ── Scenario Lab: deterministic, formula-carrying ─────────────────── */
    await page
      .getByRole('navigation', { name: 'Report workspace' })
      .getByRole('link', { name: 'Scenario Lab' })
      .click();
    await expect(page.getByRole('heading', { name: /on your numbers/ })).toBeVisible();
    await page.getByLabel('Monthly demand — low end').fill('100');
    await page.getByLabel('Monthly demand — high end').fill('300');
    // Base preset reads the midpoint: 200 × 70% = 140.
    await expect(page.getByText('140 units', { exact: false }).first()).toBeVisible();
    // Not-a-forecast is stated, not implied.
    await expect(page.getByText(/not forecasts/)).toBeVisible();

    // Save it, so persistence is real.
    await page.getByLabel('Name this scenario').fill('The cautious one');
    await page.getByRole('button', { name: 'Save scenario' }).click();
    await expect(page.getByText(/Saved as “The cautious one”/)).toBeVisible();

    /* ── Actions: import once, idempotently ────────────────────────────── */
    await page
      .getByRole('navigation', { name: 'Report workspace' })
      .getByRole('link', { name: 'Actions' })
      .click();
    const importButton = page.getByRole('button', {
      name: /Add this report’s plan to my workspace/,
    });
    await importButton.click();
    await expect(page.getByText(/none duplicated/)).toBeVisible();

    const checkboxes = page.getByRole('checkbox');
    // router.refresh() delivers the imported rows asynchronously; wait for
    // the first one before counting.
    await expect(checkboxes.first()).toBeVisible({ timeout: 15_000 });
    const imported = await checkboxes.count();
    expect(imported).toBeGreaterThanOrEqual(3);

    // Pressing it again converges instead of duplicating.
    await page.getByRole('button', { name: /Re-check plan import/ }).click();
    await expect(page.getByText(/none duplicated/)).toBeVisible();
    await expect(checkboxes).toHaveCount(imported);

    // Complete one action; the count survives a reload.
    await checkboxes.first().click();
    await page.reload();
    await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(1);

    /* ── Evidence explorer ─────────────────────────────────────────────── */
    await page
      .getByRole('navigation', { name: 'Report workspace' })
      .getByRole('link', { name: 'Evidence' })
      .click();
    const counter = page.getByRole('status').filter({ hasText: /of \d+ sources/ });
    await expect(counter).toBeVisible();
    const total = Number((await counter.innerText()).match(/of (\d+)/)?.[1] ?? '0');
    expect(total).toBeGreaterThanOrEqual(3);

    // Filtering by direct retrieval narrows, honestly.
    await page.getByLabel('Retrieval').selectOption('direct');
    await expect(counter).not.toContainText(`${total} of ${total}`);
    await page.getByLabel('Retrieval').selectOption('all');

    // External links carry safe attributes.
    const firstLink = page.locator('li a[target="_blank"]').first();
    await expect(firstLink).toHaveAttribute('rel', /noopener/);

    /* ── Sharing: mint, visit, revoke, verify dead ─────────────────────── */
    await page
      .getByRole('navigation', { name: 'Report workspace' })
      .getByRole('link', { name: 'Sharing' })
      .click();
    await page.getByLabel(/Who is this for/).fill('The Dubai distributor');
    await page.getByRole('button', { name: 'Create share link' }).click();
    await expect(page.getByText(/shown this once/)).toBeVisible();
    const sharedUrl = await page.locator('code').innerText();
    expect(sharedUrl).toContain('/shared/');

    // A recipient — no session at all — reads the report and nothing else.
    const guest = await browser.newContext();
    const guestPage = await guest.newPage();
    await guestPage.goto(sharedUrl);
    await expect(guestPage.getByText('Shared with you.')).toBeVisible();
    await expect(
      guestPage.getByRole('navigation', { name: 'Report workspace' }),
    ).toHaveCount(0);
    // And the owner's report URL itself opens nothing for them.
    const direct = await guestPage.goto(reportUrl);
    expect([404, 200]).toContain(direct?.status() ?? 0);
    await expect(
      guestPage.getByRole('navigation', { name: 'Report workspace' }),
    ).toHaveCount(0);

    // Revoke, and the door closes.
    await page.getByRole('button', { name: 'Revoke' }).first().click();
    await expect(page.getByText('Revoked', { exact: true })).toBeVisible();
    await guestPage.goto(sharedUrl);
    await expect(guestPage.getByText(/no longer opens anything/)).toBeVisible();
    await guest.close();

    /* ── The desk reflects all of it ────────────────────────────────────── */
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Your working desk' })).toBeVisible();
    await expect(page.getByText('Ardmore Sea Salt').first()).toBeVisible();

    // The new-report page passes axe with everything on it.
    await page.goto(reportUrl);
    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
