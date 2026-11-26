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
await new Promise((r) => server.listen(8234, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: 'C:/Users/Lain/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
await page.goto('http://127.0.0.1:8234/index.html', { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.click('#start');
await page.waitForTimeout(6000);
console.log(await page.evaluate(() => {
  const p = window.__game.plane;
  const V = Object.getPrototypeOf(p.position).constructor;
  const f = new V(0, 0, 1).applyQuaternion(p.quaternion).negate();
  return JSON.stringify({ speed: p.speed, throttle: p.throttle, cargo: p.cargo, climb: f.y, flaps: p.flaps, cap: p.speedCap, fuel: p.fuel });
}));
await browser.close(); server.close();
