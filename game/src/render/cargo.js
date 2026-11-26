// The crates themselves: three boxes off the skid when the release is pulled, tumbling and
// gone once they are down. Purely a payoff for the supply-drop brief.

import * as THREE from 'three';
import { groundAt } from '../terrain/heightfield.js';

const CRATES = 3;
const SPREAD = 2.4;
const GRAVITY = 22;

export function createCargo(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const chuteMaterial = new THREE.MeshStandardMaterial({
    color: '#f0e6cf',
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const chuteGeometry = new THREE.ConeGeometry(3, 1.9, 10, 1, true);

  const boxes = Array.from({ length: CRATES }, () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 2, 2.3),
      new THREE.MeshStandardMaterial({ color: '#b98f52', roughness: 0.9 }),
    );
    const chute = new THREE.Mesh(chuteGeometry, chuteMaterial);
    chute.position.y = 4.2;
    chute.visible = false;
    mesh.add(chute);
    // Four suspension lines up to the canopy rim, so the crate hangs from it.
    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.9, 0.9, -0.9), new THREE.Vector3(-2.4, 3.2, -2.4),
        new THREE.Vector3(0.9, 0.9, -0.9), new THREE.Vector3(2.4, 3.2, -2.4),
        new THREE.Vector3(-0.9, 0.9, 0.9), new THREE.Vector3(-2.4, 3.2, 2.4),
        new THREE.Vector3(0.9, 0.9, 0.9), new THREE.Vector3(2.4, 3.2, 2.4),
      ]),
      new THREE.LineBasicMaterial({ color: '#fbf3e2', transparent: true, opacity: 0.95 }),
    );
    lines.visible = false;
    mesh.add(lines);
    mesh.visible = false;
    group.add(mesh);
    return { mesh, chute, lines, velocity: new THREE.Vector3(), falling: false, life: 0 };
  });

  return {
    release(position, forward, speed) {
      boxes.forEach((box, index) => {
        const side = index === 0 ? 0 : index === 1 ? -SPREAD : SPREAD;
        box.mesh.position.copy(position).addScaledVector(forward, 8);
        box.mesh.position.x += side;
        box.mesh.position.y -= 6;
        box.mesh.visible = true;
        // Thrown on with most of the aircraft's own speed, so they fall away ahead of the nose
        // and stay in the view rather than snapping out of frame behind the tail.
        const carry = speed * 0.78;
        box.velocity.set(side * 1.8 + forward.x * carry, -7, forward.z * carry + side * 1.8);
        box.falling = true;
        box.life = 0;
        box.chute.visible = false;
      });
    },
    update(dt) {
      for (const box of boxes) {
        if (!box.falling) continue;
        box.life += dt;
        // The chute cracks open a moment after the release and the crate floats down.
        if (box.life > 0.22) {
          box.chute.visible = true;
          box.lines.visible = true;
          box.velocity.y = Math.max(-4.2, box.velocity.y - 12 * dt);
          box.velocity.x *= 0.985;
          box.velocity.z *= 0.985;
        } else {
          box.velocity.y -= GRAVITY * dt;
        }
        box.mesh.position.addScaledVector(box.velocity, dt);
        // The crate swings a little under the canopy; the canopy itself stays upright.
        box.mesh.rotation.x += dt * 0.9;
        box.mesh.rotation.z += dt * 0.6;
        box.chute.rotation.x = -box.mesh.rotation.x;
        box.chute.rotation.z = -box.mesh.rotation.z;
        const ground = Math.max(0, groundAt(box.mesh.position.x, box.mesh.position.z));
        if (box.mesh.position.y <= ground + 0.6 || box.life > 6) {
          box.falling = false;
        }
      }
    },
    clear() {
      for (const box of boxes) {
        box.falling = false;
        box.mesh.visible = false;
        box.chute.visible = false;
        box.lines.visible = false;
      }
    },
  };
}
