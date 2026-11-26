// Prints brightness/colour spread per screen region, so composition shows without eyes.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('./playwright-core');
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const GAME = join(ROOT, 'game');
const PORT = 8233;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = join(GAME, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  try { const body = await readFile(path); res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404).end('no'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: 'C:/Users/Lain/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${PORT}/?shot=${process.argv[2] ?? 'cover'}`, { waitUntil: 'load' });
await page.waitForTimeout(2500);
const grid = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const w = 64, h = 36;
  const src = document.createElement('canvas'); src.width = w; src.height = h;
  const ctx = src.getContext('2d'); ctx.drawImage(canvas, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const rows = [];
  for (let y = 0; y < h; y += 4) {
    let line = '';
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);
      line += ' .:-=+*#%@'[Math.min(9, Math.floor(l / 25.6))];
    }
    rows.push(line);
  }
  return rows.join('\n');
});
console.log(grid);
await browser.close(); server.close();
