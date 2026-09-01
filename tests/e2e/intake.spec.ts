import { expect, test, type Page, type BrowserContext } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * The four-stage intake, in a browser.
 *
 * Everything about this form is a promise the server cannot keep on its own.
 * The server can refuse a bad brief; only the browser can tell you whether a
 * person could actually get through four stages on a phone, whether going back
 * loses what they typed, and whether the competitor chip input behaves like an
 * input or like a puzzle.
 *
 * The first test is the one that matters most, and it is an absence: this form
 * must never ask for a website. That is a product promise, and the schema test
 * guards the data model — this guards the screen.
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

/**
 * Picks an option from a searchable combobox.
 *
 * Typing then clicking, rather than selecting a value directly, because that is
 * what a person does and it is the path that can break.
 */
async function chooseFrom(page: Page, label: string, query: string, option: RegExp) {
  const combobox = page.getByRole('combobox', { name: label });
  await combobox.click();
  await combobox.pressSequentially(query);
  await page.getByRole('option', { name: option }).first().click();
  // The list closes on commit, and the field then shows the chosen label.
  await expect(combobox).toHaveValue(option);
}

/**
 * Chooses a radio card by clicking its label.
 *
 * The input itself is `sr-only` — a 1px box under a full-size label — so a
 * pointer never lands on it and `.check()` waits forever for one that will not
 * arrive. Clicking the label is both what a person does and what works.
 */
async function chooseCard(page: Page, label: string) {
  await page
    .locator('label')
    .filter({ hasText: new RegExp(`^${label}`) })
    .first()
    .click();
}

/** Fills stage 1 with a valid offer and moves on. */
async function completeOffer(page: Page) {
  await page.getByLabel('Business or brand name').fill('Ardmore Sea Salt');
  await page.getByLabel('Product or service name').fill('Hand-harvested flake salt');
  await page
    .getByLabel('What are you selling?')
    .fill(
      'Hand-harvested flake sea salt in 100g and 250g retail tins, plus a 5kg catering pouch for hotel kitchens.',
    );
  await page.getByLabel('Product or service category').fill('Speciality food');
  await chooseFrom(page, 'Where you operate from', 'Ireland', /^Ireland/);
  await chooseCard(page, 'Currently trading');
  await page.getByRole('button', { name: 'Continue' }).click();
}

/** Fills stage 2 and moves on. */
async function completeTarget(page: Page) {
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
    .fill(
      'Two hotel groups there have asked us about supply and we do not know whether it is real.',
    );
  await page.getByRole('button', { name: 'Continue' }).click();
}

/** Fills stage 3 and moves on. Stage 3 has no required fields. */
async function completeCommercial(page: Page) {
  await page.getByRole('button', { name: 'Continue' }).click();
}

/** Fills stage 4 and reaches the review. */
async function completeObjectives(page: Page) {
  await page
    .getByLabel('What decision are you trying to make?')
    .fill('Whether to appoint a distributor this year or wait another season.');
  await page
    .getByLabel('What worries you most about it?')
    .fill('Committing to registration costs we cannot recover if it does not work.');
  await page
    .getByLabel('The one question you most want answered')
    .fill('Can a producer of our size get listed without a local entity?');
  await page.getByRole('button', { name: 'Review' }).click();
}

/** Advances one stage, whichever stage that is. */
const STEPS = [completeOffer, completeTarget, completeCommercial, completeObjectives];

test.describe('the intake never asks for a website', () => {
  test('has no website, URL or domain field on any stage', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    await page.goto('/assess');

    for (let stage = 0; stage < 4; stage += 1) {
      const labels = await page.locator('label, legend').allInnerTexts();
      for (const label of labels) {
        expect(label, `stage ${stage + 1} asks for "${label}"`).not.toMatch(
          /website|url|domain|homepage|web address/i,
        );
      }

      const urlInputs = await page.locator('input[type="url"]').count();
      expect(urlInputs, `stage ${stage + 1} has a url input`).toBe(0);

      await STEPS[stage]!(page);
    }
  });
});

