// Builds the ground: displaced island meshes, the sea, the two airstrips and their lamps.

import * as THREE from 'three';
import { WORLD } from '../config.js';
import { groundAt, ISLANDS, AIRSTRIPS, noise } from './heightfield.js';

const SAND = new THREE.Color('#c6b089');
const WET = new THREE.Color('#7d7158');
const SHOAL = new THREE.Color('#12495a');
const MOSS = new THREE.Color('#71854a');
const JUNGLE = new THREE.Color('#4a6639');
const BASALT = new THREE.Color('#3a3733');
const ASH = new THREE.Color('#574c44');
const EMBER = new THREE.Color('#7a4126');

function groundColor(height, slope, volcanic, x, z) {
  const c = new THREE.Color();
  if (height < 1.3) c.copy(SHOAL).lerp(WET, THREE.MathUtils.clamp(height / 1.3, 0, 1) * 0.8);
  else if (height < 6) c.copy(WET).lerp(SAND, (height - 1.3) / 4.7);
  else if (height < 26) c.copy(SAND).lerp(MOSS, (height - 4) / 22);
  else if (height < 200) c.copy(MOSS).lerp(JUNGLE, Math.min(1, (height - 26) / 120));
  else if (volcanic) c.copy(ASH).lerp(BASALT, Math.min(1, (height - 200) / 260));
  else c.copy(JUNGLE).lerp(BASALT, Math.min(1, (height - 200) / 300));
  if (volcanic && height > 430) c.lerp(EMBER, (height - 430) / 240);
  c.lerp(BASALT, Math.min(0.85, slope * 2.1));
  // Rock breaking through the slope, and scrub mottling the gentle ground: two scales of mark,
  // so a face carries speckle and erosion rather than one flat tone.
  if (slope > 0.34) c.lerp(ROCK, Math.min(0.7, (slope - 0.34) * 1.3) * (0.4 + noise(x * 0.06, z * 0.06) * 0.7));
  if (height > 8 && height < 190 && slope < 0.4) {
    c.lerp(JUNGLE, 0.22 + noise(x * 0.045, z * 0.045) * 0.38);
  }
  const grain = 0.93 + noise(x * 0.05, z * 0.05) * 0.1 + noise(x * 0.23, z * 0.23) * 0.09;
  return c.multiplyScalar(grain);
}

export function buildTerrain(scene) {
  const group = new THREE.Group();
  const seg = WORLD.grid;
  const span = WORLD.size;
  const geometry = new THREE.PlaneGeometry(span, span, seg, seg);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = groundAt(x, z);
    pos.setY(i, h);
    const dx = groundAt(x + 12, z) - groundAt(x - 12, z);
    const dz = groundAt(x, z + 12) - groundAt(x, z - 12);
    const slope = Math.min(1, Math.hypot(dx, dz) / 34);
    const volcanic = Math.hypot(x - 1180, z + 240) < 900;
    const c = groundColor(h, slope, volcanic, x, z);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.02 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  group.add(mesh);

  group.add(buildSea());
  for (const strip of AIRSTRIPS) group.add(buildAirstrip(strip));
  for (const island of ISLANDS) if (island.lamp) group.add(buildLighthouse(island));
  scene.add(group);
  return group;
}

function buildSea() {
  const geo = new THREE.PlaneGeometry(WORLD.size * 3, WORLD.size * 3, 190, 190);
  geo.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: '#2f8798',
    roughness: 0.34,
    metalness: 0.3,
    transparent: true,
    opacity: 0.97,
  });
  const sea = new THREE.Mesh(geo, material);
  sea.position.y = 0.4;
  sea.receiveShadow = false;
  sea.userData.wave = { base: geo.attributes.position.array.slice(), geo };
  return sea;
}

