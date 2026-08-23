import { chromium } from '@playwright/test';
const [url, out, w, h, full] = process.argv.slice(2);
// The environment ships Chromium build 1194; the installed Playwright expects a
// newer build, so point it at the binary that is actually present. Proxying is
// disabled because the target is always loopback.
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-proxy-server', '--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width: +w, height: +h },
  deviceScaleFactor: 2,
});
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.error('CONSOLE ERROR:', m.text());
});
await page.goto(url, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: out, fullPage: full === 'full' });
await browser.close();
console.log('saved', out);
