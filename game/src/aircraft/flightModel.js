// The flight model: throttle, airspeed, stall, terrain contact. Arcade weight, real consequences.

import * as THREE from 'three';
import { FLIGHT, PLAY } from '../config.js';
import { groundAt } from '../terrain/heightfield.js';

const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const qTemp = new THREE.Quaternion();

export function createPlane(mesh, spawn) {
  mesh.position.copy(spawn.position);
  mesh.quaternion.copy(spawn.quaternion);

  const plane = {
    mesh,
    speed: spawn.speed ?? FLIGHT.cruise * 0.86,
    throttle: 0.72,
    pitch: 0,
    roll: 0,
    yaw: 0,
    flaps: 0,
    hull: PLAY.hullValue,
    fuel: PLAY.startFuel,
    alive: true,
    onGround: false,
    onWater: false,
    stalled: false,
    groundHeight: 0,
    sinkRate: 0,
    lastImpact: 0,
    propSpin: 0,
    distance: 0,
    position: mesh.position,
    quaternion: mesh.quaternion,
  };

  plane.setThrottle = (value) => {
    plane.throttle = THREE.MathUtils.clamp(value, 0, 1);
  };

  plane.update = (dt, input) => {
    if (!plane.alive) {
      plane.speed = Math.max(0, plane.speed - 26 * dt);
      return;
    }

    const authority = THREE.MathUtils.clamp(plane.speed * FLIGHT.authority, 0.2, 1.15);
    plane.pitch = THREE.MathUtils.lerp(plane.pitch, input.pitch, 0.22);
    plane.roll = THREE.MathUtils.lerp(plane.roll, input.roll, 0.19);
    plane.yaw = THREE.MathUtils.lerp(plane.yaw, input.yaw, 0.16);

    if (input.throttleUp) plane.setThrottle(plane.throttle + FLIGHT.throttleRate * dt);
    if (input.throttleDown) plane.setThrottle(plane.throttle - FLIGHT.throttleRate * dt);

    const stalledNow = plane.speed < FLIGHT.stallSpeed;
    if (stalledNow && !plane.onGround) {
      qTemp.setFromAxisAngle(AXIS_X, -0.55 * dt * (1 - plane.speed / FLIGHT.stallSpeed));
      plane.quaternion.multiply(qTemp);
      qTemp.setFromAxisAngle(AXIS_Z, (Math.random() - 0.5) * 0.9 * dt);
      plane.quaternion.multiply(qTemp);
    }

    qTemp.setFromAxisAngle(AXIS_X, -plane.pitch * FLIGHT.pitchRate * authority * dt);
    plane.quaternion.multiply(qTemp);
    qTemp.setFromAxisAngle(AXIS_Z, -plane.roll * FLIGHT.rollRate * authority * dt);
    plane.quaternion.multiply(qTemp);
    qTemp.setFromAxisAngle(AXIS_Y, -plane.yaw * FLIGHT.yawRate * authority * dt);
    plane.quaternion.multiply(qTemp);

    // Keep the airframe from hanging on its back.
    const localUp = AXIS_Y.clone().applyQuaternion(plane.quaternion);
    if (localUp.y < 0.05 && !plane.onGround) {
      qTemp.setFromAxisAngle(AXIS_Z, (localUp.x > 0 ? -1 : 1) * 0.7 * dt);
      plane.quaternion.multiply(qTemp);
    }

    const forward = AXIS_Z.clone().applyQuaternion(plane.quaternion).negate();
    const climb = forward.y;

    const flapDrag = plane.flaps > 0.5 ? FLIGHT.flapDrag : 0;
    const load = plane.cargo ?? 1;
    const target = THREE.MathUtils.lerp(FLIGHT.idle, FLIGHT.cruise * load, plane.throttle) * (plane.speedCap ?? 1) * (1 - flapDrag * 0.42);
    const accel = (target - plane.speed) * 0.55 - climb * FLIGHT.gravityBleed;
    plane.speed = Math.max(4, plane.speed + accel * dt);

    const before = plane.position.y;
    plane.position.addScaledVector(forward, plane.speed * dt);
    plane.distance += plane.speed * dt;
    plane.sinkRate = (before - plane.position.y) / Math.max(dt, 1e-4);

    plane.groundHeight = groundAt(plane.position.x, plane.position.z);
    const gearHeight = 1.62;
    const contact = plane.groundHeight + gearHeight;

    plane.onWater = plane.groundHeight < 0.6;
    if (plane.position.y <= contact) {
      plane.position.y = contact;
      plane.onGround = true;
      const sink = Math.max(0, plane.sinkRate);
      const flared = sink < PLAY.crashImpact;
      if (plane.onWater && sink > PLAY.crashImpact * 1.4) return plane.crash('The floats dug into the swell.');
      if (!flared) return plane.crash('The airframe met the rock.');
      const level = AXIS_Y.clone().applyQuaternion(plane.quaternion);
      if (level.y < 0.86 && plane.speed > 44) {
        plane.hull -= 12 * dt;
        if (plane.hull <= 0) return plane.crash('Ground loop tore the gear off.');
      }
      plane.speed = Math.max(14, plane.speed - FLIGHT.groundFriction * 34 * dt);
      // Settle level on the strip or the water.
      const groundQ = new THREE.Quaternion().setFromUnitVectors(AXIS_Y, level.setY(Math.max(0.2, level.y)).normalize());
      plane.quaternion.slerp(groundQ, 0.08);
      plane.lastImpact = sink;
    } else {
      plane.onGround = false;
    }

    plane.fuel = Math.max(0, plane.fuel - (FLIGHT.fuelBurnIdle + FLIGHT.fuelBurn * plane.throttle) * dt);
    if (plane.fuel <= 0) {
      plane.setThrottle(0);
      plane.hull = Math.max(0, plane.hull - 2 * dt);
    }

    plane.propSpin += (6 + plane.throttle * 42) * dt;
    plane.mesh.userData.prop.rotation.z = plane.propSpin;
  };

  plane.crash = (reason) => {
    if (!plane.alive) return;
    plane.alive = false;
    plane.crashReason = reason;
    plane.hull = 0;
  };

  return plane;
}
