// The day's work: three kinds of sortie over the Armada Isles, each with its own brief and
// its own way of failing. The mission only counts objectives; main.js flies it.

import { ISLANDS, AIRSTRIPS } from '../terrain/heightfield.js';

export const BRIEFS = {
  courier: {
    name: 'Mail run',
    text: 'Carry the satchel from Porto Sana to Ilheu do Sino. Take every gate on the way, then land under the lamp.',
    count: 7,
    route: [
      { from: 0, to: 4, gates: 3 },
      { from: 4, to: 0, gates: 4 },
    ],
    finish: 'Ilheu do Sino',
  },
  survey: {
    name: 'Caldera survey',
    text: 'Photograph the rim of Caldeira Preta below 90 m for six seconds a pass, then come home to Porto Sana.',
    count: 2,
    route: [{ from: 0, to: 2, gates: 4 }],
    zones: [{ island: 2, radius: 300, dwell: 6 }],
    finish: 'Porto Sana',
  },
  drop: {
    name: 'Supply drop',
    text: 'The hamlets on Vela Rock are cut off. Cross the ring low and slow over the village, drop the crates, then land at Porto Sana.',
    count: 5,
    route: [{ from: 0, to: 3, gates: 3 }, { from: 3, to: 0, gates: 2 }],
    drop: { island: 3, radius: 240, slow: 62, low: 150 },
    finish: 'Porto Sana',
  },
  medevac: {
    name: 'Medevac',
    text: 'A climber is down on Serra Alta. Get there, fly the gate on the ridge, and put down on Ilheu do Sino strip without bending the floats.',
    count: 4,
    route: [{ from: 0, to: 5, gates: 2 }, { from: 5, to: 4, gates: 2 }],
    finish: 'Ilheu do Sino',
  },
};

export function createMission(kind) {
  const brief = BRIEFS[kind];
  const mission = {
    kind,
    brief,
    dwell: 0,
    zones: (brief.zones ?? []).map((zone) => ({ ...zone, done: false, time: 0 })),
    drops: (brief.drop ? [{ ...brief.drop, done: false, armed: false }] : []),
    finished: false,
    failed: false,
    landing: null,
  };
  mission.update = (dt, plane) => {
    for (const zone of mission.zones) {
      if (zone.done) continue;
      const island = ISLANDS[zone.island];
      const inside = Math.hypot(plane.position.x - island.x, plane.position.z - island.z) < zone.radius
        && plane.position.y - plane.groundHeight < 90
        && plane.position.y > plane.groundHeight + 12;
      zone.inside = inside;
      zone.time = inside ? zone.time + dt : 0;
      if (zone.time >= zone.dwell) {
        zone.done = true;
        mission.dwell += 1;
      }
    }
  };
  // A drop needs the ring taken low and slow: fast and the crates burst, high and they miss.
  mission.dropCrates = () => {
    for (const drop of mission.drops) {
      if (drop.done) continue;
      const island = ISLANDS[drop.island];
      const over = Math.hypot(plane.position.x - island.x, plane.position.z - island.z) < drop.radius;
      const low = plane.position.y - plane.groundHeight < drop.low;
      if (over && low && plane.speed < drop.slow) {
        drop.done = true;
        return 'released';
      }
      if (over && low) return 'too fast';
      if (over && !low) return 'too high';
    }
    return null;
  };
  mission.needsLanding = () => mission.zones.every((zone) => zone.done) && mission.drops.every((drop) => drop.done);
  mission.strip = () => AIRSTRIPS.find((strip) => strip.name === brief.finish);
  return mission;
}
