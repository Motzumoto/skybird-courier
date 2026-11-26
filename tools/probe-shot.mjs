import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('./playwright-core');
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const GAME = join(ROOT, 'game');
const PORT = 8234;
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const f = join(GAME, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname)); try { const b = await readFile(f); res.writeHead(200, { 'content-type': T[extname(f)] ?? 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404).end('no'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: 'C:/Users/Lain/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[err]', e.message));
await page.goto(`http://127.0.0.1:${PORT}/?shot=${process.argv[2] ?? 'ridge'}`, { waitUntil: 'load' });
await page.waitForTimeout(2500);
console.log(JSON.stringify(await page.evaluate(() => {
  const g = window.__game;
  const cam = g.camera;
  const plane = g.plane;
  const spheres = [];
  g.scene.traverse((o) => { if (o.isMesh && o.geometry?.type === 'SphereGeometry' && o.material?.transparent && o.material?.opacity < 0.9 && o.material?.opacity > 0) spheres.push(o); });
  const rows = spheres.map((s) => {
    const p = s.position.clone().project(cam);
    return { x: Math.round(p.x * 640 + 640), y: Math.round(-p.y * 360 + 360), z: +p.z.toFixed(2), dist: Math.round(s.position.distanceTo(plane.position)), scale: +s.scale.x.toFixed(1) };
  });
  return { planeY: Math.round(plane.position.y), camY: Math.round(cam.position.y), count: rows.length, rows: rows.slice(0, 12) };
})));
await browser.close(); server.close();
