// "Ori, Can You...?" — smooth, modelled versions of the props people see most: parked cars (rounded body, glass, wheel arches), e-scooters and
// the leafy street / park trees. Same signed-distance tools as the characters (sdf.js): a field in, a smooth mesh with baked occlusion out, as
// THREE geometries ready for instancing (the paint takes the instance colour; glass, trim and leaves keep their own colour in the vertex colour).
import * as THREE from 'three';
import { smin, smax, sdSphere, sdEllipsoid, sdCapsule, sdRoundBox, meshSDF, aoAt } from './sdf.js';
import { mulberry32 } from '../rng.js';

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lin = (r, g, b) => [r, g, b].map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));

function toGeometry(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(m.colors, 3));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  g.computeBoundingSphere();
  return g;
}

/** Cylinder (axis z) distance, for the wheel arches. */
const sdCylZ = (x, y, z, cx, cy, r, hz) => Math.max(Math.hypot(x - cx, y - cy) - r, Math.abs(z) - hz);

/** A parked hatchback. Length along x (nose +x), width z, y up from the ground. Returns { body, details }: the paint (tinted per car) and the wheels + lights. */
export function carGeometry({ cell = 0.085 } = {}) {
  const field = (px, y, pz) => {
    const z = Math.abs(pz);
    let d = sdRoundBox(px, y, z, 0, 0.6, 0, 2.02, 0.29, 0.84, 0.26);
    d = smin(d, sdRoundBox(px, y, z, -0.18, 1.1, 0, 0.98, 0.34, 0.74, 0.3), 0.36); // the cabin
    d = smin(d, sdEllipsoid(px, y, z, 1.35, 0.88, 0, 0.7, 0.14, 0.7), 0.25); // a bonnet that slopes up to the glass
    for (const ax of [-1.28, 1.3]) d = smax(d, -sdCylZ(px, y, z - 0.86, ax, 0.36, 0.43, 0.3), 0.04); // wheel arches
    d = smax(d, 0.17 - y, 0.03);
    return d;
  };
  const paint = lin(0.97, 0.97, 0.97);
  const glass = lin(0.12, 0.17, 0.24);
  const trim = lin(0.1, 0.1, 0.11);
  const body = meshSDF(field, {
    min: [-2.4, 0.1, -1.1], max: [2.4, 1.6, 1.1], cell, smooth: 1,
    color: (x, y, z, nx, ny, nz) => {
      const ao = 0.55 + 0.45 * aoAt(field, x, y, z, nx, ny, nz, 0.18);
      const az = Math.abs(z);
      // glass: the band of the cabin where the surface faces sideways, forwards or back (not the roof)
      const inGlass = y > 0.98 && y < 1.4 && Math.abs(x + 0.2) < 1.02 && ny < 0.55 && (az > 0.3 || Math.abs(nx) > 0.5);
      const roofBlend = sstep(1.38, 1.3, y);
      if (inGlass && roofBlend > 0.01) return [glass[0] * ao, glass[1] * ao, glass[2] * ao];
      if (y < 0.4 && (Math.abs(x) > 1.8 || ny < -0.2)) return [trim[0] * ao, trim[1] * ao, trim[2] * ao]; // bumpers and sills
      const k = 0.92 + 0.08 * ny;
      return [paint[0] * ao * k, paint[1] * ao * k, paint[2] * ao * k];
    },
  });
  // wheels (tyre + a light rim) and lamps
  const parts = [];
  const tyre = lin(0.05, 0.05, 0.055);
  const rim = lin(0.62, 0.64, 0.68);
  const addCyl = (geo, mat, color) => { const g = geo.index ? geo.toNonIndexed() : geo; const n = g.attributes.position.count; const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set(color, i * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.applyMatrix4(mat); parts.push(g); };
  for (const x of [-1.28, 1.3]) for (const z of [-0.8, 0.8]) {
    const m = new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(x, 0.36, z);
    addCyl(new THREE.CylinderGeometry(0.37, 0.37, 0.24, 10), m, tyre);
    const m2 = new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(x, 0.36, z + Math.sign(z) * 0.035);
    addCyl(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 8), m2, rim);
  }
  const lamp = (x, z, c) => addCyl(new THREE.SphereGeometry(0.1, 8, 6), new THREE.Matrix4().compose(new THREE.Vector3(x, 0.68, z), new THREE.Quaternion(), new THREE.Vector3(0.5, 0.8, 1.6)), c);
  for (const z of [-0.62, 0.62]) { lamp(2.0, z, lin(1, 0.93, 0.7)); lamp(-2.0, z, lin(0.85, 0.15, 0.15)); }
  const merged = mergeGeos(parts);
  return { body: toGeometry(body), details: merged };
}

