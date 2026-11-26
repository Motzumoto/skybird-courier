// Headless play-through: start a sortie, fly it with real key events, and report state and errors.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('./playwright-core');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'game');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((resolve) => server.listen(8232, '127.0.0.1', resolve));

const browser = await chromium.launch({
  executablePath: 'C:/Users/Lain/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

await page.goto('http://127.0.0.1:8232/index.html', { waitUntil: 'load' });
await page.waitForTimeout(1800);
await page.screenshot({ path: 'shots/debug-title.jpg', type: 'jpeg', quality: 80 });

await page.click('#start');
await page.waitForTimeout(2500);
await page.screenshot({ path: 'shots/debug-flight-start.jpg', type: 'jpeg', quality: 80 });

const before = await page.evaluate(() => ({ z: window.__game.plane.position.z, speed: window.__game.plane.speed }));
await page.keyboard.press('Period');
// fly level-ish: tap pitch down in short pulses, then hold throttle up
for (let i = 0; i < 9; i++) {
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(220);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(780);
}
await page.keyboard.down('Period');
await page.waitForTimeout(1500);
await page.keyboard.up('Period');
const after = await page.evaluate(() => ({
  z: window.__game.plane.position.z,
  x: window.__game.plane.position.x,
  speed: window.__game.plane.speed,
  altitude: window.__game.plane.position.y,
  hull: window.__game.plane.hull,
  fuel: window.__game.plane.fuel,
  hud: document.querySelector('.speed')?.textContent,
  mission: document.getElementById('m-count')?.textContent,
  state: document.querySelector('#hud').className,
  hudHidden: document.getElementById('hud').classList.contains('hidden-hud'),
}));
await page.screenshot({ path: 'shots/debug-flight.jpg', type: 'jpeg', quality: 80 });

// open the pause menu, then the camera key, to prove those paths run
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/debug-pause.jpg', type: 'jpeg', quality: 80 });
await page.keyboard.press('Enter');

console.log(JSON.stringify({ errors, before, after }, null, 1));
await browser.close();
server.close();
