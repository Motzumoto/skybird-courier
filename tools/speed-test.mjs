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
await new Promise((r) => server.listen(8233, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: 'C:/Users/Lain/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
await page.goto('http://127.0.0.1:8233/index.html', { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.click('#start');
const rows = [];
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(1000);
  rows.push(await page.evaluate(() => {
    const p = window.__game.plane;
    const f = new (Object.getPrototypeOf(p.position).constructor)(0, 0, -1).applyQuaternion(p.quaternion);
    return { spd: +p.speed.toFixed(1), alt: +p.position.y.toFixed(1), thr: +p.throttle.toFixed(2), climb: +f.y.toFixed(3), pitch: +p.pitch.toFixed(3), stalled: p.stalled };
  }));
}
console.log(JSON.stringify(rows));
await browser.close(); server.close();
