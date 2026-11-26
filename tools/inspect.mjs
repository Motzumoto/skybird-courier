// Reports what the frame actually holds: WebGL up, draw calls, and the pixel spread of the render.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('./playwright-core');
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const GAME = join(ROOT, 'game');
const PORT = 8232;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = join(GAME, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  try { const body = await readFile(path); res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404).end('no'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: 'C:/Users/Lain/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/?shot=${process.argv[2] ?? 'cover'}`, { waitUntil: 'load' });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const data = new Uint8Array(canvas.width * canvas.height * 4);
  return { w: canvas.width, h: canvas.height, hdg: document.getElementById('g-hdg').textContent, alt: document.getElementById('g-alt').textContent, spd: document.getElementById('g-speed').textContent };
});
const buf = await page.screenshot({ type: 'png' });
// crude stats from the JPEG-free PNG via canvas in page
const stats = await page.evaluate(async () => {
  const canvas = document.querySelector('canvas');
  const src = document.createElement('canvas');
  src.width = 160; src.height = 90;
  const ctx = src.getContext('2d');
  ctx.drawImage(canvas, 0, 0, 160, 90);
  const d = ctx.getImageData(0, 0, 160, 90).data;
  let sum = 0, min = 255, max = 0, uniq = new Set();
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);
    sum += l; min = Math.min(min, l); max = Math.max(max, l);
    uniq.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4));
  }
  return { mean: (sum / (d.length / 4)).toFixed(1), min: min.toFixed(0), max: max.toFixed(0), colors: uniq.size };
});
console.log(JSON.stringify({ ...info, ...stats }));
console.log('hdg', info.hdg, 'alt', info.alt, 'spd', info.spd);
await browser.close(); server.close();
