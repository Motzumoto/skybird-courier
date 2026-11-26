// The instrument panel: speed, altitude, heading, throttle, fuel, hull, the minimap and the brief.

import { ISLANDS, AIRSTRIPS, groundAt } from '../terrain/heightfield.js';

const SPEED_ALARM = 40;
const RADAR_RANGE = 2600;

export function createHud(mission) {
  const el = {
    root: document.getElementById('hud'),
    speed: document.getElementById('g-speed'),
    speedLabel: document.querySelector('.gauge.speed u'),
    alt: document.getElementById('g-alt'),
    heading: document.getElementById('g-hdg'),
    fuel: document.getElementById('g-fuel'),
    dmg: document.getElementById('g-dmg'),
    thr: document.getElementById('g-thr'),
    name: document.getElementById('m-name'),
    text: document.getElementById('m-text'),
    progress: document.querySelector('#m-progress i'),
    count: document.getElementById('m-count'),
    bearing: document.getElementById('m-bearing'),
    banner: document.getElementById('banner'),
    garble: document.getElementById('garble'),
    gauges: [...document.querySelectorAll('.gauge')],
    map: document.getElementById('map'),
  };

  el.name.textContent = mission.brief.name;
  el.text.textContent = mission.brief.text;
  const mapCtx = el.map.getContext('2d');

  let bannerTimer = null;
  const pad = (value, size) => String(Math.max(0, Math.round(value))).padStart(size, '0');

  return {
    root: el.root,
    refresh(plane, course, gatesDone, totalGates) {
      el.speed.textContent = pad(plane.speed * 1.944, 3);
      el.alt.textContent = pad((plane.position.y - plane.groundHeight) * 3.281, 4);
      el.heading.textContent = pad(plane.quaternion ? headingFromQuaternion(plane.quaternion) : 0, 3);
      el.thr.style.height = `${Math.round(plane.throttle * 100)}%`;
      el.fuel.style.width = `${Math.max(0, plane.fuel * 100)}%`;
      el.dmg.style.width = `${Math.min(100, 100 - plane.hull)}%`;

      const speedAlarm = plane.speed < SPEED_ALARM && plane.alive;
      el.gauges[0].classList.toggle('alarm', speedAlarm);
      el.speedLabel.classList.toggle('on', speedAlarm);
      const pullUp = plane.position.y - plane.groundHeight < 42 && plane.alive && plane.sinkRate > 2;
      el.gauges[1].classList.toggle('alarm', pullUp);
      el.gauges[2].classList.toggle('alarm', false);
      el.garble.classList.toggle('on', (plane.hull < 55 || speedAlarm) && plane.alive);

      const fraction = totalGates > 0 ? gatesDone / totalGates : 0;
      el.progress.style.width = `${Math.round(fraction * 100)}%`;
      el.count.textContent = `${gatesDone} / ${totalGates}`;
      const gate = course?.gates[course.index];
      if (gate) {
        const distance = Math.round(gate.position.distanceTo(plane.position));
        const bearing = ((Math.atan2(gate.position.x - plane.position.x, -(gate.position.z - plane.position.z)) * 180) / Math.PI + 360) % 360;
        const off = Math.round((bearing - headingFromQuaternion(plane.quaternion) + 540) % 360 - 180);
        el.bearing.textContent = `GATE ${distance} M ${off === 0 ? 'AHEAD' : `${Math.abs(off)}° ${off < 0 ? 'LEFT' : 'RIGHT'}`}`;
      } else {
        el.bearing.textContent = 'ALL GATES CLEAR';
      }
      this.drawMap(plane, course);
    },
    drawMap(plane, course) {
      const size = 176;
      const half = size / 2;
      mapCtx.clearRect(0, 0, size, size);
      mapCtx.save();
      mapCtx.beginPath();
      mapCtx.arc(half, half, half - 1, 0, Math.PI * 2);
      mapCtx.clip();
      mapCtx.fillStyle = 'rgba(6, 24, 31, 0.86)';
      mapCtx.fillRect(0, 0, size, size);

      const scale = (half - 6) / RADAR_RANGE;
      const px = plane.position.x;
      const pz = plane.position.z;

      mapCtx.fillStyle = 'rgba(126, 158, 120, 0.42)';
      for (const island of ISLANDS) {
        const x = half + (island.x - px) * scale;
        const y = half + (island.z - pz) * scale;
        mapCtx.beginPath();
        mapCtx.arc(x, y, Math.max(3, island.r * scale), 0, Math.PI * 2);
        mapCtx.fill();
      }

      mapCtx.strokeStyle = 'rgba(255, 208, 130, 0.85)';
      mapCtx.lineWidth = 2;
      for (const gate of course?.gates ?? []) {
        if (gate.passed) continue;
        const x = half + (gate.position.x - px) * scale;
        const y = half + (gate.position.z - pz) * scale;
        if (gate === course.gates[course.index]) {
          mapCtx.beginPath();
          mapCtx.arc(x, y, 5, 0, Math.PI * 2);
          mapCtx.stroke();
        } else {
          mapCtx.fillStyle = 'rgba(255, 208, 130, 0.5)';
          mapCtx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
      }

      for (const strip of AIRSTRIPS) {
        const x = half + (strip.x - px) * scale;
        const y = half + (strip.z - pz) * scale;
        mapCtx.strokeStyle = 'rgba(124, 224, 163, 0.9)';
        mapCtx.lineWidth = 3;
        mapCtx.beginPath();
        mapCtx.moveTo(x - 4, y - 4);
        mapCtx.lineTo(x + 4, y + 4);
        mapCtx.stroke();
      }

      mapCtx.fillStyle = '#fff6de';
      mapCtx.beginPath();
      mapCtx.moveTo(half, half - 6);
      mapCtx.lineTo(half - 4.5, half + 5);
      mapCtx.lineTo(half + 4.5, half + 5);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.restore();
    },
    banner(text) {
      el.banner.textContent = text;
      el.banner.classList.remove('show');
      void el.banner.offsetWidth;
      el.banner.classList.add('show');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => el.banner.classList.remove('show'), 2000);
    },
    toggle() {
      el.root.classList.toggle('hidden-hud');
    },
  };
}

// Compass heading of the nose: the quaternion turned into (0, 0, -1), read as degrees from north.
function headingFromQuaternion(q) {
  const fx = -2 * q.y * q.w - q.z * q.x;
  const fz = -(q.w * q.w) + q.x * q.y + q.y * q.y;
  const degrees = (Math.atan2(fx, -fz) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

export { groundAt };
