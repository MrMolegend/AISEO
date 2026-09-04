import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * The growth journey, end to end in a browser on the fixture world:
 * profile → campaign → cost preview → confirmed run → discovered accounts
 * → evidence → relationship attestation → score decomposition → pipeline
 * → playbook tasks → grounded outreach with human approval → the meeting
 * brief → a watchlist check.
 *
 * One long test on purpose: everything after the run only exists
 * downstream of a completed discovery, and the fixture run costs seconds.
 * The assertions along the way are the product's honesty rules as a
 * reader would meet them — deduplicated accounts, sourced evidence,
 * "not verified" kept distinct from a gap, and nothing that sends.
 */

const MANAGER = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'manager@example.com',
  role: 'sales_manager' as const,
};

async function signIn(
  context: BrowserContext,
  baseURL: string,
  session: object = MANAGER,
) {
  await context.addCookies([
    {
      name: 'e2e-test-session',
      value: encodeURIComponent(JSON.stringify(session)),
      url: baseURL,
    },
  ]);
}

async function createIcp(page: Page, name: string) {
  await page.goto('/icps/new');
  await page.getByLabel('Profile name').fill(name);
  await page
    .getByRole('group', { name: 'Territories' })
    .getByText('United Arab Emirates', { exact: true })
    .click();
  await page
    .getByRole('group', { name: 'Customer segments' })
    .getByText('Independent pet retailers')
    .click();
  // Minimal evidence, so the small fixture world clears the gate.
  await page.getByText(/Minimal — one credible/).click();
  await page.getByRole('button', { name: 'Create profile' }).click();
  await expect(page).toHaveURL(/\/icps$/);
}

