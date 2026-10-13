import { execSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

const exeCyg = execSync('cygpath -u "C:\Program Files\Google\Chrome\Application\chrome.exe"', { encoding: 'utf8' }).trim();
console.log('exeCyg', exeCyg);

const PORT = 9237;
const chrome = spawn(exeCyg, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-debugging-port=' + PORT,
  '--window-size=1360,900',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  'about:blank'
], { stdio: ['ignore','pipe','pipe'] });

const getJson = () => fetch('http://127.0.0.1:' + PORT + '/json').then(r => r.json()).catch(() => null);
let info = null;
const deadline = Date.now() + 25000;
let attempts = 0;
while (Date.now() < deadline) {
  info = await getJson();
  attempts++;
  if (Array.isArray(info) && info.length) {
    console.log('connected on attempt', attempts);
    break;
  }
  if (attempts % 10 === 0) console.log('still waiting', attempts);
  await new Promise(r => setTimeout(r, 500));
}
if (!info || !Array.isArray(info) || !info.length) {
  console.error('FAILED: no chrome info after', attempts, 'attempts');
  process.exit(1);
}
const page = info.find(p => p.type === 'page') || info[0];
const wsUrl = page.webSocketDebuggerUrl;
console.log('wsUrl', wsUrl);

function send(method, params) {
  return fetch(wsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: Date.now(), method, params: params || {} })
  }).then(r => r.json());
}

const navRes = await send('Page.navigate', { url: 'http://localhost:5173/', waitUntil: 'networkIdle' });
console.log('navResult', navRes);

await new Promise(r => setTimeout(r, 3000));

const shot1 = await send('Page.getScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
await writeFile(join(__dirname, 'gantt-home.png'), Buffer.from(shot1.data, 'base64'));
console.log('home shot ok');

const clickRes = await send('Runtime.evaluate', {
  expression: `(function(){
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Analisis');
    if(btn) { btn.click(); return true; }
    return false;
  })()`
});
console.log('clickResult', clickRes);

await new Promise(r => setTimeout(r, 2000));

const shot2 = await send('Page.getScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
await writeFile(join(__dirname, 'gantt-analysis.png'), Buffer.from(shot2.data, 'base64'));
console.log('analysis shot ok');

chrome.kill();