export function animateSea(sea, time) {
  const wave = sea?.userData?.wave;
  if (!wave) return;
  const arr = wave.geo.attributes.position.array;
  for (let i = 0; i < arr.length; i += 3) {
    const x = wave.base[i];
    const z = wave.base[i + 2];
    arr[i + 1] = Math.sin(x * 0.019 + time * 1.7) * 1.5 + Math.sin(z * 0.031 - time * 1.2) * 1.1 + Math.sin((x + z) * 0.007 + time * 0.6) * 2.4;
  }
  wave.geo.attributes.position.needsUpdate = true;
  wave.geo.computeVertexNormals();
}

// Where a strip's tarmac actually sits, so the camera and the spawn agree with the mesh.
export function airstripPad(strip) {
  return strip.pad + 1.4;
}

function buildAirstrip(strip) {
  const group = new THREE.Group();
  const padHeight = airstripPad(strip);
  group.position.set(strip.x, padHeight, strip.z);
  group.rotation.y = strip.heading;

  // A flat sheet on the levelled pad rather than a box: no faces to read as a slab from a
  // low final, and the graded ground does the work at the edges.
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(strip.width, strip.length),
    new THREE.MeshStandardMaterial({ color: '#2c3033', roughness: 0.95 }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.y = 0.04;
  // Gravel shoulders, so the asphalt edge is broken by a strip of grade rather than a hard line.
  const shoulder = new THREE.MeshStandardMaterial({ color: '#6d6552', roughness: 1 });
  for (const side of [-1, 1]) {
    const grade = new THREE.Mesh(new THREE.PlaneGeometry(5, strip.length), shoulder);
    grade.rotation.x = -Math.PI / 2;
    grade.position.set(side * (strip.width / 2 + 2.5), 0.03, 0);
    group.add(grade);
  }
  asphalt.receiveShadow = true;
  group.add(asphalt);

  const dash = new THREE.MeshStandardMaterial({ color: '#f2ecd8', roughness: 0.75, emissive: '#5a5238', emissiveIntensity: 0.4 });
  const edge = new THREE.MeshStandardMaterial({ color: '#cfc39f', emissive: '#6a5c33', emissiveIntensity: 0.5 });
  for (let i = -strip.length / 2 + 48; i < strip.length / 2 - 20; i += 46) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 26), dash);
    mark.position.set(0, 0.16, i);
    group.add(mark);
  }
  for (const side of [-1, 1]) {
    for (let i = -strip.length / 2 + 14; i < strip.length / 2; i += 62) {
      const light = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), edge);
      light.position.set(side * (strip.width / 2 + 2.6), 0.9, i);
      group.add(light);
    }
  }

  // Threshold piano keys and the designator at each end, so the strip reads as a runway from the air.
  const paint = new THREE.MeshStandardMaterial({ color: '#f7f1dc', emissive: '#6b6250', emissiveIntensity: 0.5, roughness: 0.8 });
  for (const end of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const key = new THREE.Mesh(new THREE.BoxGeometry(3, 0.24, 16), paint);
      key.position.set(-strip.width / 2 + 7 + i * 6, 0.16, end * (strip.length / 2 - 11));
      group.add(key);
    }
    // A big clean canvas with anisotropy: at 256px the designator came out as a blur from the air.
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f7f1dc';
    ctx.font = 'bold 260px "DIN Alternate", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(strip.designator ?? '09', 256, 262);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const number = new THREE.Mesh(
      new THREE.PlaneGeometry(19, 19),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    number.rotation.x = -Math.PI / 2;
    number.rotation.z = end > 0 ? Math.PI : 0;
    number.position.set(0, 0.18, end * (strip.length / 2 - 38));
    group.add(number);
  }

  // PAPI bars off the threshold: two white, two red, the way a real approach reads.
  const papiWhite = new THREE.MeshStandardMaterial({ color: '#fff6dd', emissive: '#ffeec4', emissiveIntensity: 3.2 });
  const papiRed = new THREE.MeshStandardMaterial({ color: '#ff6b4a', emissive: '#ff3d20', emissiveIntensity: 3.2 });
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.5, 1.6), i < 2 ? papiWhite : papiRed);
    bar.position.set(-strip.width / 2 - 12, 1.4, -strip.length / 2 + 18 + i * 6.4);
    group.add(bar);
  }
  // Threshold masts: the pair of lamps a pilot aims between.
  for (const side of [-1, 1]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 6, 6), new THREE.MeshStandardMaterial({ color: '#3a474b', roughness: 0.8 }));
    mast.position.set(side * strip.width * 0.7, 3, -strip.length / 2 + 9);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), new THREE.MeshStandardMaterial({ color: '#fffbe9', emissive: '#fff2c8', emissiveIntensity: 4 }));
    lamp.position.set(side * strip.width * 0.7, 6.4, -strip.length / 2 + 9);
    const beam = new THREE.PointLight('#fff0c0', 90, 320, 2);
    beam.position.copy(lamp.position);
    group.add(mast, lamp, beam);
  }

  const threshold = new THREE.Mesh(new THREE.BoxGeometry(strip.width, 0.2, 3), new THREE.MeshStandardMaterial({ color: '#e8e2cf', emissive: '#8a805f', emissiveIntensity: 0.4 }));
  threshold.position.set(0, 0.85, -strip.length / 2 + 12);
  group.add(threshold);

  const towerBase = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 6.6, 22, 10),
    new THREE.MeshStandardMaterial({ color: '#c9bfa4', roughness: 0.9 }),
  );
  towerBase.position.set(strip.width / 2 + 20, 11, -strip.length / 2 + 60);
  const towerTop = new THREE.Mesh(
    new THREE.CylinderGeometry(8.4, 8.4, 6, 12),
    new THREE.MeshStandardMaterial({ color: '#2f3d42', roughness: 0.4, metalness: 0.5, emissive: '#25414c', emissiveIntensity: 0.6 }),
  );
  towerTop.position.copy(towerBase.position).setY(25);
  group.add(towerBase, towerTop);

  const hangar = new THREE.Mesh(
    new THREE.CylinderGeometry(12, 12, 34, 14, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: '#8d9a8c', roughness: 0.85, side: THREE.DoubleSide }),
  );
  hangar.rotation.z = Math.PI / 2;
  hangar.rotation.y = Math.PI / 2;
  hangar.position.set(-strip.width / 2 - 26, 2, strip.length / 2 - 80);
  group.add(hangar);

  const sockPole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 6), new THREE.MeshStandardMaterial({ color: '#9d9275' }));
  sockPole.position.set(-strip.width / 2 - 8, 7, -strip.length / 2 + 18);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(3.4, 12, 8, 1, true),
    new THREE.MeshStandardMaterial({ color: '#ff8b3d', roughness: 0.7, side: THREE.DoubleSide }),
  );
  sock.rotation.z = -Math.PI / 2;
  sock.position.set(-strip.width / 2 - 8 - 6, 12, -strip.length / 2 + 18);
  group.add(sockPole, sock);

  return group;
}

function buildLighthouse(island) {
  const group = new THREE.Group();
  const x = island.x + island.r * 0.55;
  const z = island.z - island.r * 0.4;
  group.position.set(x, Math.max(4, groundAt(x, z)), z);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 5.4, 34, 12),
    new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.82 }),
  );
  tower.position.y = 17;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.4, 7, 12), new THREE.MeshStandardMaterial({ color: '#b8392f', roughness: 0.8 }));
  band.position.y = 22;
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 4, 10), new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: '#ffc35c', emissiveIntensity: 2.4 }));
  lamp.position.y = 35.4;
  const beam = new THREE.PointLight('#ffcf7a', 220, 460, 2);
  beam.position.y = 35.4;
  group.add(tower, band, lamp, beam);
  group.userData.lamp = lamp;
  return group;
}

export const ROCK = new THREE.Color('#4b4844');
