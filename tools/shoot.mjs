// Renders the game's shot poses with headless Chromium at 1280x720 and writes the screenshots.
// node tools/shoot.mjs [names...]

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('./playwright-core');

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const GAME = join(ROOT, 'game');
const OUT = join(ROOT, 'screenshots');
const PORT = 8231;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = join(GAME, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    console.log('404', path); res.writeHead(404).end('no');
  }
});

const names = process.argv.slice(2);
const shots = names.length ? names : ['cover', 'approach', 'ridge', 'cliffs'];

await mkdir(OUT, { recursive: true });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', resolve); });

const browser = await chromium.launch({
  executablePath: 'C:/Users/Lain/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars", "--no-proxy-server", "--proxy-bypass-list=*'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('console', (message) => console.log('[page]', message.type(), message.text()));
page.on('pageerror', (error) => console.log('[pageerror]', error.message));

let index = 1;
for (const name of shots) {
  await page.goto(`http://127.0.0.1:${PORT}/?shot=${name}`, { waitUntil: 'load' });
  await page.waitForTimeout(2600);
  const file = join(OUT, `${index}-${name}.jpg`);
  await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
  console.log('wrote', file);
  index += 1;
}

await browser.close();
server.close();
