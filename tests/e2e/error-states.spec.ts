import { expect, test } from '@playwright/test';

/**
 * The failure paths.
 *
 * These matter more than the happy path: a product whose pitch is honesty cannot
 * respond to a broken site with a stack trace, and several of these failures are
 * genuinely useful findings in their own right.
 */

test.describe('input rejection', () => {
  test('an obviously invalid address is rejected inline, without a page change', async ({
    page,
  }) => {
    await page.goto('/');
    const input = page.getByPlaceholder('yourwebsite.com').first();

    await input.fill('not a url at all');
    await page
      .getByRole('button', { name: /run free audit/i })
      .first()
      .click();

    await expect(
      page.getByText(/valid website address|public website address/i),
    ).toBeVisible();
    // Validation happens client-side, so the URL must not change.
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('an empty submission is rejected', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('button', { name: /run free audit/i })
      .first()
      .click();
    await expect(page.getByText(/enter a website address/i)).toBeVisible();
  });

  test('the error clears when the user edits the field', async ({ page }) => {
    await page.goto('/');
    const input = page.getByPlaceholder('yourwebsite.com').first();
    // Scoped to the live region: getByText would also match the sr-only label.
    const error = page.locator('[aria-live="polite"] p').first();

    await input.fill('nonsense');
    await page
      .getByRole('button', { name: /run free audit/i })
      .first()
      .click();
    await expect(error).toBeVisible();

    await input.fill('example.com');
    await expect(error).toHaveCount(0);
  });
});

test.describe('API-level rejection', () => {
  test('private and internal addresses are refused', async ({ request }) => {
    for (const url of [
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.1/',
      'http://192.168.1.1/',
      'http://[::1]/',
      'javascript:alert(1)',
    ]) {
      const response = await request.post('/api/audits', { data: { url } });
      expect(response.status(), `${url} should be refused`).toBeGreaterThanOrEqual(400);

      const body = (await response.json()) as { error?: { code?: string } };
      expect(['INVALID_URL', 'BLOCKED_URL']).toContain(body.error?.code);
    }
  });

  test('a malformed request body is rejected cleanly', async ({ request }) => {
    const response = await request.post('/api/audits', {
      headers: { 'content-type': 'application/json' },
      data: 'not json at all',
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('audit failure states', () => {
  test('a client-rendered shell fails with an honest, useful explanation', async ({
    page,
    request,
  }) => {
    // The landing page's own /icon route returns a PNG, not HTML — a realistic
    // way to reach a non-HTML failure through the real pipeline.
    const response = await request.post('/api/audits', {
      data: { url: 'http://127.0.0.1:3100/icon' },
    });
    const body = (await response.json()) as { publicId?: string; error?: unknown };

    if (body.publicId) {
      await page.goto(`/audit/${body.publicId}`);
      // Either a designed error state or a report — never a raw error.
      await expect(page.locator('body')).not.toContainText('Internal Server Error');
      await expect(page.locator('body')).not.toContainText('at Object.');
    }
  });

  test('an unknown audit id shows a designed not-found page', async ({ page }) => {
    await page.goto('/audit/doesnotexist99');
    await expect(page.getByText(/could not find that audit/i)).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });

  test('the status endpoint 404s for an unknown id rather than erroring', async ({
    request,
  }) => {
    const response = await request.get('/api/audits/doesnotexist99/status');
    expect(response.status()).toBe(404);
  });
});

test.describe('our own SEO', () => {
  test('the landing page carries correct metadata', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AISEO/);

    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', /SEO/);

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveCount(1);
  });

  test('real audits are excluded from search indexes', async ({ page, request }) => {
    const response = await request.post('/api/audits', {
      data: { url: 'http://127.0.0.1:3100/' },
    });
    const { publicId } = (await response.json()) as { publicId: string };

    await page.goto(`/audit/${publicId}`);
    // Publishing an automated critique of someone else's site under our domain
    // is a privacy problem, and thousands of generated pages is thin content.
    // Next emits separate robots tags (general and googlebot); all must say
    // noindex, so assert across every one rather than picking one.
    const robotsTags = page.locator('meta[name="robots"]');
    const count = await robotsTags.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(robotsTags.nth(i)).toHaveAttribute('content', /noindex/);
    }
  });

  test('robots.txt disallows the audit namespace', async ({ request }) => {
    const response = await request.get('/robots.txt');
    const text = await response.text();
    expect(text).toContain('/audit/');
    expect(text).toContain('Sitemap');
  });

  test('the sitemap lists the indexable pages only', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    const text = await response.text();
    expect(text).toContain('/sample');
    expect(text).not.toContain('/audit/');
  });
});
