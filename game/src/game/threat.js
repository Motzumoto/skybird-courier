// Ridge flak: puff bursts bloom ahead of the nose over the volcano and cost hull if they land close.
// Puffs are soft billboards, so a burst reads as smoke rather than as a grey ball.

import * as THREE from 'three';
import { groundAt } from '../terrain/heightfield.js';

function smokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  // Charcoal rather than pale grey: against a bright sky a light puff disappears, and smoke
  // from a burst is black anyway.
  gradient.addColorStop(0, 'rgba(58,54,50,0.97)');
  gradient.addColorStop(0.5, 'rgba(48,45,42,0.8)');
  // A defined shoulder before the fade keeps the edge legible when the puff is thumbnail-sized.
  gradient.addColorStop(0.74, 'rgba(44,41,38,0.42)');
  gradient.addColorStop(1, 'rgba(40,38,35,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  // A few lobes so each puff is ragged, not a clean disc.
  for (let i = 0; i < 12; i++) {
    const x = 26 + Math.random() * 76;
    const y = 26 + Math.random() * 76;
    const r = 8 + Math.random() * 16;
    const lobe = ctx.createRadialGradient(x, y, 2, x, y, r);
    lobe.addColorStop(0, 'rgba(78,72,66,0.72)');
    lobe.addColorStop(1, 'rgba(52,48,44,0)');
    ctx.fillStyle = lobe;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createThreat(scene) {
  const puffs = [];
  const flashes = [];
  const texture = smokeTexture();
  let timer = 0;

  function spawn(position, scale) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.85 }));
    sprite.position.copy(position);
    sprite.scale.setScalar(scale * 2.6);
    // A tighter, brighter core so the burst has a dense heart instead of reading as a smudge.
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.95, color: '#ffdcaa' }));
    core.position.copy(position);
    core.scale.setScalar(scale * 0.62);
    // The flash of the burst: a warm point inside the smoke that is gone in a quarter second, which
    // is what makes a still frame read as a burst rather than a smudge.
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffcb84', opacity: 0.9 }));
    flash.position.copy(position);
    flash.scale.setScalar(scale * 1.5);
    scene.add(sprite, core, flash);
    puffs.push({ sprite, core, flash, life: 0, scale });
  }

  return {
    puffs,
    update(dt, plane, active) {
      if (!plane.alive) return 0;
      for (let i = puffs.length - 1; i >= 0; i--) {
        const puff = puffs[i];
        puff.life += dt;
        puff.scale += dt * 24;
        puff.sprite.scale.setScalar(puff.scale * 2.6);
        puff.core.scale.setScalar(puff.scale * 0.62);
        puff.sprite.position.y += dt * 3.4;
        puff.sprite.material.opacity = Math.max(0, 0.85 - puff.life * 0.4);
        puff.core.material.opacity = Math.max(0, 0.92 - puff.life * 0.45);
        puff.flash.material.opacity = Math.max(0, 0.9 - puff.life * 3.6);
        puff.flash.scale.setScalar(puff.scale * (1.5 + puff.life * 2));
        if (puff.life > 2.4) {
          scene.remove(puff.sprite, puff.core, puff.flash);
          puff.sprite.material.dispose();
          puff.core.material.dispose();
          puff.flash.material.dispose();
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

      for (let i = 0; i < 3; i++) {
        const lobe = ahead.clone();
        lobe.x += (Math.random() - 0.5) * 40;
        lobe.y += (Math.random() - 0.5) * 26;
        lobe.z += (Math.random() - 0.5) * 40;
        spawn(lobe, 5 + Math.random() * 5);
      }

      const distance = ahead.distanceTo(plane.position);
      if (distance < 46) return 6;
      return 0;
    },
    // Drop one burst at a world point (used by the screenshot poses).
    place(position, scale = 3) {
      spawn(position, scale);
    },
    // A burst caught at the instant it goes off: bright, hard-edged and warm, so a still frame
    // shows the flash rather than only the smoke that follows it.
    flash(position, scale = 4) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: '#fffdf3',
        opacity: 1,
      }));
      sprite.position.copy(position);
      sprite.scale.setScalar(scale * 3.4);
      scene.add(sprite);
      flashes.push(sprite);
    },
    reset() {
      for (const puff of puffs) scene.remove(puff.sprite, puff.core, puff.flash);
      puffs.length = 0;
      for (const sprite of flashes) scene.remove(sprite);
      flashes.length = 0;
    },
  };
}
