// Boot, the frame loop and the sortie rules: gates, survey passes, landings, crashes and the report.

import * as THREE from 'three';
import { PLAY, MISSION_KINDS } from './config.js';
import { createRenderer, buildSky, applyCameraSettings } from './render/scene.js';
import { createCameraRig, createFlare } from './render/cameras.js';
import { buildCockpit } from './render/cockpit.js';
import { buildTerrain, animateSea, airstripPad } from './terrain/buildIslands.js';
import { buildVegetation } from './terrain/vegetation.js';
import { buildBridge } from './terrain/buildBridge.js';
import { AIRSTRIPS, ISLANDS, groundAt } from './terrain/heightfield.js';
import { buildPlane } from './aircraft/buildPlane.js';
import { createPlane } from './aircraft/flightModel.js';
import { buildCourse } from './game/gates.js';
import { createMission } from './game/missions.js';
import { buildTraffic } from './game/traffic.js';
import { createThreat } from './game/threat.js';
import { createSpray } from './render/spray.js';
import { createDamage } from './aircraft/damage.js';
import { createHud } from './ui/hud.js';
import { createScreens } from './ui/screens.js';
import { createAudio } from './audio/engineSound.js';
import { recordSortie } from './save/logbook.js';
import { SHOTS, shotName } from './shots.js';
import { bindInput, readInput, inputIdle, clearInput } from './input.js';

const canvas = document.getElementById('sky');
const renderer = createRenderer(canvas);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.4, 12000);
applyCameraSettings(camera);
const sky = buildSky(scene);
const terrain = buildTerrain(scene);
buildVegetation(scene);
buildBridge(scene);
const sea = terrain.children.find((child) => child.userData?.wave);
const traffic = buildTraffic(scene);
const threat = createThreat(scene);
const spray = createSpray(scene);
let damage = null;
const rig = createCameraRig(camera);
const cockpit = buildCockpit();
scene.add(camera);
const flare = createFlare(camera, sky.sun.position.clone().normalize());
camera.add(cockpit);
cockpit.visible = false;
const screens = createScreens();
const audio = createAudio();

let plane = null;
let course = null;
let mission = null;
let hud = null;
let state = 'title';
let elapsed = 0;
// ?mission=drop pins a sortie, which the tooling uses to fly one specific brief.
const PINNED = new URLSearchParams(location.search).get('mission');
const pickKind = () => (MISSION_KINDS.includes(PINNED) ? PINNED : MISSION_KINDS[Math.floor(Math.random() * MISSION_KINDS.length)]);
let chosen = pickKind();
let ringCountdown = 0;
let lastHudPaint = 0;
let shotSmoke = false;

const spawnPose = (() => {
  const strip = AIRSTRIPS[0];
  const position = new THREE.Vector3(strip.x, airstripPad(strip) + 1.7, strip.z + 120);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, strip.heading, 0, 'YXZ'));
  return { position, quaternion, speed: 78, throttle: 1 };
})();

function mount(kind, pose) {
  if (plane) scene.remove(plane.mesh);
  if (course) scene.remove(course.root);
  threat.reset();

  mission = createMission(kind);
  course = buildCourse(scene, mission.brief.route);
  course.highlight(0);
  hud = createHud(mission);
  ringCountdown = 1.2;

  const mesh = buildPlane();
  scene.add(mesh);
  plane = createPlane(mesh, pose ?? spawnPose);
  plane.cargo = kind === 'courier' ? 0.92 : kind === 'survey' ? 1 : 1.06;
  damage?.clear();
  damage = createDamage(plane, scene);
  if (pose?.speed) plane.speed = pose.speed;
  if (pose?.throttle !== undefined) plane.setThrottle(pose.throttle);
  rig.mode = pose?.camera ?? 'chase';
  rig.update(plane, 0.016, 0.5, true);
  elapsed = 0;
}

// Gates plus whatever else the brief asks for: the counter is the day's work, not just the rings.
const objectivesDone = () => (mission?.drops ?? []).filter((drop) => drop.done).length;
const objectiveCount = () => course.passed + objectivesDone();
const objectiveTotal = () => course.gates.length + (mission?.drops?.length ?? 0);

function begin() {
  audio.start();
  chosen = pickKind();
  screens.hideAll();
  const hudEl = document.getElementById('hud');
  hudEl.classList.remove('hidden-hud');
  mount(chosen);
  state = 'flying';
  hud.banner('CLEARED FOR THE RUN');
}

function endSortie(completed, headline) {
  if (state !== 'flying') return;
  state = 'over';
  if (plane.alive === false) plane.mesh.userData.prop.rotation.z = 0.4;
  const book = recordSortie({ completed, gates: course.passed, seconds: elapsed, chosen });
  screens.report({
    completed,
    headline,
    detail: `${mission.brief.name} flown in ${Math.round(elapsed)}s with ${Math.max(0, Math.round(plane.hull))}% airframe left. ${book.sorties} sorties in the logbook.`,
    gates: course.passed,
    seconds: elapsed,
    hull: plane.hull,
    missions: course.gates.length,
  });
}