function mergeGeos(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const p = new Float32Array(n * 3); const nr = new Float32Array(n * 3); const c = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) { p.set(g.attributes.position.array, o * 3); nr.set(g.attributes.normal.array, o * 3); c.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(p, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nr, 3));
  out.setAttribute('color', new THREE.BufferAttribute(c, 3));
  out.computeBoundingSphere();
  return out;
}

/** A rental e-scooter: deck, stem, bars, two wheels. Body (tinted) + details. */
export function scooterGeometry({ cell = 0.03 } = {}) {
  const field = (x, y, pz) => {
    const z = pz;
    let d = sdRoundBox(x, y, z, 0.0, 0.34, 0, 0.62, 0.035, 0.12, 0.03); // the deck
    d = smin(d, sdCapsule(x, y, z, 0.58, 0.34, 0, 0.66, 1.02, 0, 0.026), 0.05); // the stem
    d = smin(d, sdCapsule(x, y, z, 0.66, 1.03, -0.26, 0.66, 1.03, 0.26, 0.022), 0.03); // the bars
    d = smin(d, sdRoundBox(x, y, z, 0.2, 0.4, 0, 0.16, 0.05, 0.1, 0.04), 0.04); // battery box
    d = smin(d, sdRoundBox(x, y, z, -0.52, 0.27, 0, 0.12, 0.02, 0.1, 0.01), 0.03); // rear fender
    return d;
  };
  const paint = lin(0.97, 0.97, 0.97);
  const body = meshSDF(field, {
    min: [-0.8, 0.15, -0.4], max: [0.85, 1.15, 0.4], cell, smooth: 1,
    color: (x, y, z, nx, ny, nz) => { const ao = 0.6 + 0.4 * aoAt(field, x, y, z, nx, ny, nz, 0.06); const dark = y > 0.7 ? 0.1 : 1; return [paint[0] * ao * dark, paint[1] * ao * dark, paint[2] * ao * dark]; },
  });
  const parts = [];
  const tyre = lin(0.06, 0.06, 0.07);
  for (const x of [-0.62, 0.62]) {
    const g = new THREE.CylinderGeometry(0.17, 0.17, 0.07, 14).toNonIndexed();
    const n = g.attributes.position.count; const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set(tyre, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(x, 0.17, 0));
    parts.push(g);
  }
  return { body: toGeometry(body), details: mergeGeos(parts) };
}

/** The blobs the street / park tree canopy is made from ([x, y, z, radius]); vegetation.js scatters leaf cards over the same ones. */
export const TREE_BLOBS = [[0, 3.5, 0, 1.55], [0.95, 3.0, 0.4, 1.15], [-0.9, 3.1, -0.5, 1.25], [0.1, 4.4, 0.15, 1.05], [-0.5, 3.0, 0.9, 1.0], [0.6, 3.7, -0.9, 0.95]];

/** A street / park tree: a trunk and a lumpy canopy of blended blobs, greens that get lighter towards the sun. */
export function treeGeometry({ cell = 0.13, seed = 5 } = {}) {
  const rnd = mulberry32(seed);
  const blobs = TREE_BLOBS;
  const lumps = [];
  for (let i = 0; i < 22; i++) { const b = blobs[i % blobs.length]; const a = rnd() * 6.283; const e = (rnd() - 0.2) * 1.2; lumps.push([b[0] + Math.cos(a) * Math.cos(e) * b[3] * 0.85, b[1] + Math.sin(e) * b[3] * 0.85, b[2] + Math.sin(a) * Math.cos(e) * b[3] * 0.85, 0.42 + rnd() * 0.3]); }
  const field = (x, y, z) => {
    let d = sdCapsule(x, y, z, 0, 0, 0, 0.05, 2.5, 0, 0.2, 0.13);
    d = smin(d, sdCapsule(x, y, z, 0.05, 2.3, 0, 0.8, 3.1, 0.3, 0.07), 0.12);
    let c = 9;
    for (const b of blobs) c = smin(c, sdSphere(x, y, z, b[0], b[1], b[2], b[3]), 0.55);
    for (const l of lumps) c = smin(c, sdSphere(x, y, z, l[0], l[1], l[2], l[3]), 0.25);
    return smin(d, c, 0.12);
  };
  const trunkC = lin(0.45, 0.33, 0.25);
  const mesh = meshSDF(field, {
    min: [-2.6, 0, -2.6], max: [2.6, 5.9, 2.6], cell, smooth: 1,
    color: (x, y, z, nx, ny, nz) => {
      const ao = 0.4 + 0.6 * aoAt(field, x, y, z, nx, ny, nz, 0.5);
      if (y < 2.55 && Math.hypot(x, z) < 0.4) return [trunkC[0] * ao, trunkC[1] * ao, trunkC[2] * ao];
      const sun = 0.5 + 0.5 * Math.max(0, ny);
      const v = 0.85 + 0.3 * Math.sin(x * 3.1 + y * 2.3) * Math.sin(z * 2.7 - y * 1.9);
      const g = lin(0.2 * v + 0.12 * sun, 0.5 * v + 0.2 * sun, 0.2 * v + 0.06 * sun);
      return [g[0] * ao, g[1] * ao, g[2] * ao];
    },
  });
  return toGeometry(mesh);
}