test.describe('moving through the stages', () => {
  test.beforeEach(async ({ context, baseURL, page }) => {
    await signIn(context, baseURL!);
    await page.goto('/assess');
  });

  test('will not advance past an incomplete stage, and says which answers', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Continue' }).click();

    // The summary, not the per-field messages beneath it — and not Next's own
    // route announcer, which is a live region on every page.
    const summary = page.getByRole('alert').first();
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(/needs another look|need another look/);

    // Still on stage one — the count is the honest signal.
    await expect(page.getByText('Stage 1 of 4')).toBeVisible();
  });

  test('keeps what you typed when you go back to check something', async ({ page }) => {
    await completeOffer(page);
    await expect(page.getByText('Stage 2 of 4')).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();

    await expect(page.getByLabel('Business or brand name')).toHaveValue(
      'Ardmore Sea Salt',
    );
    await expect(page.getByLabel('Product or service category')).toHaveValue(
      'Speciality food',
    );
  });

  test('does not validate on the way back', async ({ page }) => {
    // Going back to look at what you wrote is not a submission. Validating it
    // greets someone with errors for fields they have not reached yet.
    await completeOffer(page);
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('main [role="alert"]')).toHaveCount(0);
  });

  test('restores a draft after the page is closed and reopened', async ({ page }) => {
    await page.getByLabel('Business or brand name').fill('Ardmore Sea Salt');
    await page.getByLabel('Product or service name').blur();

    // The draft is server-backed now: wait for the autosave to land, so the
    // reload reads the durable copy rather than racing the debounce.
    await expect(page.locator('[data-save-state="saved"]')).toBeVisible({
      timeout: 10_000,
    });

    await page.reload();

    await expect(page.getByLabel('Business or brand name')).toHaveValue(
      'Ardmore Sea Salt',
    );
    await expect(
      page.getByRole('status').filter({ hasText: /saved draft|restored/ }),
    ).toBeVisible();
  });

  test('announces every autosave state in words, not colour', async ({ page }) => {
    // Nothing typed yet: an untouched form must not create a draft or claim
    // to have saved one.
    await expect(page.locator('[data-save-state]')).toHaveCount(0);

    await page.getByLabel('Business or brand name').fill('Ardmore');
    await expect(page.locator('[data-save-state="saved"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-save-state="saved"]')).toHaveText('Saved');
  });

  test('moves focus to the new stage heading, so a screen reader follows', async ({
    page,
  }) => {
    await completeOffer(page);
    const heading = page.getByRole('heading', { name: 'Where you want to go' });
    await expect(heading).toBeFocused();
  });
});

