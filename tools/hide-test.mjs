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
await new Promise((r) => server.listen(8237, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: 'C:/Users/Lain/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8237/index.html?shot=cover', { waitUntil: 'load' });
await page.waitForTimeout(3000);
// sample the top-middle sky band where the trapezoid sits
const sample = async () => page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  const w = canvas.width, h = canvas.height;
  const px = new Uint8Array(4 * w * h);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const cols = [];
  for (let x = Math.floor(w * 0.35); x < w * 0.65; x += 8) {
    const row = [];
    for (let y = Math.floor(h * 0.62); y < Math.floor(h * 0.9); y += 4) {
      const i = (y * w + x) * 4;
      row.push([px[i], px[i + 1], px[i + 2]].join(','));
    }
    cols.push(row.join(' '));
  }
  return cols.join('|');
});
const base = await sample();
const targets = await page.evaluate(() => {
  const out = {};
  window.__game.scene.traverse((o) => {
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m) return;
    if (o.isSprite && m.map && m.blending === 1) out[`cloud${Object.keys(out).length}`] = o.uuid;
    if (o.isMesh && o.geometry?.type === 'PlaneGeometry' && m.map) out.glitter = o.uuid;
    if (o.isMesh && o.geometry?.type === 'PlaneGeometry' && !m.map && !m.transparent) out.sea = o.uuid;
    if (o.isMesh && o.geometry?.type === 'SphereGeometry' && o.material.type === 'ShaderMaterial') out.dome = o.uuid;
  });
  return out;
});
console.log(Object.keys(targets));
for (const [name, id] of Object.entries(targets)) {
  await page.evaluate((uuid) => {
    const o = window.__game.scene.getObjectByProperty('uuid', uuid);
    if (o) o.visible = false;
  }, id);
  await page.waitForTimeout(600);
  const after = await sample();
  await page.evaluate((uuid) => {
    const o = window.__game.scene.getObjectByProperty('uuid', uuid);
    if (o) o.visible = true;
  }, id);
  const a = base.split('|'), b = after.split('|');
  let diff = 0, n = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i].split(' '), y = b[i].split(' ');
    for (let j = 0; j < x.length; j++) {
      const p = x[j].split(','), q = y[j].split(',');
      diff += Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
      n++;
    }
  }
  console.log(name, (diff / n / 3).toFixed(1));
}
await browser.close(); server.close();
