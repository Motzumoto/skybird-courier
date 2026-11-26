// Deterministic value noise and the island shapes built from it, shared by the heightfield,
// the terrain mesh and every system that has to ask what the ground does at a point.

import { WORLD } from '../config.js';

const TABLE = 512;
const PERM = new Uint8Array(TABLE);
let seed = 20261126;

export function reseed(value) {
  seed = value >>> 0 || 1;
  for (let i = 0; i < TABLE; i++) PERM[i] = i & 255;
  for (let i = TABLE - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = PERM[i];
    PERM[i] = PERM[j];
    PERM[j] = tmp;
  }
}

function hash(x, z) {
  return PERM[(PERM[x & 255] + (z & 255)) & 511] / 255;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Value noise in [0, 1].
export function noise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const tx = smooth(x - xi);
  const tz = smooth(z - zi);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}

export function fbm(x, z, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x * freq, z * freq) * amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum;
}

// Each island: a centre, an irregular radius, and how high its caldera climbs.
export const ISLANDS = [
  { name: 'Porto Sana', x: -1450, z: 1280, r: 620, h: 150, airstrip: true, lamp: true },
  { name: 'Ilha Cardo', x: 60, z: 640, r: 470, h: 300 },
  { name: 'Caldeira Preta', x: 1180, z: -240, r: 560, h: 610, volcano: true },
  { name: 'Vela Rock', x: -620, z: -1180, r: 360, h: 260 },
  { name: 'Ilheu do Sino', x: 1560, z: 1120, r: 300, h: 190, lamp: true },
  { name: 'Serra Alta', x: -1180, z: -320, r: 520, h: 430 },
];

// Airstrips sit on a levelled shelf that the heightfield itself carves, so a landing is a landing.
export const AIRSTRIPS = [
  { name: 'Porto Sana', x: -1450, z: 1280, heading: 0.42, length: 620, width: 44, pad: 88, designator: '14' },
  { name: 'Ilheu do Sino', x: 1560, z: 1120, heading: -1.05, length: 480, width: 34, pad: 112, designator: '27' },
];

// The shape of one island at a point: 1 at the crown, 0 past the shore.
function islandFalloff(island, x, z) {
  const dx = x - island.x;
  const dz = z - island.z;
  const dist = Math.hypot(dx, dz);
  const warp = fbm((x + island.x) * 0.0011, (z + island.z) * 0.0011, 3) * 0.46 + 0.68;
  const reach = island.r * warp;
  if (dist > reach) return 0;
  return Math.pow(1 - dist / reach, 1.65);
}

// Ground height in metres, sea level being 0.
export function groundAt(x, z) {
  let h = -26;
  for (const island of ISLANDS) {
    const fall = islandFalloff(island, x, z);
    if (fall <= 0) continue;
    const ridge = fbm(x * 0.0042 + island.h, z * 0.0042, 4);
    const cone = island.volcano ? Math.pow(fall, 1.25) * (0.55 + ridge * 0.85) : fall * (0.35 + ridge);
    const crown = island.volcano ? Math.pow(Math.max(0, fall - 0.55) / 0.45, 2) : 0;
    h = Math.max(h, island.h * cone - (island.volcano ? crown * island.h * 0.42 : 0));
  }
  if (h > 2) h += (fbm(x * 0.021, z * 0.021, 3) - 0.5) * 12;

  // Airstrips sit on a graded apron: dead flat over the runway itself, then a feathered skirt
  // out into the hill. Grading from the centre instead cut the strip into the slope at both ends,
  // so the threshold looked buried.
  for (const strip of AIRSTRIPS) {
    const dx = x - strip.x;
    const dz = z - strip.z;
    const along = dx * Math.sin(strip.heading) + dz * Math.cos(strip.heading);
    const across = dx * Math.cos(strip.heading) - dz * Math.sin(strip.heading);
    const overAlong = Math.max(0, Math.abs(along) - strip.length / 2) / 170;
    const overAcross = Math.max(0, Math.abs(across) - strip.width / 2) / 120;
    const over = Math.max(overAlong, overAcross);
    if (over >= 1) continue;
    const grip = 1 - over * over * (3 - 2 * over);
    h = THREE_LERP(h, strip.pad, grip);
  }
  return h;
}

function THREE_LERP(a, b, t) {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

export function isWater(x, z) {
  return groundAt(x, z) <= 0.4;
}

export function randomSpot(minHeight = 24, tries = 90) {
  for (let i = 0; i < tries; i++) {
    const x = (Math.random() - 0.5) * WORLD.size * 0.9;
    const z = (Math.random() - 0.5) * WORLD.size * 0.9;
    const h = groundAt(x, z);
    if (h > minHeight) return { x, z, h };
  }
  return { x: 0, z: 0, h: groundAt(0, 0) };
}

reseed(20261126);
