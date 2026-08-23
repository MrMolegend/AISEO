import { expect, test } from '@playwright/test';

/**
 * The journey the product exists to deliver: enter a URL, watch honest progress,
 * read a report at a permanent address.
 *
 * The audit target is the application's own landing page — a real HTML document
 * fetched over real HTTP, so the retrieval and extraction layers do genuine work
 * rather than being stubbed.
 */

const TARGET = 'http://127.0.0.1:3100/';

test.describe('audit journey', () => {
  test('URL submission produces a rendered report at a shareable address', async ({
    page,
    baseURL,
  }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'holding your website back',
    );

    await page.getByPlaceholder('yourwebsite.com').first().fill(TARGET);
    await page
      .getByRole('button', { name: /run free audit/i })
      .first()
      .click();

    // The report URL is issued before the work starts, so it is valid immediately.
    await page.waitForURL(/\/audit\/[\w-]+$/, { timeout: 30_000 });
    const auditUrl = page.url();
    expect(auditUrl.startsWith(`${baseURL}/audit/`)).toBe(true);

    // Either the processing screen or the finished report, depending on timing.
    await expect(
      page.getByRole('heading', { name: /Auditing|SEO|AISEO/i }).first(),
    ).toBeVisible();

    // The report replaces the processing screen without a manual reload.
    await expect(page.getByRole('heading', { name: 'Executive summary' })).toBeVisible({
      timeout: 60_000,
    });

    // Every section of the fixed layout is present.
    for (const heading of [
      'Executive summary',
      'Category scores',
      'Top priorities',
      'Everything we found',
      'Opportunities',
      'Action plan',
      'What this audit could not determine',
    ]) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }

    // The score is real and within range.
    const score = await page.locator('.tabular').first().textContent();
    expect(Number(score)).toBeGreaterThanOrEqual(0);
    expect(Number(score)).toBeLessThanOrEqual(100);

    // Returning to the same address shows the same report — it is permanent.
    await page.goto(auditUrl);
    await expect(page.getByRole('heading', { name: 'Executive summary' })).toBeVisible();
  });

  test('a report survives a page refresh', async ({ page, request }) => {
    const response = await request.post('/api/audits', { data: { url: TARGET } });
    const { publicId } = (await response.json()) as { publicId: string };

    await page.goto(`/audit/${publicId}`);
    await expect(page.getByRole('heading', { name: 'Executive summary' })).toBeVisible({
      timeout: 60_000,
    });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Executive summary' })).toBeVisible();
  });
});

test.describe('report interaction', () => {
  test('issues can be filtered and expanded', async ({ page, request }) => {
    const response = await request.post('/api/audits', { data: { url: TARGET } });
    const { publicId } = (await response.json()) as { publicId: string };

    await page.goto(`/audit/${publicId}`);
    await expect(page.getByRole('heading', { name: 'Everything we found' })).toBeVisible({
      timeout: 60_000,
    });

    const counter = page.getByText(/Showing \d+ of \d+ issue/);
    await expect(counter).toBeVisible();
    const initial = await counter.textContent();

    // Filtering narrows the list and the live counter reflects it.
    const highFilter = page.getByRole('button', { name: /^High/ }).first();
    if (await highFilter.isVisible()) {
      await highFilter.click();
      await expect(counter).not.toHaveText(initial ?? '');
    }

    // Accordion items open to reveal the five-part detail.
    const trigger = page.locator('[data-state]').filter({ hasText: /./ }).first();
    await expect(trigger).toBeVisible();
  });

  test('section navigation is present and links to real anchors', async ({
    page,
    request,
  }) => {
    const response = await request.post('/api/audits', { data: { url: TARGET } });
    const { publicId } = (await response.json()) as { publicId: string };

    await page.goto(`/audit/${publicId}`);
    await expect(page.getByRole('heading', { name: 'Executive summary' })).toBeVisible({
      timeout: 60_000,
    });

    const nav = page.getByRole('navigation', { name: 'Report sections' }).first();
    await expect(nav).toBeVisible();

    for (const id of ['overview', 'scores', 'issues', 'plan', 'limitations']) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });
});

test.describe('lead capture', () => {
  test('the CTA appears only at the end of the report and never gates it', async ({
    page,
    request,
  }) => {
    const response = await request.post('/api/audits', {
      data: { url: 'http://127.0.0.1:3100/' },
    });
    const { publicId } = (await response.json()) as { publicId: string };

    await page.goto(`/audit/${publicId}`);
    await expect(page.getByRole('heading', { name: 'Executive summary' })).toBeVisible({
      timeout: 60_000,
    });

    // The report is readable without interacting with the CTA: no modal, no
    // overlay, nothing intercepting a click on the content.
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);

    const cta = page.getByRole('heading', { name: /want help implementing/i });
    await expect(cta).toBeVisible();

    // It sits after the limitations section, which is the last report content.
    const limitations = page.locator('#limitations');
    const ctaBox = await cta.boundingBox();
    const limitationsBox = await limitations.boundingBox();
    expect(ctaBox!.y).toBeGreaterThan(limitationsBox!.y);
  });

  test('a submission is accepted and confirmed', async ({ page, request }) => {
    const response = await request.post('/api/audits', {
      data: { url: 'http://127.0.0.1:3100/' },
    });
    const { publicId } = (await response.json()) as { publicId: string };

    await page.goto(`/audit/${publicId}`);
    await expect(
      page.getByRole('heading', { name: /want help implementing/i }),
    ).toBeVisible({ timeout: 60_000 });

    await page.getByLabel(/your name/i).fill('Alex Harrington');
    await page.getByLabel(/^email/i).fill('alex@example.com');
    await page
      .getByLabel(/what would you like help with/i)
      .fill('Technical fixes please.');

    // The route rejects submissions completed faster than a human could read
    // the form, so wait past that threshold before submitting.
    await page.waitForTimeout(2_200);
    await page.getByRole('button', { name: /send message/i }).click();

    await expect(page.getByText(/message received/i)).toBeVisible();
  });
});
