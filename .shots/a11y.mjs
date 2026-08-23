import { chromium } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-proxy-server', '--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
let failed = false;
for (const path of process.argv.slice(2)) {
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:3100${path}`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  if (violations.length) {
    failed = true;
    console.log(`\n=== ${path}: ${violations.length} violation(s) ===`);
    for (const v of violations) {
      console.log(`[${v.impact}] ${v.id}: ${v.help}`);
      for (const n of v.nodes.slice(0, 3)) console.log('   ', n.html.slice(0, 200));
    }
  } else {
    console.log(`${path}: clean`);
  }
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
