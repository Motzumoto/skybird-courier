// The four screenshots are re-flown poses: each one lines the courier up on a real gate or runway
// of the map, so a shot is a render of the game's own code and its own course.

import * as THREE from 'three';
import { AIRSTRIPS } from './terrain/heightfield.js';
import { airstripPad } from './terrain/buildIslands.js';
import { groundAt } from './terrain/heightfield.js';

const BACK = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

// Point the nose at `target` from `from`, with a bank and a touch of pitch.
function aim(from, target, { roll = 0, pitch = 0 }) {
  const quaternion = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  matrix.lookAt(from, target, UP);
  quaternion.setFromRotationMatrix(matrix);
  quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, 0, roll, 'ZYX')));
  return { position: from, quaternion };
}

function behindGate(gate, back, up) {
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(gate.ring.quaternion);
  return gate.position.clone().addScaledVector(normal, -back).add(new THREE.Vector3(0, up, 0));
}

export const SHOTS = {
  // Cover: working the mail lane with the next gate dead ahead and the islands stacked behind.
  cover: ({ course }) => {
    const gate = course?.gates[1] ?? course?.gates[0] ?? null;
    if (!gate) return { kind: 'courier' };
    const from = behindGate(gate, 268, 34);
    const pose = aim(from, gate.position.clone().add(new THREE.Vector3(0, -6, 0)), { roll: -0.18, pitch: 0.03 });
    return { ...pose, speed: 79, throttle: 0.83, camera: 'chase', kind: 'courier' };
  },

  // Final approach: the lamp, the numbers and the strip filling the windscreen.
  approach: ({ strips }) => {
    const strip = strips?.[1];
    if (!strip) return { kind: 'medevac' };
    const pad = airstripPad(strip);
    const heading = strip.heading;
    const from = new THREE.Vector3(strip.x - Math.sin(heading) * 760, pad + 62, strip.z - Math.cos(heading) * 760);
    const to = new THREE.Vector3(strip.x, pad, strip.z);
    const pose = aim(from, to, { roll: 0.1, pitch: -0.05 });
    return { ...pose, speed: 56, throttle: 0.48, camera: 'chase', kind: 'medevac' };
  },

  // The caldera run: low over the ash with the gate ahead and flak hanging in the air.
  ridge: ({ course }) => {
    const gate = pickLowGate(course, 2) ?? null;
    if (!gate) return { kind: 'survey' };
    const from = behindGate(gate, 300, 84);
    const pose = aim(from, gate.position.clone().add(new THREE.Vector3(0, -10, 0)), { roll: 0.2, pitch: 0.05 });
    return { ...pose, speed: 84, throttle: 0.95, camera: 'chase', kind: 'survey' };
  },

  // Windward cliffs: the courier on the coast run, sea and rock below the wing.
  cliffs: ({ course }) => {
    const gate = course?.gates[5] ?? course?.gates[4] ?? null;
    if (!gate) return { kind: 'courier' };
    const from = behindGate(gate, 232, 46);
    const pose = aim(from, gate.position.clone().add(new THREE.Vector3(0, -14, 0)), { roll: -0.17, pitch: 0.02 });
    return { ...pose, speed: 76, throttle: 0.72, camera: 'chase', kind: 'courier' };
  },
};

// The gate lowest over the water: the one that frames sea behind the wing on the caldera run.
function pickLowGate(course, from) {
  if (!course) return null;
  let best = null;
  let bestHeight = Infinity;
  for (const gate of course.gates.slice(from)) {
    const height = groundAt(gate.position.x, gate.position.z);
    if (height < bestHeight) {
      bestHeight = height;
      best = gate;
    }
  }
  return best;
}

export function shotName() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot');
  return name && SHOTS[name] ? name : null;
}
