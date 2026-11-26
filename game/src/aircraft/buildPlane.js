// The courier: a high-wing bush plane on floats, modelled from primitives so the airframe
// reads as a built machine — rivets, struts, floats, a spinning prop and a lit panel.

import * as THREE from 'three';

const CREAM = '#efe7d3';
const TEAL = '#1f6f78';
const RUST = '#a8502e';
const DARK = '#2a2f31';

function registrationTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#22343a';
  ctx.font = 'bold 44px "DIN Alternate", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildPlane() {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.52, metalness: 0.16 });
  const trim = new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.44, metalness: 0.28 });
  const rust = new THREE.MeshStandardMaterial({ color: RUST, roughness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.35, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: '#9fd8e2', roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.42 });

  // Fuselage: nose to tail, tapering.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.44, 8.2, 12), body);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.1;
  group.add(fuselage);

  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.78, 1.4, 12), trim);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -4.2;
  group.add(nose);

  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 10), metal);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -5.2;
  group.add(spinner);

  // Cockpit glass and cabin windows.
  const windscreen = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.62, 0.9), glass);
  windscreen.position.set(0, 0.62, -2.5);
  group.add(windscreen);
  for (const side of [-1, 1]) {
    const windowPane = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 1.1), glass);
    windowPane.position.set(side * 0.74, 0.42, -1.4);
    group.add(windowPane);
  }

  // High wing with struts and the teal sun band.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.24, 2.3), body);
  wing.position.set(0, 0.86, -1.1);
  group.add(wing);
  const wingBand = new THREE.Mesh(new THREE.BoxGeometry(13.62, 0.26, 0.5), trim);
  wingBand.position.set(0, 0.87, -1.1);
  group.add(wingBand);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 3.5, 6), metal);
    strut.position.set(side * 2.3, 0.2, -1.05);
    strut.rotation.z = side * 0.62;
    group.add(strut);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 2.2), rust);
    tip.position.set(side * 6.8, 0.88, -1.1);
    group.add(tip);
    const navLight = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshStandardMaterial({
      color: side < 0 ? '#ff5a4a' : '#63e08a',
      emissive: side < 0 ? '#ff3a26' : '#48d979',
      emissiveIntensity: 3,
    }));
    navLight.position.set(side * 6.95, 0.88, -1.1);
    group.add(navLight);
  }

  // Tail: fin, rudder, stabiliser.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.9, 1.5), body);
  fin.position.set(0, 1.35, 3.5);
  group.add(fin);
  const rudderTrim = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.9, 0.34), trim);
  rudderTrim.position.set(0, 1.35, 4.3);
  group.add(rudderTrim);
  const stabiliser = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 1.1), body);
  stabiliser.position.set(0, 0.34, 3.9);
  group.add(stabiliser);

  // Floats, with their spreader struts.
  for (const side of [-1, 1]) {
    const float = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 4.4, 6, 10), trim);
    float.rotation.x = Math.PI / 2;
    float.position.set(side * 1.5, -1.35, 0.2);
    group.add(float);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 10), trim);
    tip.rotation.x = -Math.PI / 2;
    tip.position.set(side * 1.5, -1.35, -2.55);
    group.add(tip);
    for (const z of [-1.1, 1.4]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 6), metal);
      leg.position.set(side * 1.0, -0.62, z);
      leg.rotation.z = side * 0.34;
      group.add(leg);
    }
  }

  // Registration on the tail and the cabin door.
  const regMat = new THREE.MeshBasicMaterial({ map: registrationTexture('CS-114'), transparent: true });
  const reg = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), regMat);
  reg.position.set(0.13, 1.1, 3.3);
  reg.rotation.y = Math.PI / 2;
  reg.rotation.z = Math.PI / 2;
  group.add(reg);

  // Prop: two blades on a hub, spun in the sim.
  const prop = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.5, 0.05), metal);
    blade.position.y = 0;
    blade.rotation.z = i * 0.28;
    blade.rotation.y = i ? Math.PI / 2 : 0;
    prop.add(blade);
  }
  prop.position.z = -5.05;
  group.add(prop);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.32, 20),
    new THREE.MeshBasicMaterial({ color: '#cfd6d8', transparent: true, opacity: 0.07, side: THREE.DoubleSide }),
  );
  disc.position.z = -5.08;
  group.add(disc);

  // Panel glow so the cockpit reads as lit from the chase view.
  const panel = new THREE.PointLight('#ffb066', 4.2, 7, 2);
  panel.position.set(0, 0.42, -2.2);
  group.add(panel);

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  group.userData.prop = prop;
  group.userData.disc = disc;
  return group;
}
