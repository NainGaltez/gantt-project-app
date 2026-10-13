const playwright = require('playwright-core');
const { chromium } = playwright;
const path = require('path');

(async () => {
  console.log('launching browser...');
  const browser = await chromium.launch({ headless: true });
  console.log('browser launched');
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1360, height: 900 });
  console.log('navigating...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 20000 });
  console.log('nav done');
  await page.screenshot({ path: path.join(__dirname, 'gantt-home.png') });
  console.log('home shot ok');
  const btns = await page.$$eval('button', bs => bs.map(b => b.textContent.trim()));
  const idx = btns.findIndex(b => b.endsWith('Analisis'));
  console.log('Analisis idx:', idx, 'matched:', idx >= 0 ? btns[idx] : null);
  if (idx === -1) {
    console.log('no Analisis button found; aborting');
    await browser.close();
    process.exit(1);
  }
  // Use JS click
  await page.evaluate((i) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns[i];
    if (btn) btn.click();
  }, idx);
  console.log('clicked button index', idx);
  await page.waitForTimeout(3000);
  console.log('taking analysis shot');
  await page.screenshot({ path: path.join(__dirname, 'gantt-analysis.png') });
  console.log('analysis shot ok');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
