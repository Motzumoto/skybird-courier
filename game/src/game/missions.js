// The day's work: four kinds of sortie over the Armada Isles, each with its own brief and
// its own way of failing, from a first gate-check to the run that wants the crates on the village.
// A mission only counts objectives; main.js flies the sortie and the gates do the routing.

import { ISLANDS, AIRSTRIPS } from '../terrain/heightfield.js';

// A brief, in full, in one place. Each entry says what the sortie asks for and how it is judged:
//   count  how many objectives the brief carries. It is filled in below from the legs, zones and
//          drops, so the number cannot drift from the brief itself.
//   route  legs of the course: `from` and `to` are indexes into ISLANDS, `gates` is how many
//          rings hang on that leg, so the route reads as "out to island 4 and back".
//   zones  low passes to hold for `dwell` seconds inside `radius` of the island.
//   drop   a crate release: inside `radius`, under `low` metres and slower than `slow`.
//   finish the strip the sortie has to end on.

export const BRIEFS = {
  courier: {
    name: 'Mail run',
    text: 'Carry the satchel from Porto Sana to Ilheu do Sino. Take every gate on the way, then land under the lamp.',
    route: [
      { from: 0, to: 4, gates: 3 },
      { from: 4, to: 0, gates: 4 },
    ],
    finish: 'Ilheu do Sino',
  },
  survey: {
    name: 'Caldera survey',
    text: 'Photograph the rim of Caldeira Preta below 90 m for six seconds a pass, then come home to Porto Sana.',
    route: [{ from: 0, to: 2, gates: 4 }],
    zones: [{ island: 2, radius: 300, dwell: 6 }],
    finish: 'Porto Sana',
  },
  drop: {
    name: 'Supply drop',
    text: 'The hamlets on Vela Rock are cut off. Cross the ring low and slow over the village, drop the crates, then land at Porto Sana.',
    route: [{ from: 0, to: 3, gates: 3 }, { from: 3, to: 0, gates: 2 }],
    drop: { island: 3, radius: 240, slow: 62, low: 150 },
    finish: 'Porto Sana',
  },
  medevac: {
    name: 'Medevac',
    text: 'A climber is down on Serra Alta. Get there, fly the gate on the ridge, and put down on Ilheu do Sino strip without bending the floats.',
    route: [{ from: 0, to: 5, gates: 2 }, { from: 5, to: 4, gates: 2 }],
    finish: 'Ilheu do Sino',
  },
};

// Every brief counts itself: route gates, plus a pass or a drop where it asks for one.
for (const brief of Object.values(BRIEFS)) {
  brief.count = brief.route.reduce((total, leg) => total + leg.gates, 0)
    + (brief.zones?.length ?? 0)
    + (brief.drop ? 1 : 0);
}

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
  mission.dropCrates = (plane) => {
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
  // The one definition of where the sortie stands: the panel, the finish gate and the report all
  // read this, so a mission can never tally one number and finish on another.
  mission.tally = (course) => ({
    done: course.passed + mission.zones.filter((zone) => zone.done).length + mission.drops.filter((drop) => drop.done).length,
    total: course.gates.length + mission.zones.length + mission.drops.length,
  });
  // Every ring, every pass, every crate: readiness is just the tally being full.
  mission.ready = (course) => {
    const { done, total } = mission.tally(course);
    return done >= total;
  };
  mission.strip = () => AIRSTRIPS.find((strip) => strip.name === brief.finish);

  // Where the wheels have to go: true when the aircraft is down, slow and on the finish strip.
  mission.onFinishStrip = (plane) => {
    const strip = mission.strip();
    if (!strip) return null;
    const dx = plane.position.x - strip.x;
    const dz = plane.position.z - strip.z;
    const along = dx * Math.sin(strip.heading) + dz * Math.cos(strip.heading);
    const across = dx * Math.cos(strip.heading) - dz * Math.sin(strip.heading);
    const onStrip = Math.abs(along) < strip.length / 2 && Math.abs(across) < strip.width;
    if (!onStrip || !plane.onGround || plane.speed >= 26 || !plane.alive) return null;
    return plane.lastImpact < 5 ? 'greaser' : 'down';
  };

  // The running hint for whatever the sortie is waiting on, or null when nothing is close.
  mission.hint = (plane) => {
    const near = (island, radius) => Math.hypot(plane.position.x - island.x, plane.position.z - island.z) < radius;
    const zone = mission.zones.find((entry) => !entry.done);
    if (zone && near(ISLANDS[zone.island], zone.radius) && !zone.inside) {
      return 'Climb below ninety metres and hold the pass over the rim.';
    }
    const drop = mission.drops.find((entry) => !entry.done);
    if (drop && near(ISLANDS[drop.island], drop.radius * 1.5)) {
      return 'Over the village: slow under 120 kt, low, then G to release.';
    }
    return null;
  };
  return mission;
}
