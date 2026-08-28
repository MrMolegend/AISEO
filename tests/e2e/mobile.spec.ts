import { expect, test } from '@playwright/test';

/**
 * Mobile is a different layout rather than a narrower desktop, so it gets its
 * own journeys: the drawer menu, the filter sheet, the sticky booking bar and
 * the dashboard's bottom navigation.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('the drawer menu opens, navigates and closes behind you', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();

  const menu = page.getByRole('dialog', { name: 'Menu' });
  await expect(menu).toBeVisible();

  await menu.getByRole('link', { name: 'How it works' }).click();
  await page.waitForURL(/\/how-it-works/);
  await expect(page.getByRole('dialog', { name: 'Menu' })).toHaveCount(0);
});

test('the drawer menu closes on Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Menu' })).toHaveCount(0);
});

test('the filter sheet applies a filter and reports the count', async ({ page }) => {
  await page.goto('/tutors');
  const count = page.getByRole('status').filter({ hasText: /tutors?$/ });
  await expect(count).toHaveText('12 tutors');

  await page.getByRole('button', { name: /^Filters/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Filters' });
  await expect(sheet).toBeVisible();

  await sheet.getByRole('button', { name: 'GCSE' }).click();
  await sheet.getByRole('button', { name: /^Show \d+ tutors?$/ }).click();

  await expect(page.getByRole('dialog', { name: 'Filters' })).toHaveCount(0);
  await expect(count).not.toHaveText('12 tutors');
  await expect(page.getByRole('button', { name: 'GCSE' })).toBeVisible();
});

test('the profile keeps a booking bar within reach', async ({ page }) => {
  await page.goto('/tutors/priya-raghavan');

  const bar = page.getByRole('link', { name: 'Book lesson' });
  await expect(bar).toBeInViewport();

  await bar.click();
  await page.waitForURL(/\/book\/priya-raghavan/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Priya');
});

test('the dashboard uses bottom navigation rather than a sidebar', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: /Continue as student/i }).click();
  await page.waitForURL(/\/student/);

  const bottomNav = page.getByRole('navigation', { name: 'Student sections' });
  await expect(bottomNav).toBeVisible();

  await bottomNav.getByRole('link', { name: 'Lessons' }).click();
  await page.waitForURL(/\/student\/lessons/);
  await expect(page.getByRole('heading', { name: 'Your lessons' })).toBeVisible();

  await page.getByRole('button', { name: 'More' }).click();
  await page
    .getByRole('dialog', { name: 'More' })
    .getByRole('link', { name: 'Settings' })
    .click();
  await page.waitForURL(/\/student\/settings/);
});