test.describe('the growth journey', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!);
  });

  test('from profile to approved outreach, honestly at every step', async ({ page }) => {
    test.setTimeout(180_000);

    // ── An ideal customer profile ────────────────────────────────────────
    await createIcp(page, 'UAE independents (journey)');

    // ── A campaign, previewed before it can spend ───────────────────────
    await page.goto('/campaigns/new');
    await page.getByLabel('Campaign name').fill('Dubai independents — journey');
    await page
      .getByLabel('Product or brand objective')
      .fill('Premium dog and cat nutrition placement across Dubai independents.');
    await expect(page.getByText('Nothing spends until you confirm')).toBeVisible();
    await page.getByRole('button', { name: /Create campaign/ }).click();
    await expect(page).toHaveURL(/\/campaigns\/[0-9a-f-]+$/);

    // The preview states the ceiling in units, and confirming is explicit.
    await expect(page.getByText(/units/).first()).toBeVisible();
    const confirm = page.getByRole('button', { name: /Confirm and spend up to/ });
    await expect(confirm).toBeEnabled();
    await confirm.click();

    // The fixture run settles in seconds; the console polls and refreshes.
    await expect(page.getByText(/Last run — Completed/).first()).toBeVisible({
      timeout: 90_000,
    });

    // ── The discovered accounts, deduplicated ───────────────────────────
    await page.goto('/leads');
    const petOasisLinks = page.getByRole('link', { name: /Pet Oasis/ });
    // The fixture world offers Pet Oasis under two legal suffixes; caution
    // merges them into one account, not two rows.
    await expect(petOasisLinks.first()).toBeVisible();
    await expect(petOasisLinks).toHaveCount(1);
    // The listicle headline never became a company.
    await expect(page.getByText(/10 best pet shops/i)).toHaveCount(0);

    await petOasisLinks.first().click();
    await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+$/);

    // ── Evidence carries its sources ────────────────────────────────────
    await expect(page.getByText('Evidence', { exact: true })).toBeVisible();
    // Every claim names where it came from, how it was retrieved, and when.
    await expect(page.getByText(/Indexed snippet|Read directly/).first()).toBeVisible();
    await expect(page.getByText(/Retrieved \d{4}-\d{2}-\d{2}/).first()).toBeVisible();

    // ── A decision-maker, and an attestation with provenance ────────────
    await expect(page.getByText('Do you know this person?').first()).toBeVisible();
    await page.getByRole('button', { name: 'Indirectly' }).first().click();
    await expect(
      page.getByText(/knows them indirectly and has said so/).first(),
    ).toBeVisible();
    // An indirect acquaintance is never dressed up as verified.
    await expect(page.getByText('Verified direct connection')).toHaveCount(0);

    // ── The score, decomposed ───────────────────────────────────────────
    // Discovery already scored the account during quality review; the
    // decomposition is on the page before anyone presses anything, and the
    // arithmetic shows its working dimension by dimension.
    await expect(page.getByText('Computed score')).toBeVisible();
    await expect(page.getByText(/× weight/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recompute' })).toBeVisible();

    // ── Pipeline movement, with the note kept ───────────────────────────
    await page.getByLabel('Pipeline stage').selectOption('contacted');
    await page.getByLabel('Why this move').fill('First call made from the journey.');
    await page.getByRole('button', { name: 'Move', exact: true }).click();
    await expect(page.getByText(/Currently:\s*Contacted/)).toBeVisible();

    // ── A playbook becomes tasks, idempotently — never messages ─────────
    await page.getByLabel('Playbook').selectOption('cold_researched');
    await page.getByRole('button', { name: 'Apply as tasks' }).click();
    await expect(page.getByText(/3 tasks created/)).toBeVisible();
    await page.getByRole('button', { name: 'Apply as tasks' }).click();
    await expect(page.getByText(/3 already existed/)).toBeVisible();

    await page.goto('/tasks');
    await expect(
      page.getByText('Send the approved first-touch message').first(),
    ).toBeVisible();

    // ── Outreach: drafted, linted, approved by a person, copied by hand ─
    await page.goto('/leads');
    await page
      .getByRole('link', { name: /Pet Oasis/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Draft outreach' }).first().click();
    await expect(page).toHaveURL(/\/outreach$/);
    await page
      .getByRole('link', {
        name: /Warm-introduction request|LinkedIn connection note|Short email/,
      })
      .first()
      .click();
    await expect(page).toHaveURL(/\/outreach\/[0-9a-f-]+$/);

    await page.getByLabel(/I have reviewed this draft/).check();
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(page.getByText('Approved — nothing sends automatically')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Copy to send by hand' }),
    ).toBeVisible();

    // ── The meeting brief, assembled from stored records ────────────────
    await page.goto('/leads');
    await page
      .getByRole('link', { name: /Pet Oasis/ })
      .first()
      .click();
    await page.getByRole('link', { name: /Meeting brief/ }).click();
    await expect(page).toHaveURL(/\/brief$/);
    await expect(page.getByText('About Arab Land Trading')).toBeVisible();
    await expect(page.getByText(/build specification, 2026-09-03/).first()).toBeVisible();
  });

  test('a watchlist check is bounded, sourced and honest about skips', async ({
    page,
  }) => {
    // The journey test has run discovery, so Pet Oasis exists; watch it.
    await page.goto('/leads');
    await page
      .getByRole('link', { name: /Pet Oasis/ })
      .first()
      .click();
    await page.getByRole('button', { name: 'Watch this account' }).click();
    await expect(page.getByText(/Watching\./)).toBeVisible();

    await page.goto('/watchlists');
    await page.getByRole('button', { name: 'Check now' }).first().click();
    // The fixture answers with one result that never names the subject, and
    // the outcome says so instead of hiding it.
    await expect(page.getByText(/skipped for not naming the subject/)).toBeVisible();
    await expect(page.getByText(/observed on .*\.example/).first()).toBeVisible();
  });

  test('territories and intelligence render real numbers with their caveats', async ({
    page,
  }) => {
    await page.goto('/territories');
    await expect(
      page.getByRole('img', { name: /Schematic map of GCC markets/ }),
    ).toBeVisible();
    await expect(page.getByText('Schematic positions, not geography')).toBeVisible();

    await page.goto('/intelligence');
    // A handful of journey accounts is far below the sample floor: the page
    // must say so rather than chart a percentage.
    await expect(
      page.getByText(/Not enough data|No outcomes recorded/).first(),
    ).toBeVisible();
  });
});
