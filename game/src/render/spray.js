// Touchdown spray: water off the floats or dust off the strip, thrown from the gear on contact
// and gone in a moment. Small on purpose — it reads as weight, not weather.

import * as THREE from 'three';

const COUNT = 14;

export function createSpray(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(COUNT * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    size: 1.6,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    opacity: 0,
    color: '#ddd3c0',
  });
  const points = new THREE.Points(geometry, material);
  group.add(points);

  const velocity = Array.from({ length: COUNT }, () => new THREE.Vector3());
  let life = 0;

  return {
    // Kick a burst out from under the floats: wet if the contact was on water.
    burst(position, heavy, wet) {
      material.color.set(wet ? '#e7f2f4' : '#ddd3c0');
      life = heavy ? 1.1 : 0.7;
      for (let i = 0; i < COUNT; i++) {
        const side = i % 2 ? 1 : -1;
        positions[i * 3] = position.x + side * (0.6 + Math.random() * 0.8);
        positions[i * 3 + 1] = position.y + Math.random() * 0.5;
        positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 2.4;
        velocity[i].set(side * (3 + Math.random() * 5), 2 + Math.random() * (heavy ? 7 : 4), (Math.random() - 0.5) * 5);
      }
      geometry.attributes.position.needsUpdate = true;
      material.opacity = 0.85;
    },
    update(dt) {
      if (life <= 0) return;
      life -= dt;
      for (let i = 0; i < COUNT; i++) {
        velocity[i].y -= 14 * dt;
        velocity[i].multiplyScalar(0.94);
        positions[i * 3] += velocity[i].x * dt;
        positions[i * 3 + 1] += velocity[i].y * dt;
        positions[i * 3 + 2] += velocity[i].z * dt;
      }
      geometry.attributes.position.needsUpdate = true;
      material.opacity = Math.max(0, life * 0.8);
    },
    clear() {
      life = 0;
      material.opacity = 0;
    },
  };
}
