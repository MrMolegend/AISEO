/**
 * Screenshot QA.
 *
 * Captures the views that need looking at, in both colour schemes and at both
 * widths, against a real production build. Committed rather than kept in a
 * scratch directory because "we looked at it" is a claim that should be
 * reproducible by whoever reads the pull request.
 *
 * Two details that are easy to get wrong and were:
 *
 *   It scrolls the whole page before capturing. Sections that reveal on scroll
 *   are authored visible and hidden only once an IntersectionObserver has
 *   claimed them, so a full-page capture of a page nobody scrolled shows them
 *   mid-reveal — which looks exactly like a rendering bug and is not one.
 *
 *   It fails loudly on a console error or a 404. A screenshot that looks fine
 *   while the page is quietly missing a font is worse than no screenshot.
 *
 * Usage: node scripts/shoot.mjs [baseUrl] [outDir]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3100';
const OUT = process.argv[3] ?? 'screenshots';
/** Optional substring filter, so one view can be re-checked without the set. */
const ONLY = process.argv[4] ?? '';

/* The environment ships Chromium 1194 while the installed Playwright expects a
   newer build, so point at the binary that is actually here. Proxying is off
   because the target is always loopback. */
const EXECUTABLE =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/** A workspace member (super_admin, so every surface including /admin renders). */
const SESSION = {
  name: 'e2e-test-session',
  value: encodeURIComponent(
    JSON.stringify({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'sam@example.com',
      role: 'super_admin',
    }),
  ),
  url: BASE,
};

/** A signed-in stranger, for the request-access holding page. */
const OUTSIDER_SESSION = {
  name: 'e2e-test-session',
  value: encodeURIComponent(
    JSON.stringify({
      id: '22222222-2222-4222-8222-222222222222',
      email: 'stranger@example.com',
    }),
  ),
  url: BASE,
};

/** width, height, and whether the whole scroll height is captured. */
const DESKTOP = { width: 1440, height: 1000 };
const MOBILE = { width: 390, height: 844 };
/** The narrowest width the product claims to support. */
const NARROW = { width: 320, height: 800 };

const VIEWS = [
  // The gateway and its edges.
  { id: 'gateway-desktop', path: '/', viewport: DESKTOP, full: true },
  { id: 'gateway-mobile', path: '/', viewport: MOBILE, full: true },
  { id: 'gateway-320', path: '/', viewport: NARROW, full: true },
  { id: 'sign-in', path: '/sign-in', viewport: DESKTOP },
  {
    id: 'request-access',
    path: '/request-access',
    viewport: DESKTOP,
    outsider: true,
    full: true,
  },

  // The member workspace, desktop.
  { id: 'dashboard', path: '/dashboard', viewport: DESKTOP, auth: true, full: true },
  { id: 'commercial', path: '/commercial', viewport: DESKTOP, auth: true, full: true },
  { id: 'icps', path: '/icps', viewport: DESKTOP, auth: true, full: true },
  { id: 'icp-new', path: '/icps/new', viewport: DESKTOP, auth: true, full: true },
  { id: 'campaigns', path: '/campaigns', viewport: DESKTOP, auth: true, full: true },
  { id: 'leads', path: '/leads', viewport: DESKTOP, auth: true, full: true },
  { id: 'pipeline', path: '/pipeline', viewport: DESKTOP, auth: true, full: true },
  { id: 'tasks', path: '/tasks', viewport: DESKTOP, auth: true, full: true },
  { id: 'outreach', path: '/outreach', viewport: DESKTOP, auth: true, full: true },
  {
    id: 'relationships',
    path: '/relationships',
    viewport: DESKTOP,
    auth: true,
    full: true,
  },
  { id: 'watchlists', path: '/watchlists', viewport: DESKTOP, auth: true, full: true },
  {
    id: 'territories',
    path: '/territories',
    viewport: DESKTOP,
    auth: true,
    full: true,
  },
  {
    id: 'intelligence',
    path: '/intelligence',
    viewport: DESKTOP,
    auth: true,
    full: true,
  },
  { id: 'imports', path: '/imports', viewport: DESKTOP, auth: true, full: true },
  { id: 'account', path: '/account', viewport: DESKTOP, auth: true, full: true },
  { id: 'admin', path: '/admin', viewport: DESKTOP, auth: true, full: true },

  // The same workspace on a phone and at the narrowest supported width.
  {
    id: 'dashboard-mobile',
    path: '/dashboard',
    viewport: MOBILE,
    auth: true,
    full: true,
  },
  { id: 'leads-mobile', path: '/leads', viewport: MOBILE, auth: true, full: true },
  { id: 'pipeline-mobile', path: '/pipeline', viewport: MOBILE, auth: true, full: true },
  {
    id: 'territories-mobile',
    path: '/territories',
    viewport: MOBILE,
    auth: true,
    full: true,
  },
  { id: 'leads-320', path: '/leads', viewport: NARROW, auth: true, full: true },
  { id: 'dashboard-320', path: '/dashboard', viewport: NARROW, auth: true, full: true },

  // Motion honesty: the busiest animated page, with the preference set.
  {
    id: 'territories-reduced-motion',
    path: '/territories',
    viewport: DESKTOP,
    auth: true,
    full: true,
    reducedMotion: 'reduce',
  },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  args: ['--no-proxy-server', '--no-sandbox'],
});

