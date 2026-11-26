// Builds the ground: displaced island meshes, the sea, the two airstrips and their lamps.

import * as THREE from 'three';
import { WORLD } from '../config.js';
import { groundAt, ISLANDS, AIRSTRIPS, fbm, noise } from './heightfield.js';

const SAND = new THREE.Color('#d8c79a');
const MOSS = new THREE.Color('#5c6f3c');
const JUNGLE = new THREE.Color('#334c2f');
const BASALT = new THREE.Color('#3a3733');
const ASH = new THREE.Color('#574c44');
const EMBER = new THREE.Color('#7a4126');

function groundColor(height, slope, volcanic) {
  const c = new THREE.Color();
  if (height < 4) c.copy(SAND);
  else if (height < 26) c.copy(SAND).lerp(MOSS, (height - 4) / 22);
  else if (height < 200) c.copy(MOSS).lerp(JUNGLE, Math.min(1, (height - 26) / 120));
  else if (volcanic) c.copy(ASH).lerp(BASALT, Math.min(1, (height - 200) / 260));
  else c.copy(JUNGLE).lerp(BASALT, Math.min(1, (height - 200) / 300));
  if (volcanic && height > 430) c.lerp(EMBER, (height - 430) / 240);
  c.lerp(BASALT, Math.min(0.85, slope * 2.1));
  const grain = 0.88 + noise(height * 0.7, height * 1.3) * 0.24;
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
    const c = groundColor(h, slope, volcanic);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.02, flatShading: true });
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
  const geo = new THREE.PlaneGeometry(WORLD.size * 3, WORLD.size * 3, 110, 110);
  geo.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({
    color: '#2b7d8f',
    roughness: 0.34,
    metalness: 0.3,
    transparent: true,
    opacity: 0.93,
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
  return Math.max(6, groundAt(strip.x, strip.z)) + 1.4;
}

function buildAirstrip(strip) {
  const group = new THREE.Group();
  const padHeight = airstripPad(strip);
  group.position.set(strip.x, padHeight, strip.z);
  group.rotation.y = strip.heading;

  const asphalt = new THREE.Mesh(
    new THREE.BoxGeometry(strip.width, 1.6, strip.length),
    new THREE.MeshStandardMaterial({ color: '#2c3033', roughness: 0.95 }),
  );
  asphalt.position.y = 0;
  asphalt.receiveShadow = true;
  group.add(asphalt);

  const dash = new THREE.MeshStandardMaterial({ color: '#e8e2cf', roughness: 0.8 });
  const edge = new THREE.MeshStandardMaterial({ color: '#cfc39f', emissive: '#6a5c33', emissiveIntensity: 0.5 });
  for (let i = -strip.length / 2 + 26; i < strip.length / 2 - 20; i += 46) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 20), dash);
    mark.position.set(0, 0.9, i);
    group.add(mark);
  }
  for (const side of [-1, 1]) {
    for (let i = -strip.length / 2 + 14; i < strip.length / 2; i += 62) {
      const light = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), edge);
      light.position.set(side * (strip.width / 2 + 2.6), 0.9, i);
      group.add(light);
    }
  }

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