/** A terracotta pot with a bougainvillea bush: leaves in blended blobs, a scatter of magenta flowers. */
export function plantGeometry({ cell = 0.045, seed = 3 } = {}) {
  const rnd = mulberry32(seed);
  const leaves = [];
  for (let i = 0; i < 14; i++) { const a = rnd() * 6.283; const r = 0.12 + rnd() * 0.22; leaves.push([Math.cos(a) * r, 0.5 + rnd() * 0.42, Math.sin(a) * r, 0.1 + rnd() * 0.08]); }
  const flowers = [];
  for (let i = 0; i < 16; i++) { const a = rnd() * 6.283; const e = (rnd() - 0.3) * 1.3; const r = 0.3 + rnd() * 0.08; flowers.push([Math.cos(a) * Math.cos(e) * r, 0.7 + Math.sin(e) * 0.28, Math.sin(a) * Math.cos(e) * r, 0.045 + rnd() * 0.03]); }
  const potField = (x, y, z) => { const r = 0.2 + 0.07 * (y / 0.36); return Math.max(Math.hypot(x, z) - r, Math.abs(y - 0.18) - 0.18) - 0.012; };
  const leafField = (x, y, z) => { let d = 9; for (const l of leaves) d = smin(d, sdSphere(x, y, z, l[0], l[1], l[2], l[3]), 0.1); return smin(d, sdSphere(x, y, z, 0, 0.62, 0, 0.26), 0.15); };
  const flowerField = (x, y, z) => { let d = 9; for (const f of flowers) d = Math.min(d, sdSphere(x, y, z, f[0], f[1], f[2], f[3])); return d; };
  const field = (x, y, z) => Math.min(potField(x, y, z), leafField(x, y, z), flowerField(x, y, z));
  const pot = lin(0.76, 0.4, 0.27);
  const mesh = meshSDF(field, {
    min: [-0.55, 0, -0.55], max: [0.55, 1.2, 0.55], cell, smooth: 1,
    color: (x, y, z, nx, ny, nz) => {
      const ao = 0.45 + 0.55 * aoAt(field, x, y, z, nx, ny, nz, 0.12);
      if (potField(x, y, z) < 0.012 && y < 0.38) return [pot[0] * ao, pot[1] * ao, pot[2] * ao];
      if (flowerField(x, y, z) < 0.012) { const c = lin(0.88, 0.14, 0.5); return [c[0] * ao, c[1] * ao, c[2] * ao]; }
      const v = 0.8 + 0.4 * Math.sin(x * 21 + y * 17) * Math.sin(z * 19 - y * 11);
      const c = lin(0.16 * v, 0.46 * v, 0.17 * v);
      return [c[0] * ao, c[1] * ao, c[2] * ao];
    },
  });
  return toGeometry(mesh);
}

/** One cafe table with two chairs (wood, rounded). Local frame: table at the origin, chairs either side along z. */
export function cafeSetGeometry({ cell = 0.04 } = {}) {
  const field = (x, y, z) => {
    let d = sdRoundBox(x, y, z, 0, 0.74, 0, 0.36, 0.022, 0.36, 0.02); // top
    d = Math.min(d, sdCapsule(x, y, z, 0, 0.0, 0, 0, 0.72, 0, 0.026), sdRoundBox(x, y, z, 0, 0.012, 0, 0.17, 0.012, 0.17, 0.01));
    for (const s of [-1, 1]) {
      const cz = s * 0.62;
      d = Math.min(d, sdRoundBox(x, y, z, 0, 0.46, cz, 0.21, 0.025, 0.21, 0.02)); // seat
      d = Math.min(d, sdRoundBox(x, y, z, 0, 0.74, cz + s * 0.2, 0.2, 0.17, 0.014, 0.012)); // back
      for (const lx of [-0.17, 0.17]) for (const lz of [-0.17, 0.17]) d = Math.min(d, sdCapsule(x, y, z, lx, 0.0, cz + lz, lx, 0.44, cz + lz, 0.013));
    }
    return d;
  };
  const wood = lin(0.74, 0.55, 0.34);
  const mesh = meshSDF(field, {
    min: [-0.5, 0, -1.05], max: [0.5, 1.0, 1.05], cell, smooth: 0,
    color: (x, y, z, nx, ny, nz) => { const ao = 0.55 + 0.45 * aoAt(field, x, y, z, nx, ny, nz, 0.08); return [wood[0] * ao, wood[1] * ao, wood[2] * ao]; },
  });
  return toGeometry(mesh);
}
