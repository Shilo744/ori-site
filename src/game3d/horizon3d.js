// NEON DRIFT — the far world: the floor under everything (grid / sand / water) and the layered horizon silhouettes
// (skyline / mesas / mountains). Both follow the camera, so the world has no edge. One draw call each (the skyline adds a
// second additive one for its lit windows).
import * as THREE from 'three';
import { mulberry32 } from './rng.js';
import { gridTexture, sandTexture, windowTexture } from './textures3d.js';

/** The ground plane. `follow(camera)` snaps it to the texture grid under the camera. */
export function buildGround(biome, floorY, aniso) {
  const g = biome.ground;
  const size = 9000;
  let tile = 48;
  let mat;
  let map = null;
  if (g.kind === 'grid') {
    map = gridTexture(aniso);
    tile = 36;
    mat = new THREE.MeshStandardMaterial({ color: g.color, emissive: new THREE.Color(g.line), emissiveMap: map, emissiveIntensity: 1.5, roughness: 0.4, metalness: 0.55 });
  } else if (g.kind === 'sand') {
    map = sandTexture(aniso);
    tile = 70;
    mat = new THREE.MeshStandardMaterial({ color: g.color, map, roughness: 1, metalness: 0 });
  } else {
    mat = new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.06, metalness: 0, envMapIntensity: 0.9 });
  }
  if (map) map.repeat.set(size / tile, size / tile);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = floorY;
  mesh.frustumCulled = false;
  mesh.userData.follow = (camera) => {
    mesh.position.x = Math.round(camera.position.x / tile) * tile;
    mesh.position.z = Math.round(camera.position.z / tile) * tile;
  };
  mesh.userData.map = map;
  return mesh;
}

const SEGS = 540;

function ringProfile(kind, rnd, ringIndex) {
  const h = new Float32Array(SEGS);
  const k = 1 + ringIndex * 0.28;
  if (kind === 'skyline') {
    let i = 0;
    while (i < SEGS) {
      const run = 3 + Math.floor(rnd() * 7);
      const tall = rnd() < 0.12;
      const height = (tall ? 220 + rnd() * 220 : 40 + rnd() * 150) * k;
      for (let j = 0; j < run && i < SEGS; j++, i++) h[i] = height * (0.9 + rnd() * 0.15);
      if (rnd() < 0.5 && i < SEGS) { h[i] = 8; i++; } // a gap
    }
  } else if (kind === 'mesas') {
    for (let i = 0; i < SEGS; i++) h[i] = 14 + 12 * Math.sin(i * 0.13 + ringIndex) + 8 * Math.sin(i * 0.41);
    let i = Math.floor(rnd() * 10);
    while (i < SEGS - 24) {
      const w = 7 + Math.floor(rnd() * 14);
      const top = (90 + rnd() * 140) * k;
      for (let j = 0; j < w; j++) {
        const edge = Math.min(j, w - 1 - j);
        h[i + j] = Math.max(h[i + j], edge < 2 ? top * (0.25 + 0.4 * edge) : top);
      }
      i += w + 4 + Math.floor(rnd() * 22);
    }
  } else {
    let phase = rnd() * 10;
    for (let i = 0; i < SEGS; i++) {
      const a = (i / SEGS) * Math.PI * 2;
      const ridge = 0.55 + 0.45 * Math.sin(a * 5 + phase) * Math.sin(a * 11 + phase * 1.7);
      const peaks = Math.abs(Math.sin(a * 19 + phase * 2.3)) * 0.5 + Math.abs(Math.sin(a * 7 + phase)) * 0.5;
      h[i] = (60 + 480 * Math.max(0, ridge) * (0.45 + peaks) + 28 * Math.abs(Math.sin(a * 61 + phase * 3.1))) * k;
    }
  }
  return h;
}

/**
 * Three concentric silhouette rings at 2300 / 2750 / 3200 m: near = darker and more detailed, far = lighter (aerial perspective).
 * `follow(camera)` keeps them centred on the camera.
 */
