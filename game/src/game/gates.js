// The mail gates: rings strung from island to island, each one an arch of light over the water
// or the ridge. A ring counts when the nose passes through its mouth.

import * as THREE from 'three';
import { PLAY } from '../config.js';
import { groundAt, ISLANDS } from '../terrain/heightfield.js';

const RING_GEO = new THREE.TorusGeometry(PLAY.ringRadius, 2.2, 8, 36);
const RING_MAT = new THREE.MeshStandardMaterial({
  color: '#ffcf7a',
  emissive: '#ffa53c',
  emissiveIntensity: 2.1,
  roughness: 0.35,
  metalness: 0.35,
});
const NEXT_MAT = new THREE.MeshStandardMaterial({
  color: '#fff4d6',
  emissive: '#ffe6ae',
  emissiveIntensity: 3.4,
  roughness: 0.3,
});

function arch(x, z, yaw, height) {
  const material = RING_MAT.clone();
  material.transparent = true;
  const ring = new THREE.Mesh(RING_GEO, material);
  ring.position.set(x, height, z);
  ring.rotation.y = yaw;
  const halo = new THREE.PointLight('#ffbe63', 26, 200, 2);
  halo.position.copy(ring.position);
  const group = new THREE.Group();
  group.add(ring, halo);
  ring.userData.light = halo;
  return { group, ring };
}

// A tiny seeded PRNG keeps the course identical run to run, so a screenshot pose can trust a gate.
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildCourse(scene, route) {
  const gates = [];
  const random = seeded(route.length * 7919 + 131);
  const root = new THREE.Group();
  for (const leg of route) {
    const from = ISLANDS[leg.from];
    const to = ISLANDS[leg.to];
    const steps = leg.gates;
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1);
      const x = THREE.MathUtils.lerp(from.x, to.x, t) + (random() - 0.5) * 150;
      const z = THREE.MathUtils.lerp(from.z, to.z, t) + (random() - 0.5) * 150;
      const ground = Math.max(0, groundAt(x, z));
      const height = ground + 54 + random() * 68;
      const yaw = Math.atan2(to.x - from.x, to.z - from.z);
      const { group, ring } = arch(x, z, yaw, height);
      gates.push({ ring, group, position: ring.position.clone(), passed: false, radius: PLAY.ringRadius });
      root.add(group);
    }
  }
  scene.add(root);

  return {
    root,
    gates,
    index: 0,
    passed: 0,
    // Only the next gate burns: the rest fade back so the line of flight stays readable.
    highlight(index) {
      gates.forEach((gate, i) => {
        const active = i === index;
        gate.ring.material = (active ? NEXT_MAT : RING_MAT).clone();
        gate.ring.material.transparent = true;
        gate.ring.material.opacity = active ? 1 : gate.passed ? 0.34 : 0.5;
        gate.ring.userData.light.intensity = active ? 70 : 10;
      });
    },
    // For a screenshot: show only the gate being lined up and the one after it.
    solo(keep) {
      const next = gates[gates.indexOf(keep) + 1];
      for (const gate of gates) gate.group.visible = gate === keep || gate === next;
    },
    check(plane) {
      const gate = gates[this.index];
      if (!gate || gate.passed) return null;
      const local = gate.position.clone().sub(plane.position);
      const distance = local.length();
      if (distance > gate.radius * 0.94) return null;
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(gate.ring.quaternion);
      const offset = Math.abs(local.dot(normal));
      if (offset > 11) return null;
      gate.passed = true;
      gate.ring.material = new THREE.MeshStandardMaterial({ color: '#7ce0a3', emissive: '#37c47a', emissiveIntensity: 1.1, roughness: 0.6, transparent: true, opacity: 0.34 });
      gate.ring.userData.light.color.set('#7ce0a3');
      this.passed += 1;
      this.index += 1;
      this.highlight(this.index);
      return gate;
    },
  };
}
