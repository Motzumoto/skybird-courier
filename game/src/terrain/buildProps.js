// Prop geometry: a leaning palm and a tin-roofed hut, each one merged, vertex-coloured geometry
// so hundreds can be drawn as two instanced meshes.

import * as THREE from 'three';

function colourAll(geometry, hex) {
  const colour = new THREE.Color(hex);
  const count = geometry.attributes.position.count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

function merge(parts) {
  const positions = [];
  const normals = [];
  const colours = [];
  for (const part of parts) {
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    geometry.applyMatrix4(part.matrix);
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal ?? position;
    const colour = geometry.attributes.color;
    for (let i = 0; i < position.count; i++) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      colours.push(colour ? colour.getX(i) : 1, colour ? colour.getY(i) : 1, colour ? colour.getZ(i) : 1);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  return out;
}

export function generatePalm() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.26, 0.44, 8.4, 5, 3);
  trunk.translate(0, 4.2, 0);
  colourAll(trunk, '#7a6244');
  const bend = new THREE.Matrix4().makeRotationZ(0.16);
  parts.push({ geometry: trunk, matrix: bend });

  const frondGeometry = new THREE.PlaneGeometry(4.6, 1.15, 4, 1);
  const frondColour = new THREE.Color('#3f7a3c');
  for (let i = 0; i < 7; i++) {
    const frond = frondGeometry.clone();
    frond.translate(2.1, 0, 0);
    colourAll(frond, i % 2 === 0 ? '#3f7a3c' : '#356b34');
    frondColour.offsetHSL(0, 0, 0);
    const matrix = new THREE.Matrix4()
      .makeTranslation(1.2, 8.2, 0)
      .multiply(new THREE.Matrix4().makeRotationY((i / 7) * Math.PI * 2))
      .multiply(new THREE.Matrix4().makeRotationZ(-0.5 - (i % 3) * 0.22));
    parts.push({ geometry: frond, matrix });
  }
  const crown = new THREE.SphereGeometry(0.5, 6, 5);
  crown.translate(1.15, 8.1, 0);
  colourAll(crown, '#5b7a3a');
  parts.push({ geometry: crown, matrix: new THREE.Matrix4() });

  return merge(parts);
}

export function generateHut() {
  const parts = [];
  const walls = new THREE.BoxGeometry(4.6, 2.6, 3.8);
  walls.translate(0, 1.3, 0);
  colourAll(walls, '#d8cdb1');
  parts.push({ geometry: walls, matrix: new THREE.Matrix4() });

  const roof = new THREE.ConeGeometry(3.7, 1.5, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(0, 3.3, 0);
  colourAll(roof, '#a9713f');
  parts.push({ geometry: roof, matrix: new THREE.Matrix4() });

  const door = new THREE.PlaneGeometry(1.1, 1.8);
  door.translate(0, 0.9, 1.94);
  colourAll(door, '#4d3a2a');
  parts.push({ geometry: door, matrix: new THREE.Matrix4() });

  const tank = new THREE.CylinderGeometry(0.7, 0.7, 1.4, 8);
  tank.translate(2.7, 0.7, 1.1);
  colourAll(tank, '#8b9aa0');
  parts.push({ geometry: tank, matrix: new THREE.Matrix4() });

  return merge(parts);
}
