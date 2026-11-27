// Wingtip vapour and passing-air streaks: the secondary motion cues that make a still frame and a
// moving frame both read as fast flight. update(dt, plane, intensity) takes the pull intensity
// (0..1) directly each frame; clear() wipes everything so a new sortie never inherits an old ribbon.

import * as THREE from 'three';

const SEGMENTS = 24;
const SAMPLES = SEGMENTS + 1;
const TIP = new THREE.Vector3(7.4, 0.6, 0.4);
const TIP_WIDTH = 0.95;
const TAPER = SEGMENTS / 2 + 2; // full width at the tip, gone just past mid-strip
const STREAKS = 44;
const NEAR = 30;
const FAR = 140;
const BEHIND = 25;
const FORWARD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);
const tip = new THREE.Vector3();
const dir = new THREE.Vector3();
const side = new THREE.Vector3();
const lateral = new THREE.Vector3();
const radialUp = new THREE.Vector3();

// Seeded, so clear() followed by the same update sequence renders the same field every time.
function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildRibbon(scene, sideSign) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(SAMPLES * 6);
  const colors = new Float32Array(SAMPLES * 8);
  for (let i = 0; i < SAMPLES; i++) {
    const strength = Math.max(0, 1 - i / SEGMENTS) * 1.15;
    // Static per-sample colours: bright ridge over a faint belly, fading down the tail.
    colors.set([1, 1, 1, strength, 1, 1, 1, strength * 0.45], i * 8);
  }
  const indices = [];
  for (let i = 0; i < SEGMENTS; i++) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return { mesh, positions, samples: new Float32Array(SAMPLES * 3), filled: 0, sideSign };
}

function updateRibbon(ribbon, plane) {
  tip.copy(TIP).multiplyScalar(ribbon.sideSign).applyQuaternion(plane.quaternion).add(plane.position);
  ribbon.samples.copyWithin(3, 0, SEGMENTS * 3);
  ribbon.samples[0] = tip.x; ribbon.samples[1] = tip.y; ribbon.samples[2] = tip.z;
  const known = Math.min(ribbon.filled, SEGMENTS);
  // Unwritten tail slots collapse onto the last known point, so a fresh ribbon starts as a stub
  // at the wingtip rather than a garbage line out to the origin.
  for (let i = known + 1; i <= SEGMENTS; i++) ribbon.samples.copyWithin(i * 3, known * 3, known * 3 + 3);
  ribbon.filled = Math.min(ribbon.filled + 1, SAMPLES);
  for (let i = 0; i < SAMPLES; i++) {
    const p = i * 3;
    const a = Math.max(i - 1, 0) * 3;
    const b = Math.min(i + 1, SEGMENTS) * 3;
    dir.set(ribbon.samples[b] - ribbon.samples[a], ribbon.samples[b + 1] - ribbon.samples[a + 1], ribbon.samples[b + 2] - ribbon.samples[a + 2]);
    // Vertical ribbon through each sample: near edge-on from behind, full-face from beside.
    side.copy(UP).addScaledVector(dir, -UP.dot(dir) / (dir.lengthSq() || 1));
    if (side.lengthSq() < 1e-6) side.set(0, 1, 0);
    side.normalize().multiplyScalar(TIP_WIDTH * Math.max(0, 1 - (i - 2) / TAPER));
    const v = i * 6;
    ribbon.positions[v] = ribbon.samples[p] - side.x; ribbon.positions[v + 3] = ribbon.samples[p] + side.x;
    ribbon.positions[v + 1] = ribbon.samples[p + 1] - side.y; ribbon.positions[v + 4] = ribbon.samples[p + 1] + side.y;
    ribbon.positions[v + 2] = ribbon.samples[p + 2] - side.z; ribbon.positions[v + 5] = ribbon.samples[p + 2] + side.z;
  }
  ribbon.mesh.geometry.attributes.position.needsUpdate = true;
}

function buildStreaks(scene) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * 6), 3));
  const mesh = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#dff2f6', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
}

export function createVapor(scene) {
  const ribbons = [buildRibbon(scene, 1), buildRibbon(scene, -1)];
  const streaks = buildStreaks(scene);
  const offsets = Array.from({ length: STREAKS }, () => new THREE.Vector3());
  const lengths = new Float32Array(STREAKS);
  let rng = mulberry32(20261126);

  const reseed = (offset, index) => {
    const angle = rng() * Math.PI * 2;
    const radius = NEAR + rng() * (FAR - NEAR);
    const ahead = rng() * (FAR + BEHIND) - BEHIND;
    lateral.crossVectors(dir, UP);
    if (lateral.lengthSq() < 1e-4) lateral.set(1, 0, 0);
    lateral.normalize();
    radialUp.crossVectors(lateral, dir);
    offset.copy(dir).multiplyScalar(ahead).addScaledVector(lateral, Math.cos(angle) * radius).addScaledVector(radialUp, Math.sin(angle) * radius);
    lengths[index] = 6 + rng() * 9;
  };

  // intensity 0..1 is how hard the aircraft is working: level flight leaves nothing behind.
  const update = (dt, plane, intensity) => {
    const pull = THREE.MathUtils.clamp(intensity, 0, 1);
    const trailOpacity = pull < 0.12 ? 0 : Math.min(1, (pull - 0.12) / 0.5) * 0.8;
    for (const ribbon of ribbons) {
      ribbon.mesh.visible = trailOpacity > 0;
      ribbon.mesh.material.opacity = trailOpacity;
      if (trailOpacity > 0) updateRibbon(ribbon, plane);
    }
    dir.copy(FORWARD).applyQuaternion(plane.quaternion);
    const drift = plane.speed * dt;
    const positions = streaks.geometry.attributes.position.array;
    const streakOpacity = pull < 0.1 ? 0 : Math.min(1, (pull - 0.1) / 0.5) * 0.5;
    streaks.visible = streakOpacity > 0;
    streaks.material.opacity = streakOpacity;
    for (let i = 0; i < STREAKS; i++) {
      const offset = offsets[i];
      // Offsets ride the aircraft in world orientation, so the air streams past it.
      offset.addScaledVector(dir, -drift);
      if (-offset.dot(dir) < -BEHIND || offset.lengthSq() > (FAR + 40) ** 2) reseed(offset, i);
      const v = i * 6;
      positions[v] = plane.position.x + offset.x; positions[v + 3] = positions[v] + dir.x * lengths[i];
      positions[v + 1] = plane.position.y + offset.y; positions[v + 4] = positions[v + 1] + dir.y * lengths[i];
      positions[v + 2] = plane.position.z + offset.z; positions[v + 5] = positions[v + 2] + dir.z * lengths[i];
    }
    streaks.geometry.attributes.position.needsUpdate = true;
  };

  const clear = () => {
    rng = mulberry32(20261126);
    for (const ribbon of ribbons) { ribbon.filled = 0; ribbon.samples.fill(0); ribbon.mesh.visible = false; ribbon.mesh.material.opacity = 0; }
    streaks.visible = false;
    streaks.material.opacity = 0;
    for (let i = 0; i < STREAKS; i++) reseed(offsets[i], i);
    streaks.geometry.attributes.position.needsUpdate = true;
  };

  return { trails: ribbons.map(r => r.mesh), streaks, update, clear };
}