export function buildHorizon(biome, fogColor, seed) {
  const hz = biome.horizon;
  const group = new THREE.Group();
  const own = [];
  const base = new THREE.Color(hz.color);
  const haze = new THREE.Color(fogColor);
  const radii = [2300, 2750, 3200];
  const windowTex = hz.kind === 'skyline' ? windowTexture(8) : null;
  if (windowTex) own.push(windowTex);
  radii.forEach((R, ri) => {
    const rnd = mulberry32(seed * 31 + ri * 7 + 1);
    const prof = ringProfile(hz.kind, rnd, ri);
    const snowLine = Math.max(...prof) * 0.74;
    const pos = new Float32Array((SEGS + 1) * 2 * 3);
    const col = new Float32Array((SEGS + 1) * 2 * 3);
    const wcol = new Float32Array((SEGS + 1) * 2 * 3);
    const uv = new Float32Array((SEGS + 1) * 2 * 2);
    const idx = [];
    const far = ri / (radii.length - 1);
    const top = base.clone().lerp(haze, 0.08 + 0.62 * far);
    const snow = new THREE.Color(0xeaf0ff).lerp(haze, 0.2 + 0.5 * far);
    const c = new THREE.Color();
    for (let i = 0; i <= SEGS; i++) {
      const a = (i / SEGS) * Math.PI * 2;
      const hgt = prof[i % SEGS];
      for (let v = 0; v < 2; v++) {
        const o = (i * 2 + v) * 3;
        pos[o] = Math.cos(a) * R;
        pos[o + 1] = v === 0 ? -80 : hgt;
        pos[o + 2] = Math.sin(a) * R;
        c.copy(top);
        col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
        const wv = v === 0 ? 0 : 1;
        wcol[o] = wv; wcol[o + 1] = wv; wcol[o + 2] = wv;
        uv[(i * 2 + v) * 2] = (i / SEGS) * (R * Math.PI * 2) / 64;
        uv[(i * 2 + v) * 2 + 1] = (v === 0 ? -80 : hgt) / 64;
      }
      if (i < SEGS) {
        const a0 = i * 2;
        idx.push(a0, a0 + 1, a0 + 3, a0, a0 + 3, a0 + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    // colour from the height (not from the vertices): haze at the foot, the rock colour above, snow over the snow line
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uHaze: { value: haze }, uTop: { value: top }, uSnow: { value: snow }, uSnowLine: { value: hz.kind === 'mountains' ? snowLine : 1e5 }, uMaxH: { value: Math.max(...prof) } },
      vertexShader: 'varying float vY; void main() { vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uHaze, uTop, uSnow; uniform float uSnowLine, uMaxH; varying float vY;
        void main() {
          vec3 col = mix(uHaze, uTop, smoothstep(-80.0, uMaxH * 0.5, vY));
          col = mix(col, uSnow, smoothstep(uSnowLine - 40.0, uSnowLine + 40.0, vY));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    own.push(mat);
    const ring = new THREE.Mesh(g, mat);
    ring.renderOrder = -50 + ri;
    ring.frustumCulled = false;
    group.add(ring);
    if (windowTex && hz.windows.length) {
      const wg = g.clone();
      wg.setAttribute('color', new THREE.BufferAttribute(wcol, 3));
      const wm = new THREE.MeshBasicMaterial({
        map: windowTex, vertexColors: true, color: new THREE.Color(hz.windows[ri % hz.windows.length]).multiplyScalar(1.0 - 0.3 * far),
        blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: true,
      });
      const win = new THREE.Mesh(wg, wm);
      win.renderOrder = -40 + ri;
      win.frustumCulled = false;
      group.add(win);
    }
  });
  group.userData.follow = (camera) => { group.position.set(camera.position.x, 0, camera.position.z); };
  group.userData.dispose = () => {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    own.forEach((t) => t.dispose());
  };
  return group;
}