function checkLanding() {
  const strip = mission.strip();
  if (!strip) return false;
  const dx = plane.position.x - strip.x;
  const dz = plane.position.z - strip.z;
  const along = dx * Math.sin(strip.heading) + dz * Math.cos(strip.heading);
  const across = dx * Math.cos(strip.heading) - dz * Math.sin(strip.heading);
  const onStrip = Math.abs(along) < strip.length / 2 && Math.abs(across) < strip.width;
  if (onStrip && plane.onGround && plane.speed < 26 && plane.alive) {
    hud.banner(plane.lastImpact < 5 ? 'GREASER — TEXTBOOK LANDING' : 'DOWN — THE FLOATS HELD');
    return true;
  }
  return false;
}

function rules(dt) {
  mission.update(dt, plane);

  if (ringCountdown > 0) ringCountdown -= dt;

  const beaten = course.check(plane);
  if (beaten) {
    audio.chime();
    hud.banner(`GATE ${course.passed}/${course.gates.length}`);
    rig.kick(0.5);
  }

  const surveyDone = mission.zones.every((zone) => zone.done);
  if (course.index >= course.gates.length) {
    if (mission.needsLanding()) {
      hud.brief(`All passes flown. Put down on ${mission.brief.finish} strip, wing low, gear down.`);
      if (checkLanding()) {
        audio.thud(0.7);
        return endSortie(true, 'Landed');
      }
    }
  }

  if (mission.zones.length) {
    const zone = mission.zones.find((z) => !z.done);
    if (zone) {
      const island = ISLANDS[zone.island];
      const distance = Math.hypot(plane.position.x - island.x, plane.position.z - island.z);
      if (!zone.done && distance < zone.radius && !zone.inside) {
        hud.brief('Climb below ninety metres and hold the pass over the rim.');
      }
    }
  }

  const drop = mission.drops?.find((entry) => !entry.done);
  if (drop) {
    const island = ISLANDS[drop.island];
    const distance = Math.hypot(plane.position.x - island.x, plane.position.z - island.z);
    if (distance < drop.radius * 1.5) hud.brief('Over the village: slow under 120 kt, low, then G to release.');
  }

  const flakDamage = threat.update(dt, plane, mission.kind === 'survey' && course.index > 1);
  if (flakDamage > 0) {
    damage.apply(flakDamage, 'The flak found the engine.');
    audio.thud(0.5);
    rig.kick(1.3);
    hud.banner(plane.hull < 30 ? 'FLAK — ENGINE SMOKING' : 'FLAK — AIRFRAME HIT');
  }

  if (!plane.alive) {
    rig.kick(2.2);
    audio.thud(1.4);
    endSortie(false, plane.crashReason ?? 'The airframe is lost.');
  }

  if (plane.fuel <= 0.0001 && !plane.alive) return;

  const strip = mission.strip();
  if (strip && course.index >= course.gates.length) {
    const distance = Math.hypot(plane.position.x - strip.x, plane.position.z - strip.z);
    if (distance < 2200 && plane.position.y - plane.groundHeight < 120) {
      hud.banner('FINAL — LAND AT THE LAMP');
    }
  }
}

const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  if (state === 'flying' || state === 'over') {
    elapsed += dt;
    audio.update(plane.throttle, plane.speed);
    plane.speedCap = damage?.power() ?? 1;
    const wasDown = plane.onGround;
    if (state === 'flying') plane.update(dt, readInput());
    else plane.update(dt, inputIdle);
    if (plane.onGround && !wasDown && plane.alive) {
      const heavy = plane.lastImpact > 5;
      const gear = plane.position.clone();
      gear.y = plane.groundHeight + 0.3;
      spray.burst(gear, heavy, plane.onWater);
      rig.kick(heavy ? 1.5 : 0.7);
      audio.thud(heavy ? 0.8 : 0.45);
    }
    spray.update(dt);
    rig.update(plane, dt, plane.speed / 140);
    damage?.update(dt);
    damage?.frame(dt);
    cockpit.visible = rig.mode === 'cockpit';
    plane.mesh.visible = rig.mode !== 'cockpit';
    traffic.update(time, dt);
    animateSea(sea, time);
    if (state === 'flying') rules(dt);
    if (hud && time - lastHudPaint > 0.06) {
      lastHudPaint = time;
      hud.refresh(plane, course, objectiveCount(), objectiveTotal());
    }
  } else if (state === 'title') {
    const orbit = time * 0.06;
    camera.position.set(Math.sin(orbit) * 2400, 760, Math.cos(orbit) * 2400);
    camera.lookAt(0, 220, 0);
    traffic.update(time, dt);
    animateSea(sea, time);
  } else if (state === 'shot') {
    traffic.update(time, dt);
    animateSea(sea, time);
    rig.update(plane, dt, 0.5, true);
    if (shotSmoke) {
      damage?.update(dt * 2.4);
      damage?.frame(dt * 0.22);
    }
    cockpit.visible = rig.mode === 'cockpit';
    plane.mesh.visible = rig.mode !== 'cockpit';
    if (hud && time - lastHudPaint > 0.06) {
      lastHudPaint = time;
      hud.refresh(plane, course, objectiveCount(), objectiveTotal());
    }
  }

  flare.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function restart() {
  if (state === 'flying') return;
  screens.hideAll();
  const hudEl = document.getElementById('hud');
  hudEl.classList.remove('hidden-hud');
  mount(chosen);
  state = 'flying';
}

