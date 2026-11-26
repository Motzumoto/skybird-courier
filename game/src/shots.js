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

// Behind the gate, on whichever side runs downhill (out to sea where there is sea): a plane
// against open water reads, one pinned against a cliff face does not.
function behindGate(gate, back, up) {
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(gate.ring.quaternion);
  const forwardSpot = gate.position.clone().addScaledVector(normal, back);
  const backSpot = gate.position.clone().addScaledVector(normal, -back);
  const spot = groundAt(forwardSpot.x, forwardSpot.z) < groundAt(backSpot.x, backSpot.z) ? forwardSpot : backSpot;
  spot.y = gate.position.y + up;
  return spot;
}

export const SHOTS = {
  // Cover: working the mail lane with the next gate dead ahead and the islands stacked behind.
  cover: ({ course }) => {
    const gate = course?.gates[1] ?? course?.gates[0] ?? null;
    if (!gate) return { kind: 'courier' };
    const from = behindGate(gate, 330, 58);
    const pose = aim(from, gate.position.clone().add(new THREE.Vector3(0, 12, 0)), { roll: -0.1, pitch: 0.02 });
    return { ...pose, speed: 79, throttle: 0.83, camera: 'chase', kind: 'courier', gate };
  },

  // Final approach: the lamp, the numbers and the strip filling the windscreen.
  approach: ({ strips }) => {
    const strip = strips?.[0];
    if (!strip) return { kind: 'medevac' };
    const pad = airstripPad(strip);
    const heading = strip.heading;
    // Approach from whichever end runs downhill to the sea, so the strip reads against water.
    const endA = new THREE.Vector3(strip.x + Math.sin(heading) * (strip.length / 2 + 150), 0, strip.z + Math.cos(heading) * (strip.length / 2 + 150));
    const endB = new THREE.Vector3(strip.x - Math.sin(heading) * (strip.length / 2 + 150), 0, strip.z - Math.cos(heading) * (strip.length / 2 + 150));
    const from = groundAt(endA.x, endA.z) < groundAt(endB.x, endB.z) ? endA : endB;
    from.y = pad + 19;
    const to = new THREE.Vector3(strip.x, pad + 3, strip.z);
    const pose = aim(from, to, { roll: 0.05, pitch: -0.03 });
    return { ...pose, speed: 56, throttle: 0.46, camera: 'cockpit', kind: 'medevac' };
  },

  // The caldera run: low over the ash with the gate ahead and flak hanging in the air.
  ridge: ({ course }) => {
    const gate = pickLowGate(course, 2) ?? null;
    if (!gate) return { kind: 'survey' };
    const from = behindGate(gate, 720, 96);
    const pose = aim(from, gate.position.clone().add(new THREE.Vector3(0, 16, 0)), { roll: 0.18, pitch: 0.03 });
    const bursts = [];
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(pose.quaternion);
    for (let i = 0; i < 4; i++) {
      const near = pose.position.clone().addScaledVector(forward, 150 + i * 55);
      const side = i % 2 === 0 ? 1 : -1;
      near.x += side * (150 + i * 32);
      near.y += 34 + (i % 4) * 42;
      bursts.push({ at: near, size: 13 + (i % 3) * 5 });
    }
    const trail = [];
    for (let i = 0; i < 7; i++) {
      const puff = pose.position.clone().addScaledVector(forward, -(7 + i * 8));
      puff.x += 5.5 + i * 0.7;
      puff.y += 1.4 + i * 0.8;
      trail.push({ at: puff, size: 2.2 + i * 0.75 });
    }
    return { ...pose, speed: 84, throttle: 0.95, camera: 'chase', kind: 'survey', gate, hull: 44, bursts, trail };
  },

  // Windward cliffs: the courier on the coast run, sea and rock below the wing.
  cliffs: ({ course }) => {
    const gate = pickLonelyGate(course, 3) ?? course?.gates[5] ?? null;
    if (!gate) return { kind: 'courier' };
    const from = behindGate(gate, 560, 74);
    const pose = aim(from, gate.position.clone().add(new THREE.Vector3(0, 16, 0)), { roll: -0.14, pitch: 0.02 });
    return { ...pose, speed: 76, throttle: 0.72, camera: 'chase', kind: 'courier', gate };
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

// The gate with the most room around it, so no second ring crops into the frame.
function pickLonelyGate(course, from) {
  if (!course) return null;
  let best = null;
  let bestGap = -1;
  for (const gate of course.gates.slice(from)) {
    let gap = Infinity;
    for (const other of course.gates) {
      if (other === gate) continue;
      gap = Math.min(gap, other.position.distanceTo(gate.position));
    }
    if (gap > bestGap) {
      bestGap = gap;
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
