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
  mission.needsLanding = () => mission.zones.every((zone) => zone.done);
  mission.strip = () => AIRSTRIPS.find((strip) => strip.name === brief.finish);
  return mission;
}