bindInput({
  camera: () => rig.toggle(),
  pause: () => {
    if (state === 'flying') {
      state = 'paused';
      screens.showPause(true);
      clearInput();
    } else if (state === 'paused') {
      state = 'flying';
      screens.showPause(false);
    }
  },
  restart: () => {
    if (state === 'over') restart();
  },
  drop: () => {
    if (state !== 'flying' || !mission?.drops?.length) return;
    const result = mission.dropCrates(plane);
    if (!result) return;
    if (result === 'released') {
      mission.dwell += 1;
      hud.banner('CRATES AWAY');
      hud.brief(`The village has its crates. Finish the rings, then land at ${mission.brief.finish}.`);
    } else {
      hud.banner(result === 'too fast' ? 'TOO FAST TO DROP' : 'TOO HIGH TO DROP');
    }
  },
  hud: () => hud?.toggle(),
  flaps: () => {
    if (plane) plane.flaps = plane.flaps > 0.5 ? 0 : 1;
  },
});

for (const button of document.querySelectorAll('.pick')) {
  button.addEventListener('click', () => {
    chosen = button.dataset.kind;
    for (const other of document.querySelectorAll('.pick')) other.classList.toggle('on', other === button);
  });
}
document.querySelector(`.pick[data-kind="${chosen}"]`)?.classList.add('on');
document.getElementById('start').addEventListener('click', begin);
document.getElementById('resume').addEventListener('click', () => {
  state = 'flying';
  screens.showPause(false);
});
document.getElementById('again').addEventListener('click', restart);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// A screenshot pose skips the title and flies itself still.
const shot = shotName();
if (shot) {
  screens.hideAll();
  const hudEl = document.getElementById('hud');
  hudEl.classList.add('shot-hud');
  hudEl.classList.remove('hidden-hud');
  const first = SHOTS[shot]({ course: null, strips: AIRSTRIPS });
  mount(first.kind);
  const pose = SHOTS[shot]({ course, strips: AIRSTRIPS });
  plane.position.copy(pose.position);
  plane.quaternion.copy(pose.quaternion);
  plane.speed = pose.speed;
  plane.setThrottle(pose.throttle);
  rig.mode = pose.camera;
  // A still frame wants the furniture out of the sightline: bigger and lower in the cockpit view.
  if (pose.camera === 'cockpit') {
    cockpit.scale.setScalar(1.2);
    cockpit.position.y = -0.085;
  }
  // Debug switches: ?hide=sea|clouds lets a probe isolate what a reviewer is seeing.
  const hide = new URLSearchParams(location.search).get('hide');
  if (hide) scene.traverse((o) => {
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mat) return;
    if (hide === 'sea' && o.isMesh && o.geometry?.type === 'PlaneGeometry' && !mat.map && !mat.transparent) o.visible = false;
    if (hide === 'clouds' && o.isSprite && mat.map && mat.blending === THREE.NormalBlending) o.visible = false;
    if (hide === 'dome' && o.isMesh && o.material.type === 'ShaderMaterial') o.visible = false;
    if (hide === 'far' && o.isSprite) o.visible = false;
    if (hide === 'terrain' && o.isMesh && o.geometry?.attributes?.color) o.visible = false;
  });
  if (pose.gate) course.solo(pose.gate);
  if (pose.hull) plane.hull = pose.hull;
  shotSmoke = Boolean(pose.smoke);
  for (const burst of pose.bursts ?? []) threat.place(burst.at, burst.size);
  for (const puff of pose.trail ?? []) damage?.place(puff.at, puff.size);
  rig.update(plane, 0.016, 0.5, true);
  state = 'shot';
  hud.refresh(plane, course, 0, objectiveTotal());
} else {
  screens.showTitle();
  document.getElementById('hud').classList.add('hidden-hud');
}

window.__game = { get scene() { return scene; }, get camera() { return camera; }, get plane() { return plane; } };
frame();