let problems = 0;

for (const scheme of ['dark', 'light']) {
  for (const view of VIEWS) {
    if (ONLY && !view.id.includes(ONLY)) continue;
    const context = await browser.newContext({
      viewport: view.viewport,
      /*
       * Retina only for the framed captures.
       *
       * A full-page shot of the dossier is already 42,000 CSS pixels tall, and
       * the print view is taller still because print opens all forty-three
       * source drawers. At 2× that is past what Chromium will encode: the
       * capture times out rather than failing, which reads as a hung script.
       * 1× is plenty to inspect layout, spacing and contrast by eye.
       */
      deviceScaleFactor: view.full ? 1 : 2,
      colorScheme: scheme,
      reducedMotion: view.reducedMotion ?? 'no-preference',
    });
    if (view.auth) await context.addCookies([SESSION]);
    if (view.outsider) await context.addCookies([OUTSIDER_SESSION]);

    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto(`${BASE}${view.path}`, { waitUntil: 'load', timeout: 45_000 });

    if (view.media) await page.emulateMedia({ media: view.media });

    /*
     * Hydration first, then scroll.
     *
     * Scrolling before the page has hydrated is worse than not scrolling at
     * all: a section that mounts after the scroll has passed it observes from a
     * standstill and stays hidden, which produces a screenshot with blank
     * regions that look like a rendering bug. Waiting for the reveal targets to
     * exist is the cheapest reliable signal that React has run.
     */
    await page
      .waitForFunction(() => document.querySelectorAll('[data-reveal]').length > 0, {
        timeout: 5_000,
      })
      .catch(() => {
        // A page with nothing that reveals is a perfectly ordinary page.
      });
    await page.waitForTimeout(400);

    // Walk the page so everything that reveals on scroll has revealed, then
    // return to the top so the capture starts where a reader would.
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.5;
      const height = document.documentElement.scrollHeight;
      for (let y = 0; y < height; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 110));
      }
      window.scrollTo(0, 0);
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    /*
     * Anything still hidden gets scrolled to directly.
     *
     * A sweep in viewport-sized steps can jump clean over a short section, so
     * the sweep alone is not a guarantee. This is, and it fails loudly rather
     * than producing a screenshot with a blank region that looks like a bug.
     */
    await page.evaluate(async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const pending = [...document.querySelectorAll('[data-reveal="pending"]')];
        if (pending.length === 0) break;
        for (const element of pending) {
          element.scrollIntoView({ block: 'center', behavior: 'instant' });
          await new Promise((resolve) => setTimeout(resolve, 60));
        }
      }
      window.scrollTo(0, 0);
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    const stillHidden = await page.$$eval(
      '[data-reveal="pending"]',
      (nodes) => nodes.length,
    );
    if (stillHidden > 0) {
      errors.push(`${stillHidden} element(s) never revealed`);
    }
    await page.waitForTimeout(700);

    const file = `${OUT}/${view.id}-${scheme}.png`;
    await page.screenshot({
      path: file,
      /*
       * Never full-page under print emulation.
       *
       * Chromium relays the document out at the paper width for a full-page
       * capture in print media, which produces an image of a document squeezed
       * into a narrow column — an artifact of the capture, not of the page. It
       * looks exactly like a layout bug and is not one, which makes it worse
       * than no screenshot. The framed capture shows what print actually does;
       * the rest is asserted in tests/e2e/report.spec.ts.
       */
      fullPage: Boolean(view.full) && view.media !== 'print',
      // A tall document takes real time to encode. The default 30s is a
      // timeout on the encoder, not on anything that could be wrong.
      timeout: 120_000,
    });

    if (errors.length > 0) {
      problems += errors.length;
      console.error(`✗ ${file}`);
      for (const error of errors.slice(0, 5)) console.error(`    ${error}`);
    } else {
      console.log(`✓ ${file}`);
    }

    await context.close();
  }
}

await browser.close();

if (problems > 0) {
  console.error(`\n${problems} console or network problem(s) during capture.`);
  process.exit(1);
}
