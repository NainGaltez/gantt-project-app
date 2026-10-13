import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Use Playwright via require (CJS) to avoid ESM interop issues.
const playwright = require('./node_modules/playwright-core');
const { chromium } = playwright;

const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1360,900',
    '--hide-scrollbars',
    '--force-device-scale-factor=1'
  ]
});

const page = await browser.newPage();
await page.setViewport({ width: 1360, height: 900 });

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 20000 });

await page.screenshot({ path: join(__dirname, 'gantt-home.png') });
console.log('home shot ok');

const btns = await page.$$eval('button', bs => bs.map(b => b.textContent.trim()));
const targetIndex = btns.findIndex(b => b === 'Analisis');
console.log('buttons:', btns);
console.log('Analisis index:', targetIndex);

if (targetIndex === -1) {
  console.log('no Analisis button found; aborting analysis shot');
  await browser.close();
  process.exit(1);
}

await page.click('button:nth-child(' + (targetIndex + 1) + ')');
await page.waitForTimeout(2500);

await page.screenshot({ path: join(__dirname, 'gantt-analysis.png') });
console.log('analysis shot ok');

await browser.close();
