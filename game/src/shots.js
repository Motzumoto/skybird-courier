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
    const from = behindGate(gate, 330, 118);
    // Slide the camera off the gate axis so the ring and the aircraft do not sit on top of
    // each other, and the shot reads as a diagonal composition.
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(gate.ring.quaternion);
    from.addScaledVector(new THREE.Vector3(normal.z, 0, -normal.x).normalize(), 38);
    const side = new THREE.Vector3(normal.z, 0, -normal.x).normalize();
    const look = gate.position.clone().add(new THREE.Vector3(0, 34, 0)).addScaledVector(side, -96);
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
    // High enough on the glideslope to see the apron and pitch down over it, so the dash stays
    // along the bottom edge instead of owning the foreground.
    from.y = pad + 19;
    // Aim left of the centreline and hold a flare attitude, so the frame is off-axis and nose-up
    // rather than a symmetrical diagram of a runway.
    const to = new THREE.Vector3(strip.x, pad + 2, strip.z).lerp(from, 0.4);
    const pose = aim(from, to, { roll: 0.04, pitch: -0.02 });
    // No course rings in this frame: the strip is the subject, and a ring over the hill only
    // mottles the approach.
    return { ...pose, speed: 56, throttle: 0.46, camera: 'cockpit', kind: 'medevac', rings: false };
  },

  // The caldera run: low over the ash with the gate ahead and flak hanging in the air.
  ridge: ({ course }) => {
    const gate = pickLowGate(course, 2) ?? null;
    if (!gate) return { kind: 'survey' };
    const from = behindGate(gate, 520, 40);
    // Aimed off the sun's bearing, so the glare sits at the edge of frame and the sky band above
    // the ridge stays brighter than the ash below it.
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(gate.ring.quaternion);
    const across = new THREE.Vector3(normal.z, 0, -normal.x).normalize();
    const pose = aim(from, gate.position.clone().add(new THREE.Vector3(0, 34, 0)).addScaledVector(across, -190), { roll: 0.18, pitch: -0.1 });
    const bursts = [];
    const flashes = [];
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(pose.quaternion);
    // Cluster the bursts on the ridge the gate hangs over, so they read as flak off the ground
    // the run is crossing rather than as smoke adrift in the sky.
    for (let i = 0; i < 4; i++) {
      const spot = gate.position.clone();
      spot.x += (i - 1.5) * 46;
      spot.z += (i % 2 ? 34 : -30);
      spot.y = groundAt(spot.x, spot.z) + 48;
      for (let c = 0; c < 2; c++) {
        const cluster = spot.clone();
        cluster.x += c * 17 - 8;
        cluster.y += c * 13;
        bursts.push({ at: cluster, size: 7 + (c + i) % 3 * 2 });
        if ((c + i) % 2 === 0) flashes.push({ at: cluster, size: 5 + (i % 2) });
      }
    }
    const trail = [];
    for (let i = 0; i < 7; i++) {
      const puff = pose.position.clone().addScaledVector(forward, -(7 + i * 8));
      puff.x += 5.5 + i * 0.7;
      puff.y += 1.4 + i * 0.8;
      trail.push({ at: puff, size: 2.2 + i * 0.75 });
    }
    return { ...pose, speed: 84, throttle: 0.95, camera: 'cockpit', kind: 'survey', gate, hull: 44, bursts, flashes, trail };
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
    const pos = anchor.clone().addScaledVector(dir, gate ? -230 : -250).addScaledVector(across, 258);
    pos.y = anchor.y + (gate ? 4 : 26);
    const look = anchor.clone().addScaledVector(dir, gate ? 40 : 10).addScaledVector(across, 72);
    look.y += gate ? 8 : 40;
    const pose = aim(pos, look, { roll: 0.09, pitch: -0.03 });
    return { ...pose, speed: 84, throttle: 0.95, camera: 'chase', kind: 'courier', gate, zoom: 1.55 };
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

// The gate lowest over the water and off the sun's bearing, so sea fills the frame behind the
// wing and the sun sits at the edge of it instead of clipping through the lens.
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
