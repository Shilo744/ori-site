// "Ori, Can You...?" — the small life of the street: pigeons that peck and burst into the air when somebody comes close (pigeons.js is their brain), three cats
// (one on a bench, one on the roof of a car, one on the kiosk counter) with swishing tails, petals / paper / leaves blown along the pavement by the sea
// breeze, and flags. All cheap: a few instanced meshes and one point cloud.
import * as THREE from 'three';
import { mulberry32 } from '../rng.js';
import { GeoBuilder } from './gfx.js';
import { smin, sdSphere, sdEllipsoid, sdCapsule, meshSDF, aoAt } from './sdf.js';
import { quadW } from './buildings/face.js';
import { createPigeons } from './pigeons.js';
import { groundHeight, KERB } from './map.js';

const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const V = new THREE.Vector3();
const S = new THREE.Vector3();
const E = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);
function put(B, geo, x, y, z, color, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  M.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz));
  B.geometry(geo, M, color);
}
const lin = (r, g, b) => [r, g, b].map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));

// ── pigeons ──
function pigeonGeometry() {
  const B = new GeoBuilder();
  const sph = new THREE.SphereGeometry(1, 10, 8);
  const cone = new THREE.ConeGeometry(1, 1, 6);
  put(B, sph, 0, 0.13, 0, '#8c919a', { sx: 0.095, sy: 0.092, sz: 0.17 });
  put(B, sph, 0, 0.14, 0.095, '#5f7a8f', { sx: 0.078, sy: 0.075, sz: 0.085 });
  put(B, sph, 0, 0.12, -0.06, '#9aa0a8', { sx: 0.08, sy: 0.07, sz: 0.1 });
  B.attr = 1; // the head: it bobs and pecks
  put(B, sph, 0, 0.225, 0.155, '#7e8794', { sx: 0.05, sy: 0.05, sz: 0.055 });
  put(B, cone, 0, 0.215, 0.215, '#d9a27a', { rx: Math.PI / 2, sx: 0.016, sy: 0.05, sz: 0.016 });
  for (const x of [-0.04, 0.04]) put(B, sph, x, 0.235, 0.17, '#e88a3a', { sx: 0.011, sy: 0.011, sz: 0.011 });
  B.attr = 0;
  B.setColor('#656a72').box(-0.05, 0.1, -0.31, 0.05, 0.115, -0.15);
  B.setColor('#d27a8c');
  for (const x of [-0.04, 0.04]) B.box(x - 0.007, 0.0, -0.01, x + 0.007, 0.09, 0.01);
  // the wings: folded against the body, spread and flapped in the vertex shader (weight 0 at the shoulder, 1 at the tip)
  for (const sd of [-1, 1]) {
    B.setColor('#6f757e');
    quadW(B, [sd * 0.085, 0.19, 0.1], [sd * 0.085, 0.19, -0.12], [sd * 0.17, 0.14, -0.2], [sd * 0.17, 0.15, 0.04], 0, 1, 0, [0, 0, 1, 1]);
    B.setColor('#8a909a');
    quadW(B, [sd * 0.17, 0.15, 0.04], [sd * 0.17, 0.14, -0.2], [sd * 0.24, 0.12, -0.3], [sd * 0.24, 0.13, -0.05], 0, 1, 0, [1, 1, 1, 1]);
  }
  sph.dispose(); cone.dispose();
  return B.build({ extraName: 'aPart', extraName2: 'aSway' });
}

function pigeonMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPart;\nattribute float aSway;\nattribute float iFly;\nattribute float iPeck;\nattribute float iPhase;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        if (aPart > 0.5) {
          float k = iPeck * 0.95; vec3 pv = vec3(0.0, 0.17, 0.1); vec3 d = transformed - pv;
          float c = cos(k); float s = sin(k);
          transformed = pv + vec3(d.x, d.y * c - d.z * s, d.y * s + d.z * c);
        }
        float wsw = aSway;
        transformed.x *= 1.0 + wsw * iFly * 1.5;
        transformed.y += wsw * (sin(iPhase) * 0.2 * iFly + iFly * 0.03);
        transformed.z += wsw * iFly * 0.05 * cos(iPhase);`);
  };
  mat.customProgramCacheKey = () => 'favors-pigeon';
  return mat;
}

// ── cats ──
function catGeometry(kind) {
  const base = kind === 'ginger' ? lin(0.86, 0.5, 0.2) : kind === 'grey' ? lin(0.5, 0.52, 0.56) : lin(0.08, 0.08, 0.09);
  const white = lin(0.95, 0.94, 0.92);
  const field = (x, y, z) => {
    const ax = Math.abs(x);
    let d = sdEllipsoid(x, y, z, 0, 0.17, -0.03, 0.115, 0.17, 0.14); // body
    d = smin(d, sdEllipsoid(x, y, z, ax * 1 > 0 ? 0 : 0, 0.1, -0.09, 0.15, 0.1, 0.15), 0.06); // haunches
    d = smin(d, sdSphere(x, y, z, 0, 0.345, 0.075, 0.088), 0.05); // head
    d = smin(d, sdCapsule(x, y, z, ax < 0.0001 ? 0.045 : 0.05, 0.34, 0.12, 0.05, 0.12, 0.13, 0.027), 0.04);
    d = Math.min(d, sdCapsule(x, y, z, 0.05, 0.28, 0.1, 0.055, 0.0, 0.12, 0.028)); // front legs
    d = Math.min(d, sdCapsule(x, y, z, -0.05, 0.28, 0.1, -0.055, 0.0, 0.12, 0.028));
    d = smin(d, sdCapsule(x, y, z, 0.055, 0.405, 0.06, 0.07, 0.46, 0.05, 0.012, 0.028), 0.03); // ears
    d = smin(d, sdCapsule(x, y, z, -0.055, 0.405, 0.06, -0.07, 0.46, 0.05, 0.012, 0.028), 0.03);
    return d;
  };
  const mesh = meshSDF(field, {
    min: [-0.3, 0, -0.35], max: [0.3, 0.5, 0.3], cell: 0.016, smooth: 1,
    color: (x, y, z, nx, ny, nz) => {
      const ao = 0.6 + 0.4 * aoAt(field, x, y, z, nx, ny, nz, 0.05);
      let c = base;
      if (kind !== 'ginger' && y < 0.28 && z > 0.02) c = white; // a white bib and paws
      if (kind === 'ginger' && y < 0.06) c = white;
      if (kind === 'tuxedo' && y < 0.3 && z > 0.02 && Math.abs(x) < 0.07) c = white;
      // the eyes and the nose
      const ex = Math.abs(x) - 0.034;
      if (Math.hypot(ex, y - 0.355, z - 0.147) < 0.017) c = lin(0.75, 0.85, 0.2);
      if (Math.hypot(x, y - 0.335, z - 0.155) < 0.011) c = lin(0.95, 0.6, 0.65);
      if (kind === 'grey' && Math.sin(y * 70) > 0.45 && y > 0.1) c = lin(0.3, 0.31, 0.34); // tabby stripes
      return [c[0] * ao, c[1] * ao, c[2] * ao];
    },
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(mesh.colors, 3));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  g.computeBoundingSphere();
  return { geo: g, tail: kind === 'ginger' ? base : kind === 'grey' ? lin(0.36, 0.37, 0.4) : base };
}

/** A cat's tail: a tube curling up behind it; aSway grows towards the tip (the wind material swishes it). */
function tailGeometry(color) {
  const B = new GeoBuilder();
  const segs = 8; const radial = 6;
  const pts = [];
  for (let i = 0; i <= segs; i++) { const t = i / segs; pts.push([Math.sin(t * 2.2) * 0.07, 0.04 + t * 0.07 + Math.sin(t * 3.0) * 0.05, -0.15 - Math.sin(t * 1.7) * 0.2 + t * 0.03]); }
  B.setColor(new THREE.Color().setRGB(color[0], color[1], color[2]));
  for (let i = 0; i < segs; i++) {
    const a = pts[i]; const b = pts[i + 1];
    const ra = 0.022 - 0.006 * (i / segs); const rb = 0.022 - 0.006 * ((i + 1) / segs);
    for (let k = 0; k < radial; k++) {
      const t0 = (k / radial) * Math.PI * 2; const t1 = ((k + 1) / radial) * Math.PI * 2;
      const p = (c, r, t) => [c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r, c[2]];
      const nx = Math.cos((t0 + t1) / 2); const ny = Math.sin((t0 + t1) / 2);
      const i0 = B.count;
      B.attr2 = i / segs; B.vert(...p(a, ra, t0), nx, ny, 0, 0, 0); B.vert(...p(a, ra, t1), nx, ny, 0, 0, 0);
      B.attr2 = (i + 1) / segs; B.vert(...p(b, rb, t1), nx, ny, 0, 0, 0); B.vert(...p(b, rb, t0), nx, ny, 0, 0, 0);
      B.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
    }
  }
  B.attr2 = 0;
  return B.build({ extraName2: 'aSway' });
}

// ── drifting petals, paper and leaves ──
const LITTER_VERT = /* glsl */ `
attribute vec3 aSeed; attribute vec3 aCol;
uniform float uTime; uniform vec3 uCam; uniform vec2 uWind; uniform float uScale;
varying vec3 vC;
void main() {
  vec3 box = vec3(64.0, 6.0, 64.0);
  float t = uTime * (0.7 + aSeed.x * 0.8);
  float x = mod(aSeed.x * box.x + uWind.x * t * 1.7 - uCam.x, box.x) - box.x * 0.5 + sin(t * 0.9 + aSeed.z * 30.0) * 0.7;
  float z = mod(aSeed.z * box.z + uWind.y * t * 1.7 - uCam.z, box.z) - box.z * 0.5 + cos(t * 1.1 + aSeed.x * 30.0) * 0.7;
  float y = 0.18 + abs(sin(t * 1.6 + aSeed.y * 20.0)) * (0.25 + aSeed.y * 1.6);
  vec3 p = vec3(uCam.x + x, y, uCam.z + z);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uScale * (0.6 + aSeed.y * 0.7) / -mv.z, 2.0, 10.0);
  vC = aCol;
}`;
const LITTER_FRAG = /* glsl */ `
varying vec3 vC;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  if (dot(q, q) > 0.22) discard;
  gl_FragColor = vec4(vC, 1.0);
  #include <colorspace_fragment>
}`;

function litter(count) {
  const rnd = mulberry32(2024);
  const seed = new Float32Array(count * 3); const col = new Float32Array(count * 3); const pos = new Float32Array(count * 3);
  const palette = [[0.9, 0.2, 0.5], [0.95, 0.35, 0.6], [0.98, 0.98, 0.96], [0.95, 0.9, 0.7], [0.35, 0.6, 0.25], [0.9, 0.55, 0.15]];
  for (let i = 0; i < count; i++) {
    seed.set([rnd(), rnd(), rnd()], i * 3);
    const c = palette[rnd() < 0.5 ? Math.floor(rnd() * 2) : Math.floor(rnd() * palette.length)];
    const k = new THREE.Color().setRGB(c[0], c[1], c[2]).convertSRGBToLinear();
    col.set([k.r, k.g, k.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const u = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2(1.0, 0.25) }, uScale: { value: 70 } };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: LITTER_VERT, fragmentShader: LITTER_FRAG, fog: false });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.name = 'litter';
  return { pts, u, dispose() { g.dispose(); m.dispose(); } };
}

/** Flags: a pole with a striped flag that waves (the weight grows along the cloth). */
function flagGeometry(w = 1.5, h = 0.95, stripes = ['#2d5aa8', '#ffffff', '#2d5aa8']) {
  const B = new GeoBuilder();
  const seg = 8;
  stripes.forEach((c, si) => {
    B.setColor(c);
    const y0 = (h * si) / stripes.length; const y1 = (h * (si + 1)) / stripes.length;
    for (let i = 0; i < seg; i++) quadW(B, [0, y0, (w * i) / seg], [0, y0, (w * (i + 1)) / seg], [0, y1, (w * (i + 1)) / seg], [0, y1, (w * i) / seg], 1, 0, 0, [i / seg, (i + 1) / seg, (i + 1) / seg, i / seg]);
  });
  return B;
}

export function createLife(map, { lib, shadows = true, tier = 'high' } = {}) {
  const group = new THREE.Group();
  group.name = 'life';
  const disposables = [];
  const mats = [];
  const rnd = mulberry32(map.seed * 17 + 1);

  // ── pigeons: flocks at the plaza of City Hall, the fountain, the café and the bus stop ──
  const spotOf = (id, side = 5, n = 4, r = 2.4) => { const d = map.places[id].door; return { x: d.x + d.nx * side, z: d.z + d.nz * side, n, r }; };
  const fp = map.places.park.rect;
  const spots = [spotOf('cityhall', 5, 6, 3), { x: (fp.x0 + fp.x1) / 2 + 5, z: (fp.z0 + fp.z1) / 2 + 4, n: 5, r: 2.6 }, spotOf('cafe', 3.2, 3, 1.4), spotOf('busstop', 1.6, 3, 1.2)];
  const pigeons = createPigeons(map.seed, spots);
  const n = pigeons.birds.length;
  const pg = pigeonGeometry();
  const iFly = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  const iPeck = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  const iPhase = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  pg.setAttribute('iFly', iFly); pg.setAttribute('iPeck', iPeck); pg.setAttribute('iPhase', iPhase);
  const pm = pigeonMaterial();
  const flock = new THREE.InstancedMesh(pg, pm, n);
  flock.castShadow = shadows; flock.receiveShadow = false; flock.frustumCulled = false; flock.name = 'pigeons';
  group.add(flock);
  disposables.push(pg); mats.push(pm);

  // ── cats ──
  const cats = [];
  const benches = map.props.filter((p) => p.type === 'bench');
  const cars = map.props.filter((p) => p.type === 'car');
  const kiosk = map.places.kiosk;
  const catSpots = [];
  if (benches.length) { const b = benches[Math.min(benches.length - 1, 2)]; catSpots.push({ x: b.x, z: b.z, y: groundHeight(map, b.x, b.z) + 0.48, ry: b.rot + Math.PI / 2 }); }
  if (cars.length) { const c = cars[Math.floor(cars.length / 3)]; catSpots.push({ x: c.x + Math.cos(c.rot) * 0.4, z: c.z - Math.sin(c.rot) * 0.4, y: 1.44, ry: c.rot + Math.PI / 2 }); }
  { const d = kiosk.door; catSpots.push({ x: d.fx + d.nx * 0.3 - d.nz * 0.7, z: d.fz + d.nz * 0.3 + d.nx * 0.7, y: KERB + 1.06, ry: Math.atan2(d.nx, d.nz) }); }
  const catMat = lib.plain({ roughness: 0.85, wet: false });
  const tailMat = lib.plain({ roughness: 0.85, wet: false, wind: { amp: 0.12, speed: 1.6, axis: 'xz' } });
  mats.push(catMat, tailMat);
  ['ginger', 'grey', 'tuxedo'].forEach((kind, i) => {
    const sp = catSpots[i];
    if (!sp) return;
    const { geo, tail } = catGeometry(kind);
    const m = new THREE.Mesh(geo, catMat);
    m.position.set(sp.x, sp.y, sp.z); m.rotation.y = sp.ry; m.castShadow = shadows; m.name = `cat-${kind}`;
    const t = new THREE.Mesh(tailGeometry(tail), tailMat);
    t.position.copy(m.position); t.rotation.y = sp.ry; t.name = `cat-tail-${kind}`;
    group.add(m, t);
    cats.push({ m, t, base: sp.y });
    disposables.push(geo, t.geometry);
  });

  // ── flags on City Hall ──
  const ch = map.places.cityhall;
  {
    const B = flagGeometry();
    const geo = B.build({ extraName2: 'aSway' });
    const fm = lib.plain({ roughness: 0.8, wet: false, wind: { amp: 0.4, speed: 3.0 }, extra: { side: THREE.DoubleSide } });
    mats.push(fm);
    const pole = new GeoBuilder().setColor('#dfe3e8');
    const roofY = ch.h + 0.92;
    const f = ch.rect;
    const side = { S: [1, 0, f.z1], N: [1, 0, f.z0], E: [0, 1, f.x1], W: [0, 1, f.x0] }[ch.side];
    const offs = [0.18, 0.5, 0.82];
    for (const o of offs) {
      const cx = side[1] ? side[2] : f.x0 + (f.x1 - f.x0) * o;
      const cz = side[1] ? f.z0 + (f.z1 - f.z0) * o : side[2];
      pole.box(cx - 0.04, roofY, cz - 0.04, cx + 0.04, roofY + 4.2, cz + 0.04);
      const flag = new THREE.Mesh(geo, fm);
      flag.position.set(cx + (side[1] ? 0 : 0.04), roofY + 3.1, cz + (side[1] ? 0.04 : 0));
      flag.rotation.y = side[1] ? 0 : -Math.PI / 2;
      flag.castShadow = false;
      group.add(flag);
    }
    const pm2 = new THREE.Mesh(pole.build(), lib.plain({ roughness: 0.4, metalness: 0.5 }));
    pm2.castShadow = shadows;
    group.add(pm2);
    disposables.push(geo, pm2.geometry);
  }

  // ── petals and paper on the breeze ──
  const lit = litter(tier === 'high' ? 90 : 50);
  group.add(lit.pts);
  void rnd; void UP;

  return {
    group,
    pigeons,
    cats,
    /** Per frame: `who` = [{ x, z }] the people the pigeons shy away from (Ori + the crowd near him). */
    update(dt, t, camera, who) {
      pigeons.update(dt, who);
      pigeons.birds.forEach((b, i) => {
        Q.setFromAxisAngle(UP, b.heading);
        M.compose(V.set(b.x, b.y + groundHeight(map, b.x, b.z), b.z), Q, S.set(1, 1, 1));
        flock.setMatrixAt(i, M);
        iFly.array[i] = b.fly; iPeck.array[i] = b.peck; iPhase.array[i] = b.phase;
      });
      flock.instanceMatrix.needsUpdate = true; iFly.needsUpdate = true; iPeck.needsUpdate = true; iPhase.needsUpdate = true;
      lit.u.uTime.value = t;
      lit.u.uCam.value.copy(camera.position);
      for (const c of cats) { const k = 1 + Math.sin(t * 1.7 + c.base * 5) * 0.012; c.m.scale.set(1, k, 1); c.t.scale.set(1, k, 1); }
    },
    dispose() { disposables.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); lit.dispose(); flock.dispose(); },
  };
}
