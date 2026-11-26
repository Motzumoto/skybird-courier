// Chase and cockpit views. The chase camera lags the airframe so a hard bank reads as a bank.

import * as THREE from 'three';
import { CAMERA } from '../config.js';

const back = new THREE.Vector3(0, 0, 1);
const up = new THREE.Vector3(0, 1, 0);

export function createCameraRig(camera) {
  const rig = {
    mode: 'chase',
    // A still frame can pull the chase camera in, so the aircraft reads as the subject instead of
    // a speck in its own game.
    zoom: 1,
    // Height of the point the lens aims at, in metres above the hull. A still drops it, so the
    // aircraft sits clear of the instrument panel instead of behind it.
    lift: 1.5,
    shake: 0,
    smoothUp: up.clone(),
    desired: new THREE.Vector3(),
    look: new THREE.Vector3(),
  };

  rig.toggle = () => {
    rig.mode = rig.mode === 'chase' ? 'cockpit' : 'chase';
  };

  rig.update = (plane, dt, speedFactor, snap = false) => {
    const body = plane.mesh;
    if (rig.mode === 'cockpit') {
      const offset = new THREE.Vector3(0, CAMERA.cockpitUp, -CAMERA.cockpitForward).applyQuaternion(body.quaternion);
      camera.position.copy(body.position).add(offset);
      const ahead = new THREE.Vector3(0, 0.12, -30).applyQuaternion(body.quaternion);
      rig.look.copy(body.position).add(ahead);
      camera.lookAt(rig.look);
      camera.up.copy(up);
      return;
    }

    rig.desired
      .copy(back)
      .multiplyScalar((CAMERA.chaseBack + speedFactor * 4.4) / rig.zoom)
      .add(new THREE.Vector3(0, CAMERA.chaseUp / rig.zoom, 0))
      .applyQuaternion(body.quaternion)
      .add(body.position);

    const groundClamp = plane.groundHeight + 3.4;
    if (rig.desired.y < groundClamp) rig.desired.y = groundClamp;

    camera.position.lerp(rig.desired, snap ? 1 : CAMERA.chaseLag + dt * 1.4);

    rig.smoothUp.lerp(up.clone().applyQuaternion(body.quaternion), 0.06);
    camera.up.copy(rig.smoothUp).lerp(up, 0.62).normalize();

    rig.look.copy(body.position).add(new THREE.Vector3(0, rig.lift, -18).applyQuaternion(body.quaternion));
    camera.lookAt(rig.look);

    if (rig.shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * rig.shake;
      camera.position.y += (Math.random() - 0.5) * rig.shake;
      rig.shake *= 0.9;
    }
  };

  rig.kick = (amount) => {
    rig.shake = Math.min(2.4, rig.shake + amount);
  };

  return rig;
}

// A lens breath when the sun swings into the glass: an anamorphic streak plus a couple of
// ghost dots, all parented to the camera so they track whatever view is active.
export function createFlare(camera, sunDirection) {
  const group = new THREE.Group();
  camera.add(group);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 16, 256, 16);
  gradient.addColorStop(0, 'rgba(255,226,178,0)');
  gradient.addColorStop(0.5, 'rgba(255,238,204,0.9)');
  gradient.addColorStop(1, 'rgba(255,226,178,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 10, 256, 12);
  const streakTexture = new THREE.CanvasTexture(canvas);
  streakTexture.colorSpace = THREE.SRGBColorSpace;

  const streak = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: streakTexture, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 })
  );
  streak.scale.set(3.0, 0.04, 1);
  streak.position.z = -2;
  group.add(streak);

  const ghosts = [];
  for (let i = 0; i < 0; i++) {
    const ghost = new THREE.Mesh(
      new THREE.CircleGeometry(0.06 + i * 0.03, 18),
      new THREE.MeshBasicMaterial({ color: '#ffd9a8', transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 })
    );
    ghost.position.z = -2;
    group.add(ghost);
    ghosts.push(ghost);
  }

  const forward = new THREE.Vector3();
  const projected = new THREE.Vector3();

  return {
    update() {
      forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const align = forward.dot(sunDirection);
      const strength = THREE.MathUtils.clamp((align - 0.55) / 0.45, 0, 1);
      projected.copy(sunDirection).multiplyScalar(600).add(camera.position);
      projected.project(camera);
      const x = THREE.MathUtils.clamp(projected.x * 1.25, -1.6, 1.6);
      const y = THREE.MathUtils.clamp(projected.y * 1.05, -1.2, 1.2);
      streak.position.x = x * 1.05;
      streak.position.y = y * 0.62 + 0.12;
      streak.material.opacity = strength * 0.14;
      ghosts.forEach((ghost, i) => {
        ghost.position.x = -x * (0.9 + i * 0.5);
        ghost.position.y = -y * (0.55 + i * 0.3);
        ghost.material.opacity = strength * (0.16 - i * 0.04);
      });
    },
  };
}
