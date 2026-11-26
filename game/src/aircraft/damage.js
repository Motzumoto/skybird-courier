// Airframe wear: engine power thins, oil smoke trails, and the wing answers less as the hull goes.
// Damage arrives from flak, bird strikes and heavy landings.

import * as THREE from 'three';

const SMOKE_GEO = new THREE.SphereGeometry(1, 6, 5);

export function createDamage(plane, scene) {
  const puffs = [];
  let timer = 0;

  return {
    hull: plane.hull,
    apply(amount, reason) {
      if (!plane.alive) return;
      plane.hull = Math.max(0, plane.hull - amount);
      if (plane.hull <= 0) plane.crash(reason ?? 'The airframe gave out.');
    },
    // Power falls off as the engine is hit; a smoking wreck climbs like a brick.
    power() {
      if (plane.hull > 70) return 1;
      if (plane.hull > 35) return 0.9;
      return 0.72;
    },
    update(dt) {
      if (!plane.alive || plane.hull > 55) return;
      timer -= dt;
      if (timer > 0) return;
      timer = plane.hull < 25 ? 0.04 : 0.09;
      const puff = new THREE.Mesh(SMOKE_GEO, new THREE.MeshStandardMaterial({
        color: plane.hull < 25 ? '#3a332c' : '#9a9184',
        roughness: 1,
        transparent: true,
        opacity: 0.75,
      }));
      const offset = new THREE.Vector3(6.2 + (Math.random() - 0.5) * 1.4, 2.2, 2.2).applyQuaternion(plane.quaternion);
      puff.position.copy(plane.position).add(offset);
      puff.scale.setScalar(2.6);
      scene.add(puff);
      puffs.push({ mesh: puff, life: 0 });
    },
    frame(dt) {
      for (let i = puffs.length - 1; i >= 0; i--) {
        const puff = puffs[i];
        puff.life += dt;
        if (puff.frozen) continue;
        puff.mesh.scale.setScalar(2.2 + puff.life * 8);
        puff.mesh.position.y += dt * 2.2;
        puff.mesh.material.opacity = Math.max(0, 0.8 - puff.life * 0.34);
        if (puff.life > 2.4) {
          scene.remove(puff.mesh);
          puff.mesh.material.dispose();
          puffs.splice(i, 1);
        }
      }
    },
    // Lay one puff at a world point (the screenshot poses use it for the trail).
    place(position, scale) {
      const puff = new THREE.Mesh(SMOKE_GEO, new THREE.MeshStandardMaterial({ color: '#3a332c', roughness: 1, transparent: true, opacity: 0.8 }));
      puff.position.copy(position);
      puff.scale.setScalar(scale);
      scene.add(puff);
      puffs.push({ mesh: puff, life: 0, frozen: true });
    },
    clear() {
      for (const puff of puffs) scene.remove(puff.mesh);
      puffs.length = 0;
    },
  };
}
