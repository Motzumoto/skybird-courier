// The Strait Bridge: a suspension span between Ilha Cardo and Caldeira Preta, so the archipelago
// has one landmark you can navigate by from anywhere over the water.

import * as THREE from 'three';
import { ISLANDS, groundAt } from './heightfield.js';

const DECK = new THREE.MeshStandardMaterial({ color: '#4a4c4f', roughness: 0.92 });
const RAIL = new THREE.MeshStandardMaterial({ color: '#c9c3b0', roughness: 0.8 });
const CONCRETE = new THREE.MeshStandardMaterial({ color: '#b9b1a1', roughness: 0.95 });
const CABLE = new THREE.MeshStandardMaterial({ color: '#8f8a7e', roughness: 0.7, metalness: 0.35 });
const LAMP = new THREE.MeshBasicMaterial({ color: '#ffeec4' });

function shorePoint(island, towards, extra = 90) {
  const angle = Math.atan2(towards.x - island.x, towards.z - island.z);
  for (let reach = island.r * 0.5; reach < island.r * 1.5; reach += 10) {
    const x = island.x + Math.sin(angle) * reach;
    const z = island.z + Math.cos(angle) * reach;
    if (groundAt(x, z) > 6) {
      return new THREE.Vector3(island.x + Math.sin(angle) * (reach + extra), 0, island.z + Math.cos(angle) * (reach + extra));
    }
  }
  return new THREE.Vector3(island.x + Math.sin(angle) * island.r, 0, island.z + Math.cos(angle) * island.r);
}

// Where the span ended up, so a screenshot pose can fly it.
export const BRIDGE = { midpoint: null, axis: null };

export function buildBridge(scene) {
  const from = ISLANDS[1];
  const to = ISLANDS[2];
  const start = shorePoint(from, to);
  const end = shorePoint(to, from);
  const span = start.distanceTo(end);
  const deckHeight = 34;

  const group = new THREE.Group();
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const axis = end.clone().sub(start).normalize();
  const across = new THREE.Vector3(axis.z, 0, -axis.x).normalize();
  const yaw = Math.atan2(axis.x, axis.z);

  // Deck and its crash barriers.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(15, 1.6, span), DECK);
  deck.position.set(mid.x, deckHeight, mid.z);
  deck.rotation.y = yaw;
  deck.castShadow = true;
  group.add(deck);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, span), RAIL);
    rail.position.set(mid.x + across.x * side * 7.4, deckHeight + 1.4, mid.z + across.z * side * 7.4);
    rail.rotation.y = yaw;
    group.add(rail);
  }

  // The two towers, and the main cables slung between them.
  for (const [point, side] of [[start, -1], [end, 1]]) {
    for (let i = 0; i < 2; i++) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(4.4, 74, 4.4), CONCRETE);
      leg.position.set(point.x + across.x * (i ? 9 : -9), deckHeight + 30, point.z + across.z * (i ? 9 : -9));
      leg.rotation.y = yaw;
      leg.castShadow = true;
      group.add(leg);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(24, 3, 5), CONCRETE);
      cap.position.set(point.x, deckHeight + 66, point.z);
      cap.rotation.y = yaw;
      group.add(cap);
    }
    void side;
  }

  const sag = (t) => Math.sin(Math.PI * t) * 46;
  for (const side of [-1, 1]) {
    const points = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const p = start.clone().lerp(end, t);
      points.push(new THREE.Vector3(p.x + across.x * side * 7, deckHeight + 66 - sag(t), p.z + across.z * side * 7));
    }
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, 0.45, 6, false), CABLE);
    group.add(cable);
    for (let i = 2; i < 23; i += 2) {
      const t = i / 24;
      const p = start.clone().lerp(end, t);
      const drop = 66 - sag(t);
      const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.22, drop, 0.22), CABLE);
      hanger.position.set(p.x + across.x * side * 7, deckHeight + drop / 2, p.z + across.z * side * 7);
      group.add(hanger);
    }
  }

  // Deck lamps, so the span reads at dusk from the air.
  for (let i = 2; i < 22; i += 2) {
    const p = start.clone().lerp(end, i / 24);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 7, 6), RAIL);
      post.position.set(p.x + across.x * side * 6.6, deckHeight + 4.4, p.z + across.z * side * 6.6);
      group.add(post);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5), LAMP);
      bulb.position.set(p.x + across.x * side * 6.6, deckHeight + 8, p.z + across.z * side * 6.6);
      group.add(bulb);
    }
  }

  scene.add(group);
  BRIDGE.midpoint = new THREE.Vector3(mid.x, deckHeight, mid.z);
  BRIDGE.axis = axis.clone();
  return { group, midpoint: BRIDGE.midpoint, axis };
}
