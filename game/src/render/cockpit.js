// The cockpit shell: a glare shield, canopy frame and a lit instrument panel that hangs on the
// camera itself, so the cockpit view is flown from inside a machine and never from empty air.

import * as THREE from 'three';

export function buildCockpit() {
  const group = new THREE.Group();
  group.position.set(0, 0, 0);

  const shell = new THREE.MeshStandardMaterial({ color: '#3c464c', roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide });
  const trim = new THREE.MeshStandardMaterial({ color: '#151b1d', roughness: 0.55, metalness: 0.4 });
  const panelFluoro = new THREE.MeshStandardMaterial({ color: '#121a1c', emissive: '#7d4a16', emissiveIntensity: 0.42, roughness: 0.6 });

  // Glare shield and dash.
  const shield = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.1, 0.34), trim);
  shield.position.set(0, -0.36, -0.66);
  shield.rotation.x = 0.24;
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.34, 0.3), shell);
  dash.position.set(0, -0.6, -0.74);
  dash.rotation.x = 0.36;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.19, 0.06), panelFluoro);
  panel.position.set(0, -0.49, -0.6);
  panel.rotation.x = 0.5;
  group.add(shield, dash, panel);

  // Six lit dials on the panel, and the switch row under them.
  const dialGeo = new THREE.CircleGeometry(0.03, 14);
  const dialLit = new THREE.MeshBasicMaterial({ color: '#ffd79a' });
  for (let i = 0; i < 6; i++) {
    const dial = new THREE.Mesh(dialGeo, dialLit);
    dial.position.set(-0.22 + i * 0.088, -0.462, -0.575);
    dial.rotation.x = 0.5;
    group.add(dial);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.03, 0.001), new THREE.MeshBasicMaterial({ color: '#38240f' }));
    needle.position.set(-0.22 + i * 0.088, -0.457, -0.573);
    needle.rotation.x = 0.5;
    needle.rotation.z = (i - 2.5) * 0.5;
    group.add(needle);
  }
  const switchRow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.02), new THREE.MeshBasicMaterial({ color: '#6d2c1c' }));
  switchRow.position.set(0, -0.6, -0.66);
  switchRow.rotation.x = 0.5;
  group.add(switchRow);

  // Canopy frame: a windscreen post each side and a header over the glass.
  const postGeo = new THREE.BoxGeometry(0.05, 0.9, 0.05);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, trim);
    post.position.set(side * 0.52, 0.1, -0.3);
    post.rotation.z = side * 0.22;
    group.add(post);
  }
  const header = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.055, 0.06), trim);
  header.position.set(0, 0.6, -0.34);
  group.add(header);

  // Panel glow so the cockpit is the brightest thing at dusk.
  const glow = new THREE.PointLight('#ffb469', 1.5, 2.2, 2);
  glow.position.set(0, -0.42, -0.62);
  group.add(glow);

  group.traverse((child) => {
    if (child.isMesh) child.renderOrder = 2;
  });
  return group;
}
