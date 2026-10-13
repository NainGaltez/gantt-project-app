import { createServer } from 'http';
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = 9225;
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify([
    { id: 'test1', type: 'page', title: 'test', webSocketDebuggerUrl: 'ws://127.0.0.1:' + PORT + '/devtools/browser/test1/page' }
  ]));
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
console.log('mock debugger on', PORT);

const chromeExeCyg = 'C:\Program Files\Google\Chrome\Application\chrome.exe';
const chrome = spawn(chromeExeCyg, [
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

let debugUrl = null;
const timeout = 20000;
const start = Date.now();
while (Date.now() - start < timeout) {
  try {
    const pairs = await fetch('http://127.0.0.1:' + PORT + '/json').then(r => r.json()).catch(() => null);
    if (Array.isArray(pairs) && pairs.length) {
      const target = pairs.find(p => p.webSocketDebuggerUrl);
      if (target && target.webSocketDebuggerUrl) {
        debugUrl = target.webSocketDebuggerUrl;
        break;
      }
    }
  } catch {}
  await new Promise(r => setTimeout(r, 300));
}
server.close();
if (!debugUrl) {
  console.error('could not get debugging url');
  process.exit(1);
}
console.log('debugUrl', debugUrl);

function send(method, params) {
  return fetch(debugUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: Date.now(), method, params: params || {} })
  }).then(r => r.json());
}

await send('Page.navigate', { url: 'http://localhost:5173/', waitUntil: 'networkIdle' });
await new Promise(r => setTimeout(r, 2500));

try {
  const shot1 = await send('Page.getScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(__dirname, 'gantt-home.png'), Buffer.from(shot1.data, 'base64'));
  console.log('home shot ok');
} catch(e) { console.error('home shot failed', e.message); }

await send('Runtime.evaluate', {
  expression: `(function(){
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Analisis');
    if(btn) { btn.click(); return true; }
    return false;
  })()`
});
await new Promise(r => setTimeout(r, 1500));

try {
  const shot2 = await send('Page.getScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(__dirname, 'gantt-analysis.png'), Buffer.from(shot2.data, 'base64'));
  console.log('analysis shot ok');
} catch(e) { console.error('analysis shot failed', e.message); }

chrome.kill();
