import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('./playwright-core');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.cwd(), 'game');
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(root, name === '/' ? 'index.html' : name);
  fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' }); res.end(d); });
});
await new Promise((r) => server.listen(8235, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: 'C:/Users/Lain/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8235/index.html?shot=cover', { waitUntil: 'load' });
await page.waitForTimeout(3500);
console.log(await page.evaluate(() => {
  const { scene, camera } = window.__game;
  const V = camera.position.constructor;
  const found = [];
  scene.traverse((o) => {
    if (!(o.isMesh || o.isSprite)) return;
    const p = new V();
    o.getWorldPosition(p);
    const q = p.clone().project(camera);
    if (q.z < -1 || q.z > 1) return;

    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    found.push({
      type: o.type,
      geo: o.geometry?.type,
      transparent: mat?.transparent,
      opacity: mat?.opacity,
      color: mat?.color?.getHexString?.(),
      map: Boolean(mat?.map),
      blend: mat?.blending,
      dist: +p.distanceTo(camera.position).toFixed(1),
      scale: o.scale.toArray().map((n) => +n.toFixed(1)),
      x: +q.x.toFixed(2),
      y: +q.y.toFixed(2),
    });
  });
  return JSON.stringify(found.slice(0, 25), null, 1);
}));
await browser.close(); server.close();
