import { expect, test, type Page } from '@playwright/test';

/**
 * The workflows the product is judged on, end to end, in a real browser.
 *
 * Each one starts from a clean localStorage so the demo data is the seed set,
 * and asserts on what a person would actually look for on the screen.
 */

async function signInAs(page: Page, role: 'student' | 'tutor' | 'parent' | 'admin') {
  await page.goto('/sign-in');
  await page
    .getByRole('button', { name: new RegExp(`Continue as ${role}`, 'i') })
    .click();
  await page.waitForURL(new RegExp(`/(student|tutor|parent|admin)`));
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('the homepage search takes you to a filtered marketplace', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: /Find the right tutor/i }),
  ).toBeVisible();

  await page.getByLabel('Subject', { exact: true }).selectOption('physics');
  await page.getByRole('button', { name: 'Search tutors' }).click();

  await page.waitForURL(/\/tutors\?/);
  await expect(page).toHaveURL(/subject=physics/);
  // The chip row echoes the filter that came in from the homepage.
  await expect(page.getByRole('button', { name: 'Physics' })).toBeVisible();
});

test('marketplace filters and sorting change the results', async ({ page }) => {
  await page.goto('/tutors');
  const count = page.getByRole('status').filter({ hasText: /tutors?$/ });
  await expect(count).toHaveText('12 tutors');

  await page.getByLabel('Minimum rating').selectOption('4.8');
  await expect(count).not.toHaveText('12 tutors');

  await page.getByRole('button', { name: '4.8+ rating' }).click();
  await expect(count).toHaveText('12 tutors');

  await page.getByLabel('Sort results').selectOption('price-asc');
  await expect(page.getByRole('article').first()).toContainText('£22');
});

test('a favourite persists across a reload and reaches the saved list', async ({
  page,
}) => {
  await signInAs(page, 'student');
  await page.goto('/tutors');

  const card = page.getByRole('article').filter({ hasText: 'Tom Whitfield' }).first();
  await card.getByRole('button', { name: /Save Tom Whitfield/i }).click();

  await page.reload();
  await expect(
    page
      .getByRole('article')
      .filter({ hasText: 'Tom Whitfield' })
      .first()
      .getByRole('button', { name: /Remove Tom Whitfield/i }),
  ).toBeVisible();

  await page.goto('/student/saved');
  await expect(page.getByRole('heading', { name: 'Tom Whitfield' })).toBeVisible();
});

test('booking a lesson creates a record that reaches the dashboard', async ({ page }) => {
  await signInAs(page, 'student');
  await page.goto('/tutors/amara-okonkwo');
  await page.getByRole('link', { name: 'Book a lesson' }).click();

  await page.waitForURL(/\/book\/amara-okonkwo/);
  await page.getByRole('button', { name: 'Continue' }).click();

  // Step two: pick the first free time on the first day that has one.
  await page
    .getByRole('button', { name: /^\d{2}:\d{2}$/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText(/Demonstration checkout/i)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm demo booking' }).click();

  await page.waitForURL(/\/booking\/confirmed/);
  await expect(page.getByRole('heading', { name: 'Lesson booked' })).toBeVisible();

  await page.getByRole('link', { name: 'Go to dashboard' }).click();
  await page.waitForURL(/\/student/);
  await expect(page.getByText('Upcoming lessons').first()).toBeVisible();
});

test('sending a message adds it to the thread and survives a reload', async ({
  page,
}) => {
  await signInAs(page, 'student');
  await page.goto('/messages/c-maya-amara');

  const body = 'Could we look at question 8 as well?';
  await page.getByLabel('Write a message').fill(body);
  await page.getByRole('button', { name: 'Send message' }).click();

  // The same text appears in the conversation list preview, so scope the
  // assertion to the thread itself.
  const bubble = page.getByRole('listitem').filter({ hasText: body }).last();
  await expect(bubble).toBeVisible();

  await page.reload();
  await expect(page.getByRole('listitem').filter({ hasText: body }).last()).toBeVisible();
});

test('a tutor application reaches the admin queue and can be approved', async ({
  page,
}) => {
  await page.goto('/become-a-tutor#application');

  await page.getByLabel('First name').fill('Rosa');
  await page.getByLabel('Last name').fill('Whitaker');
  await page.getByLabel('Email address').fill('rosa.whitaker@example.com');
  await page.getByLabel('Phone number').fill('07700 900321');
  await page.getByLabel('Where are you based?').fill('York');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Physics', exact: true }).click();
  await page.getByRole('button', { name: 'A-Level', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Years of teaching or tutoring').fill('7');
  await page
    .getByLabel('Tell us about your experience')
    .fill(
      'Seven years teaching A-Level Physics at a sixth-form college in York, mostly OCR A, plus two years running the Physics Olympiad group.',
    );
  await page.getByRole('button', { name: 'Continue' }).click();

  await page
    .getByLabel('Your qualifications')
    .fill('MPhys Physics, University of York (2016). PGCE Secondary Science (2017).');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page
    .getByLabel('Profile headline')
    .fill('A-Level Physics, taught from first principles');
  await page
    .getByLabel('Your teaching approach')
    .fill(
      'We sketch every problem before touching an equation, then work through past-paper questions with me staying quiet.',
    );
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Typical availability').fill('Weekday evenings after 17:00.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByRole('heading', { name: 'Application received' })).toBeVisible();
  await expect(page.getByText('Status: under review')).toBeVisible();

  await page.getByRole('link', { name: 'See it in the admin queue' }).click();
  await page.waitForURL(/\/admin\/applications/);
  await page.getByRole('button', { name: /Continue as administrator/i }).click();

  const row = page.getByRole('listitem').filter({ hasText: 'Rosa Whitaker' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Review' }).click();
  await page.getByRole('button', { name: 'Approve' }).click();

  await expect(row.getByText('Approved')).toBeVisible();
});

test('an admin suspension removes a tutor from the public marketplace', async ({
  page,
}) => {
  await signInAs(page, 'admin');
  await page.goto('/admin/tutors');

  const row = page.getByRole('listitem').filter({ hasText: 'Rhian Davies' });
  await row.getByRole('switch', { name: 'Active' }).click();

  await page.goto('/tutors');
  await expect(page.getByText('11 tutors')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rhian Davies' })).toHaveCount(0);
});

test('the lesson room runs from device check to summary', async ({ page }) => {
  await signInAs(page, 'student');
  await page.goto('/lesson/b-1001');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mathematics');
  await page.getByRole('button', { name: 'Join lesson' }).click();

  await expect(page.getByRole('button', { name: 'Mute microphone' })).toBeVisible();
  await page.getByRole('button', { name: 'Mute microphone' }).click();
  await expect(page.getByRole('button', { name: 'Unmute microphone' })).toBeVisible();

  await page.getByRole('button', { name: 'Shared notes' }).click();
  await expect(page.getByLabel('Shared lesson notes')).toBeVisible();

  await page.getByRole('button', { name: 'Leave lesson' }).click();
  await expect(page.getByRole('heading', { name: 'Lesson ended' })).toBeVisible();
});

test('the theme toggle switches the interface and is remembered', async ({ page }) => {
  await signInAs(page, 'student');
  await page.goto('/student/settings');

  await page
    .getByRole('group', { name: 'Colour theme' })
    .getByRole('button', { name: 'Dark' })
    .click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
});
