// The renderer, the sky, the sun and the weather. Nothing here simulates; it only sets the stage.

import * as THREE from 'three';
import { WORLD, CAMERA } from '../config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  return renderer;
}

function skyDome() {
  const geometry = new THREE.SphereGeometry(WORLD.size * 2.4, 32, 20);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#1e5c86') },
      mid: { value: new THREE.Color('#8fb2c4') },
      low: { value: new THREE.Color('#ffd7a4') },
    },
    vertexShader: `
      varying float vH;
      void main() {
        vH = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      varying float vH;
      void main() {
        float h = clamp(vH, -1.0, 1.0);
        vec3 c = mix(low, mid, smoothstep(-0.06, 0.34, h));
        c = mix(c, top, smoothstep(0.24, 0.92, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  return new THREE.Mesh(geometry, material);
}

function cloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const puffs = 22;
  for (let i = 0; i < puffs; i++) {
    const x = 26 + Math.random() * 204;
    const y = 40 + Math.random() * 48;
    const r = 18 + Math.random() * 44;
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, 'rgba(255,251,244,0.85)');
    g.addColorStop(0.55, 'rgba(255,246,232,0.4)');
    g.addColorStop(1, 'rgba(255,240,224,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Soften the sprite's own square edge.
  const edge = ctx.createRadialGradient(128, 64, 40, 128, 64, 152);
  edge.addColorStop(0, 'rgba(255,250,244,0)');
  edge.addColorStop(1, 'rgba(255,250,244,0)');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sunSprite(inner, outer, size) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 4, 128, 128, 126);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sprite.scale.setScalar(size);
  return sprite;
}

export function buildSky(scene) {
  scene.add(skyDome());

  const sun = new THREE.DirectionalLight('#ffd9a2', 3.1);
  const sunAngle = WORLD.sunElevation * Math.PI;
  sun.position.set(Math.cos(sunAngle) * 2400, Math.sin(sunAngle) * 2200 + 260, -1900);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 200;
  sun.shadow.camera.far = 6200;
  sun.shadow.camera.left = -1600;
  sun.shadow.camera.right = 1600;
  sun.shadow.camera.top = 1600;
  sun.shadow.camera.bottom = -1600;
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  scene.add(new THREE.HemisphereLight('#cfe2ee', '#6a6150', 1.5));
  scene.add(new THREE.AmbientLight('#9db6c4', 0.6));

  const disc = sunSprite('rgba(255,246,222,0.98)', 'rgba(255,214,150,0)', 1300);
  disc.position.copy(sun.position).multiplyScalar(1.6);
  scene.add(disc);

  const glow = sunSprite('rgba(255,208,146,0.34)', 'rgba(255,190,124,0)', 2600);
  glow.position.copy(disc.position).multiplyScalar(0.998);
  scene.add(glow);

  const tex = cloudTexture();
  const cloudMaterial = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.NormalBlending });
  const clouds = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const sprite = new THREE.Sprite(cloudMaterial.clone());
    const scale = 320 + Math.random() * 520;
    sprite.scale.set(scale, scale * 0.42, 1);
    sprite.position.set((Math.random() - 0.5) * WORLD.size * 2.4, 520 + Math.random() * 700, (Math.random() - 0.5) * WORLD.size * 2.4);
    sprite.material.opacity = 0.2 + Math.random() * 0.24;
    clouds.add(sprite);
  }
  scene.add(clouds);

  scene.fog = new THREE.Fog('#c6c2ad', WORLD.fogNear, WORLD.fogFar);
  scene.background = new THREE.Color('#8fb2c4');
  return { sun, clouds };
}

export function applyCameraSettings(camera) {
  camera.fov = CAMERA.fov;
  camera.near = 0.4;
  camera.far = 12000;
  camera.updateProjectionMatrix();
}
