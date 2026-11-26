// Ridge flak: puff bursts bloom ahead of the nose over the volcano and cost hull if they land close.

import * as THREE from 'three';
import { PLAY } from '../config.js';
import { groundAt } from '../terrain/heightfield.js';

const PUFF_MAT = new THREE.MeshStandardMaterial({ color: '#3b352f', roughness: 1, transparent: true, opacity: 0.85 });
const PUFF_GEO = new THREE.SphereGeometry(1, 8, 6);

export function createThreat(scene) {
  const puffs = [];
  let timer = 0;

  return {
    puffs,
    update(dt, plane, active) {
      if (!plane.alive) return 0;
      for (let i = puffs.length - 1; i >= 0; i--) {
        const puff = puffs[i];
        puff.life += dt;
        puff.scale += dt * 26;
        puff.mesh.scale.setScalar(puff.scale);
        puff.mesh.position.y += dt * 3.4;
        puff.mesh.material.opacity = Math.max(0, 0.85 - puff.life * 0.42);
        if (puff.life > 2.4) {
          scene.remove(puff.mesh);
          puff.mesh.material.dispose();
          puffs.splice(i, 1);
        }
      }

      if (!active) return 0;
      timer -= dt;
      if (timer > 0) return 0;
      timer = 1.15 + Math.random() * 1.5;

      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(plane.quaternion);
      const ahead = plane.position.clone().addScaledVector(forward, 260 + Math.random() * 220);
      ahead.y = Math.max(groundAt(ahead.x, ahead.z) + 30, ahead.y + (Math.random() - 0.5) * 120);

      const mesh = new THREE.Mesh(PUFF_GEO, PUFF_MAT.clone());
      mesh.position.copy(ahead);
      scene.add(mesh);
      const puff = { mesh, life: 0, scale: 3 };
      puffs.push(puff);

      const distance = ahead.distanceTo(plane.position);
      if (distance < 46) return 6;
      return 0;
    },
    reset() {
      for (const puff of puffs) scene.remove(puff.mesh);
      puffs.length = 0;
    },
  };
}
