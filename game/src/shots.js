// The four screenshots are re-flown poses: each one lines the courier up on a real gate or runway
// of the map, so a shot is a render of the game's own code and its own course.

import * as THREE from 'three';
import { AIRSTRIPS } from './terrain/heightfield.js';
import { airstripPad } from './terrain/buildIslands.js';
import { groundAt } from './terrain/heightfield.js';
import { BRIDGE } from './terrain/buildBridge.js';

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
    const from = behindGate(gate, 210, 44);
    // Slide the camera off the gate axis so the ring and the aircraft do not sit on top of
    // each other, and the shot reads as a diagonal composition.
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(gate.ring.quaternion);
    from.addScaledVector(new THREE.Vector3(normal.z, 0, -normal.x).normalize(), 22);
    const side = new THREE.Vector3(normal.z, 0, -normal.x).normalize();
    const look = gate.position.clone().add(new THREE.Vector3(0, 26, 0)).addScaledVector(side, -78);
    const pose = aim(from, look, { roll: -0.1, pitch: 0.02 });
    return { ...pose, speed: 79, throttle: 0.83, camera: 'chase', kind: 'courier', gate };
  },

  // Final approach: the lamp, the numbers and the strip filling the windscreen.
  approach: ({ strips }) => {
    const strip = strips?.[0];
    if (!strip) return { kind: 'medevac' };
    const pad = airstripPad(strip);
    const heading = strip.heading;
    // Approach from whichever end runs downhill to the sea, so the strip reads against water.
    const endA = new THREE.Vector3(strip.x + Math.sin(heading) * (strip.length / 2 + 60), 0, strip.z + Math.cos(heading) * (strip.length / 2 + 60));
    const endB = new THREE.Vector3(strip.x - Math.sin(heading) * (strip.length / 2 + 60), 0, strip.z - Math.cos(heading) * (strip.length / 2 + 60));
    const from = groundAt(endA.x, endA.z) < groundAt(endB.x, endB.z) ? endA : endB;
    from.y = pad + 11;
    const to = new THREE.Vector3(strip.x, pad + 3, strip.z).lerp(from, 0.34);
    const pose = aim(from, to, { roll: 0.04, pitch: -0.15 });
    return { ...pose, speed: 56, throttle: 0.46, camera: 'cockpit', kind: 'medevac' };
  },

  // The caldera run: low over the ash with the gate ahead and flak hanging in the air.
  ridge: ({ course }) => {
    const gate = pickLowGate(course, 2) ?? null;
    if (!gate) return { kind: 'survey' };
    const from = behindGate(gate, 520, 40);
    const pose = aim(from, gate.position.clone().add(new THREE.Vector3(0, 10, 0)), { roll: 0.18, pitch: 0.06 });
    const bursts = [];
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(pose.quaternion);
    for (let i = 0; i < 4; i++) {
      const near = pose.position.clone().addScaledVector(forward, 230 + i * 70);
      const side = i % 2 === 0 ? 1 : -1;
      near.x += side * (170 + i * 40);
      near.y += 46 + (i % 4) * 46;
      for (let c = 0; c < 3; c++) {
        const cluster = near.clone();
        cluster.x += (c - 1) * 26 + (i % 2 ? 9 : -9);
        cluster.y += (c % 2) * 14;
        cluster.z += (c - 1) * 12;
        bursts.push({ at: cluster, size: 7 + (c + i) % 3 * 3 });
      }
    }
    const trail = [];
    for (let i = 0; i < 7; i++) {
      const puff = pose.position.clone().addScaledVector(forward, -(7 + i * 8));
      puff.x += 5.5 + i * 0.7;
      puff.y += 1.4 + i * 0.8;
      trail.push({ at: puff, size: 2.2 + i * 0.75 });
    }
    return { ...pose, speed: 84, throttle: 0.95, camera: 'cockpit', kind: 'survey', gate, hull: 44, bursts, trail };
  },

  // The strait: over the span with a course gate hanging past it, so the landmark and the
  // objective sit in one frame.
  strait: ({ course }) => {
    if (!BRIDGE.midpoint) return { kind: 'courier' };
    const axis = BRIDGE.axis.clone();
    const across = new THREE.Vector3(axis.z, 0, -axis.x).normalize();
    let gate = null;
    let best = Infinity;
    for (const candidate of course?.gates ?? []) {
      const away = candidate.position.distanceTo(BRIDGE.midpoint);
      if (away < best) {
        best = away;
        gate = candidate;
      }
    }
    // Fly the line from the gate toward the span, so the ring sits dead ahead with the bridge
    // stacked beyond it, and put the camera off the shoulder to keep the two of them apart.
    // Only worth showing a gate if it hangs near the span; otherwise the bridge is the subject.
    if (gate && best > 380) gate = null;
    const anchor = gate ? gate.position : BRIDGE.midpoint;
    const dir = (gate ? BRIDGE.midpoint.clone().sub(anchor) : axis.clone()).setY(0).normalize();
    const pos = anchor.clone().addScaledVector(dir, gate ? -230 : -250).addScaledVector(across, 215);
    pos.y = anchor.y + (gate ? -5 : 20);
    const look = anchor.clone().addScaledVector(dir, gate ? 40 : 10).addScaledVector(across, 45);
    look.y += gate ? 8 : 40;
    const pose = aim(pos, look, { roll: 0.09, pitch: -0.03 });
    return { ...pose, speed: 84, throttle: 0.95, camera: 'chase', kind: 'courier', gate };
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
// The gate lowest over the water AND off the sun's bearing, so the sun sits out at the edge
// of the frame instead of clipping into it: the one that frames sea behind the wing.
const SUN_BEARING = Math.atan2(1.92, -1.52);

function pickLowGate(course, from) {
  if (!course) return null;
  let best = null;
  let bestHeight = Infinity;
  let fallback = null;
  let fallbackHeight = Infinity;
  for (const gate of course.gates.slice(from)) {
    const height = groundAt(gate.position.x, gate.position.z);
    const away = Math.cos(Math.atan2(gate.position.x, gate.position.z) - SUN_BEARING);
    if (height < fallbackHeight) {
      fallbackHeight = height;
      fallback = gate;
    }
    if (Math.abs(away) > 0.45) continue;
    if (height < bestHeight) {
      bestHeight = height;
      best = gate;
    }
  }
  return best ?? fallback;
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
