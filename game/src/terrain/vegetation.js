// The islands are lived in: palm groves along the shores and a few fishing hamlets of
// tin-roofed huts. Scattered deterministically, drawn as instanced meshes.

import * as THREE from 'three';
import { ISLANDS, AIRSTRIPS, groundAt } from './heightfield.js';
import { generatePalm, generateHut } from './buildProps.js';

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^= t >>> 15) >>> 0) / 4294967296;
  };
}

function clearOfStrips(x, z, margin = 70) {
  for (const strip of AIRSTRIPS) {
    const dx = x - strip.x;
    const dz = z - strip.z;
    const along = dx * Math.sin(strip.heading) + dz * Math.cos(strip.heading);
    const across = dx * Math.cos(strip.heading) - dz * Math.sin(strip.heading);
    if (Math.abs(along) < strip.length / 2 + margin && Math.abs(across) < strip.width * 3 + margin) return false;
  }
  return true;
}

export function buildVegetation(scene) {
  const random = seeded(88213);
  const palms = [];
  const huts = [];

  for (const island of ISLANDS) {
    const groves = 26;
    for (let i = 0; i < groves; i++) {
      const angle = random() * Math.PI * 2;
      const reach = island.r * (0.34 + random() * 0.62);
      const x = island.x + Math.cos(angle) * reach;
      const z = island.z + Math.sin(angle) * reach;
      const height = groundAt(x, z);
      if (height < 3 || height > 120 || !clearOfStrips(x, z)) continue;
      const cluster = 2 + Math.floor(random() * 5);
      for (let c = 0; c < cluster; c++) {
        const px = x + (random() - 0.5) * 46;
        const pz = z + (random() - 0.5) * 46;
        const ph = groundAt(px, pz);
        if (ph < 2.5 || ph > 130) continue;
        palms.push({ x: px, y: ph, z: pz, scale: 1.25 + random() * 0.95, turn: random() * Math.PI * 2 });
      }
    }

    // A hamlet or two, on the flat ground near the shore.
    if (island.r > 330) {
      for (let i = 0; i < 2; i++) {
        const angle = random() * Math.PI * 2;
        const reach = island.r * (0.42 + random() * 0.24);
        const x = island.x + Math.cos(angle) * reach;
        const z = island.z + Math.sin(angle) * reach;
        const height = groundAt(x, z);
        if (height < 4 || height > 70 || !clearOfStrips(x, z, 110)) continue;
        const count = 3 + Math.floor(random() * 4);
        for (let h = 0; h < count; h++) {
          const hx = x + (random() - 0.5) * 60;
          const hz = z + (random() - 0.5) * 60;
          const hh = groundAt(hx, hz);
          if (hh < 3 || hh > 80) continue;
          huts.push({ x: hx, y: hh, z: hz, scale: 1.05 + random() * 0.6, turn: Math.round(random() * 4) * (Math.PI / 2) + random() * 0.4 });
        }
      }
    }
  }

  const palmMesh = new THREE.InstancedMesh(generatePalm(), palmMaterial(), palms.length);
  const hutMesh = new THREE.InstancedMesh(generateHut(), hutMaterial(), huts.length);
  palmMesh.castShadow = true;
  hutMesh.castShadow = true;
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  palms.forEach((palm, i) => {
    quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), palm.turn);
    position.set(palm.x, palm.y - 0.4, palm.z);
    scale.setScalar(palm.scale);
    palmMesh.setMatrixAt(i, matrix.compose(position, quat, scale));
  });
  huts.forEach((hut, i) => {
    quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hut.turn);
    position.set(hut.x, hut.y - 0.2, hut.z);
    scale.setScalar(hut.scale);
    hutMesh.setMatrixAt(i, matrix.compose(position, quat, scale));
  });

  scene.add(palmMesh, hutMesh);
  return { palms: palmMesh, huts: hutMesh };
}

function palmMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.04, flatShading: true });
}

function hutMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.08, flatShading: true });
}
