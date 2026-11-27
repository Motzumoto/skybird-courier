// Touchdown spray and floatplane landing sheet: water or dust thrown on contact.
// Two point clouds on one group — a short gear burst that reads as weight, and a
// longer spray wall a still frame can catch standing up over the water.

import * as THREE from 'three';

// Points draw as squares without a map, which at this size read as blocks of Lego. A soft
// round sprite makes the same particles read as water.
function dropTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.42)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

const COUNT = 14;
const SHEET_COUNT = 90;

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
    map: dropTexture(),
  });
  const points = new THREE.Points(geometry, material);
  group.add(points);

  const velocity = Array.from({ length: COUNT }, () => new THREE.Vector3());
  let life = 0;

  // the landing sheet: a second, longer-lived cloud so the wall stays readable
  const sheetGeometry = new THREE.BufferGeometry();
  const sheetPositions = new Float32Array(SHEET_COUNT * 3);
  sheetGeometry.setAttribute('position', new THREE.BufferAttribute(sheetPositions, 3));
  const sheetMaterial = new THREE.PointsMaterial({
    size: 1.7,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    opacity: 0,
    color: '#eef7fa',
    map: dropTexture(),
    alphaTest: 0.02,
  });
  const sheetPoints = new THREE.Points(sheetGeometry, sheetMaterial);
  group.add(sheetPoints);

  const sheetVelocity = new Float32Array(SHEET_COUNT * 3);
  const sheetLife = new Float32Array(SHEET_COUNT);
  let sheetTimer = 0;
  let sheetPeak = 1;
  let waterY = 0;

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
    // Throw the water landing wall: a dense fan out of the floats, biased to
    // both sides of the aircraft with a forward drag along the heading. strength
    // 0..1 scales speed and lifetime so a hard splash at speed holds a readable
    // wall for roughly a second and a half.
    sheet(position, heading, strength) {
      const s = Math.max(0, Math.min(1, strength || 0));
      // aircraft frame for a yaw heading: forward (sin, 0, cos), sides (cos, 0, -sin)
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const lx = Math.cos(heading);
      const lz = -Math.sin(heading);
      waterY = position.y;
      sheetTimer = 0.9 + 0.5 * s;
      sheetPeak = sheetTimer;
      for (let i = 0; i < SHEET_COUNT; i++) {
        const side = i % 2 ? 1 : -1;
        const lateral = side * (5 + Math.random() * 9) * (0.4 + 0.6 * s);
        const rise = (4 + Math.random() * 8) * (0.35 + 0.65 * s);
        const along = (2 + Math.random() * 6) * (0.3 + 0.7 * s);
        sheetLife[i] = (0.7 + Math.random() * 0.7) * (0.6 + 0.4 * s);
        sheetPositions[i * 3] = position.x + lx * side * (0.5 + Math.random() * 0.9);
        sheetPositions[i * 3 + 1] = position.y + Math.random() * 0.4;
        sheetPositions[i * 3 + 2] = position.z + lz * side * (0.5 + Math.random() * 0.9);
        sheetVelocity[i * 3] = lx * lateral + fx * along;
        sheetVelocity[i * 3 + 1] = rise;
        sheetVelocity[i * 3 + 2] = lz * lateral + fz * along;
      }
      sheetGeometry.attributes.position.needsUpdate = true;
      sheetMaterial.opacity = 0.62;
    },
    update(dt) {
      // the sheet runs on its own clock so a burst fade never cuts it short
      if (sheetTimer > 0) {
        sheetTimer -= dt;
        for (let i = 0; i < SHEET_COUNT; i++) {
          if (sheetLife[i] <= 0) continue;
          sheetLife[i] -= dt;
          sheetVelocity[i * 3 + 1] -= 16 * dt;
          // barely any drag here — the wall needs to keep its shape
          sheetVelocity[i * 3] *= 0.985;
          sheetVelocity[i * 3 + 1] *= 0.985;
          sheetVelocity[i * 3 + 2] *= 0.985;
          sheetPositions[i * 3] += sheetVelocity[i * 3] * dt;
          sheetPositions[i * 3 + 1] += sheetVelocity[i * 3 + 1] * dt;
          sheetPositions[i * 3 + 2] += sheetVelocity[i * 3 + 2] * dt;
          // splash dies at the water surface instead of sinking through it
          if (sheetLife[i] <= 0 || sheetPositions[i * 3 + 1] <= waterY) {
            sheetLife[i] = 0;
            sheetPositions[i * 3 + 1] = waterY - 0.6;
          }
        }
        sheetGeometry.attributes.position.needsUpdate = true;
        sheetMaterial.opacity = Math.max(0, sheetTimer / sheetPeak) * 0.85;
      }
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
      sheetTimer = 0;
      sheetLife.fill(0);
      sheetMaterial.opacity = 0;
    },
  };
}