test.describe('the competitor chip input', () => {
  test.beforeEach(async ({ context, baseURL, page }) => {
    await signIn(context, baseURL!);
    await page.goto('/assess');
    await completeOffer(page);
    await completeTarget(page);
    await completeCommercial(page);
  });

  const LABEL = 'Competitors or alternatives you already know of';
  const field = (page: Page) => page.getByRole('textbox', { name: LABEL });
  /* Scoped to the chip list: the stage rail and the footer are lists too. */
  const chips = (page: Page) =>
    page.getByRole('list', { name: 'Added so far' }).getByRole('listitem');

  test('lets a name contain spaces', async ({ page }) => {
    // The bug this exists for: committing on space turns "Maldon Salt" into two
    // competitors called "Maldon" and "Salt", and the customer cannot fix it.
    await field(page).fill('Maldon Salt');
    await field(page).press('Enter');

    await expect(chips(page).filter({ hasText: 'Maldon Salt' })).toBeVisible();
  });

  test('commits on Enter and on a comma', async ({ page }) => {
    await field(page).fill('Halen Môn');
    await field(page).press('Enter');
    await field(page).type('Cornish Sea Salt,');

    await expect(chips(page)).toHaveCount(2);
  });

  test('commits an unfinished name when focus leaves', async ({ page }) => {
    // Typing a name and tabbing on is not a mistake to be punished by silently
    // discarding it.
    await field(page).fill('Fleur de Sel de Guérande');
    await field(page).blur();

    await expect(
      chips(page).filter({ hasText: 'Fleur de Sel de Guérande' }),
    ).toBeVisible();
  });

  test('splits a pasted list on commas and newlines', async ({ page }) => {
    /*
     * A real paste event, not `fill`.
     *
     * A text input silently drops newlines from a programmatic value, so
     * `fill` with a multi-line string tests the wrong thing entirely — it
     * arrives as one run-on line and would pass or fail for reasons unrelated
     * to paste handling. Someone copying three names out of a spreadsheet
     * fires a `paste` event, so that is what this fires.
     */
    await field(page).focus();
    await field(page).evaluate((input) => {
      const data = new DataTransfer();
      data.setData('text/plain', 'Maldon Salt, Halen Môn\nCornish Sea Salt');
      input.dispatchEvent(
        new ClipboardEvent('paste', {
          clipboardData: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await expect(chips(page)).toHaveCount(3);
  });

  test('ignores a name already added, whatever its case', async ({ page }) => {
    await field(page).fill('Maldon Salt');
    await field(page).press('Enter');
    await field(page).fill('maldon salt');
    await field(page).press('Enter');

    await expect(chips(page)).toHaveCount(1);
  });

  test('removes a name with the keyboard alone', async ({ page }) => {
    await field(page).fill('Maldon Salt');
    await field(page).press('Enter');

    const remove = page.getByRole('button', { name: /Remove Maldon Salt/i });
    await expect(remove).toBeVisible();
    await remove.press('Enter');

    await expect(chips(page)).toHaveCount(0);
  });

  test('removes the last name with Backspace on an empty field', async ({ page }) => {
    await field(page).fill('Maldon Salt');
    await field(page).press('Enter');
    await field(page).press('Backspace');

    await expect(chips(page)).toHaveCount(0);
  });
});

test.describe('the country and currency selectors', () => {
  test.beforeEach(async ({ context, baseURL, page }) => {
    await signIn(context, baseURL!);
    await page.goto('/assess');
    await completeOffer(page);
  });

  test('are searchable rather than a list of two hundred options', async ({ page }) => {
    const combobox = page.getByRole('combobox', {
      name: 'Which market do you want to enter?',
    });
    await combobox.fill('emirat');
    await expect(
      page.getByRole('option', { name: /United Arab Emirates/ }),
    ).toBeVisible();
  });

  test('can be driven entirely from the keyboard', async ({ page }) => {
    const combobox = page.getByRole('combobox', {
      name: 'Which market do you want to enter?',
    });
    await combobox.focus();
    await combobox.type('Ireland');
    await combobox.press('ArrowDown');
    await combobox.press('Enter');

    await expect(combobox).toHaveValue(/Ireland/);
  });

  test('announce their results to a screen reader', async ({ page }) => {
    const combobox = page.getByRole('combobox', {
      name: 'Which market do you want to enter?',
    });
    await combobox.fill('emirat');

    await expect(combobox).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('listbox')).toBeVisible();
  });
});

test.describe('the review stage', () => {
  test('shows the brief back and says one credit will be reserved', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    await page.goto('/assess');
    await completeOffer(page);
    await completeTarget(page);
    await completeCommercial(page);
    await completeObjectives(page);

    await expect(page.getByRole('heading', { name: 'Before we start' })).toBeVisible();
    await expect(page.getByText('Ardmore Sea Salt')).toBeVisible();

    const body = await page.locator('main').innerText();
    expect(body).toMatch(/one report credit/i);
    // The internal figure never reaches the page.
    expect(body).not.toMatch(/\b100 tokens\b/i);
    expect(body).not.toMatch(/tokens?\b/i);
  });

  test('can send you back to a stage to change one answer', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, baseURL!);
    await page.goto('/assess');
    await completeOffer(page);
    await completeTarget(page);
    await completeCommercial(page);
    await completeObjectives(page);

    await page.getByRole('button', { name: /Edit What you sell/ }).click();
    await expect(page.getByLabel('Business or brand name')).toHaveValue(
      'Ardmore Sea Salt',
    );
  });
});

test.describe('accessibility', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`the intake has no violations (${scheme})`, async ({
      page,
      context,
      baseURL,
    }) => {
      await signIn(context, baseURL!);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/assess');

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

      expect(violations, violations.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual(
        [],
      );
    });
  }

  test('fits a 320px phone without sideways scrolling, on every stage', async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await signIn(context, baseURL!);
    await page.goto('/assess');

    for (let stage = 0; stage < 4; stage += 1) {
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth ? doc.scrollWidth : null;
      });
      expect(overflow, `stage ${stage + 1} overflows`).toBeNull();

      await STEPS[stage]!(page);
    }
  });
});
