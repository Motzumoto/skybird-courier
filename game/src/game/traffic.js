// Life below the flight path: kestrel flocks over the ridges, fishing boats on the water,
// traffic on the island roads. Ambience, and the odd bird strike.

import * as THREE from 'three';
import { PLAY } from '../config.js';
import { groundAt, randomSpot } from '../terrain/heightfield.js';

export function buildTraffic(scene) {
  const birds = [];
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -1.1, 0, 0, 0, 0.34, 0.5, 0, 0, -0.2,
    1.1, 0, 0, 0, 0.34, 0.5, 0, 0, -0.2,
  ]), 3));
  birdGeo.computeVertexNormals();
  const birdMat = new THREE.MeshStandardMaterial({ color: '#2f2a24', roughness: 0.9, side: THREE.DoubleSide, flatShading: true });

  for (let i = 0; i < PLAY.birdCount; i++) {
    const spot = randomSpot(20);
    const mesh = new THREE.Mesh(birdGeo, birdMat);
    mesh.scale.setScalar(1.7 + Math.random() * 1.6);
    mesh.position.set(spot.x, spot.h + 24 + Math.random() * 130, spot.z);
    scene.add(mesh);
    birds.push({ mesh, base: mesh.position.clone(), phase: Math.random() * Math.PI * 2, radius: 22 + Math.random() * 66, speed: 0.32 + Math.random() * 0.5 });
  }

  const boats = [];
  const hullMat = new THREE.MeshStandardMaterial({ color: '#d9d2bd', roughness: 0.7 });
  const deckMat = new THREE.MeshStandardMaterial({ color: '#2f6f74', roughness: 0.6 });
  for (let i = 0; i < PLAY.boatCount; i++) {
    let x;
    let z;
    let tries = 0;
    do {
      x = (Math.random() - 0.5) * 3600;
      z = (Math.random() - 0.5) * 3600;
      tries += 1;
    } while (groundAt(x, z) > -6 && tries < 60);
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(2.4, 9, 4, 8), hullMat);
    hull.rotation.z = Math.PI / 2;
    hull.scale.set(1, 1, 0.62);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, 4.6), deckMat);
    deck.position.set(1.6, 2.4, 0);
    boat.add(hull, deck);
    boat.position.set(x, 0.6, z);
    boat.rotation.y = Math.random() * Math.PI * 2;
    scene.add(boat);
    boats.push({ mesh: boat, speed: 2 + Math.random() * 3, heading: boat.rotation.y });
  }

  return {
    birds,
    boats,
    update(time, dt) {
      for (const bird of birds) {
        bird.phase += dt * bird.speed;
        bird.mesh.position.set(
          bird.base.x + Math.cos(bird.phase) * bird.radius,
          bird.base.y + Math.sin(bird.phase * 1.7) * 6,
          bird.base.z + Math.sin(bird.phase) * bird.radius,
        );
        bird.mesh.rotation.y = -bird.phase;
        bird.mesh.rotation.z = Math.sin(bird.phase * 5) * 0.28;
      }
      for (const boat of boats) {
        boat.mesh.position.x += Math.cos(boat.heading) * boat.speed * dt;
        boat.mesh.position.z += Math.sin(boat.heading) * boat.speed * dt;
        boat.mesh.rotation.z = Math.sin(time * 1.4 + boat.speed) * 0.05;
        if (Math.abs(boat.mesh.position.x) > 2200) boat.heading += Math.PI;
        if (Math.abs(boat.mesh.position.z) > 2200) boat.heading += Math.PI;
      }
    },
  };
}
