import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-proxy-server', '--no-sandbox'],
});
const page = await browser.newPage();
page.on('response', (r) => {
  if (r.status() >= 400) console.log(r.status(), r.url());
});
await page.goto(process.argv[2], { waitUntil: 'load' });
await page.waitForTimeout(1500);
await browser.close();
