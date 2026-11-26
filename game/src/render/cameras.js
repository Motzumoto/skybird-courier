// Chase and cockpit views. The chase camera lags the airframe so a hard bank reads as a bank.

import * as THREE from 'three';
import { CAMERA } from '../config.js';

const back = new THREE.Vector3(0, 0, 1);
const up = new THREE.Vector3(0, 1, 0);

export function createCameraRig(camera) {
  const rig = {
    mode: 'chase',
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
      .multiplyScalar(CAMERA.chaseBack + speedFactor * 4.4)
      .add(new THREE.Vector3(0, CAMERA.chaseUp, 0))
      .applyQuaternion(body.quaternion)
      .add(body.position);

    const groundClamp = plane.groundHeight + 3.4;
    if (rig.desired.y < groundClamp) rig.desired.y = groundClamp;

    camera.position.lerp(rig.desired, snap ? 1 : CAMERA.chaseLag + dt * 1.4);

    rig.smoothUp.lerp(up.clone().applyQuaternion(body.quaternion), 0.06);
    camera.up.copy(rig.smoothUp).lerp(up, 0.62).normalize();

    rig.look.copy(body.position).add(new THREE.Vector3(0, 1.5, -18).applyQuaternion(body.quaternion));
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
