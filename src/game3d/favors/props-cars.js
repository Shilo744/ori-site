// "Ori, Can You...?" — parked cars: three smooth bodies (a small hatchback, a sedan, a delivery van) modelled as signed-distance forms (sdf.js) with wheel arches,
// glass, bumpers and sills, plus separate wheels (tyre + rim) and lamps. The paint takes the instance colour; glass, trim and lights keep their own colour in the vertex colour.
import * as THREE from 'three';
import { smin, smax, sdEllipsoid, sdRoundBox, meshSDF, aoAt } from './sdf.js';

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lin = (r, g, b) => [r, g, b].map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
const sdCylZ = (x, y, z, cx, cy, r, hz) => Math.max(Math.hypot(x - cx, y - cy) - r, Math.abs(z) - hz);

/** The three shapes: lower body, cabin, hood, wheel positions. Length along x (nose +x), width z, y up. */
const KINDS = {
  hatch: { hl: 2.02, hy: 0.29, y: 0.6, hw: 0.84, cab: { x: -0.18, y: 1.1, hl: 0.98, hy: 0.34, hw: 0.74 }, hood: [1.35, 0.88, 0.7, 0.14], wheels: [-1.28, 1.3], wr: 0.37, glassY: [0.98, 1.4], glassX: [-1.2, 0.82], lamps: 2.0 },
  sedan: { hl: 2.3, hy: 0.28, y: 0.58, hw: 0.86, cab: { x: -0.2, y: 1.06, hl: 1.0, hy: 0.3, hw: 0.74 }, hood: [1.5, 0.86, 0.8, 0.12], wheels: [-1.45, 1.5], wr: 0.37, glassY: [0.96, 1.34], glassX: [-1.2, 0.8], lamps: 2.28 },
  van: { hl: 2.3, hy: 0.62, y: 0.95, hw: 0.9, cab: { x: -0.35, y: 1.62, hl: 1.55, hy: 0.4, hw: 0.82 }, hood: [1.75, 1.18, 0.55, 0.2], wheels: [-1.45, 1.5], wr: 0.4, glassY: [1.42, 1.9], glassX: [0.75, 1.55], lamps: 2.28 },
};

function toGeometry(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(m.colors, 3));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  g.computeBoundingSphere();
  return g;
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

/** A parked car of the given kind ('hatch' | 'sedan' | 'van'). Returns { body, details }: the paint (tinted per car) and the wheels + lights. */
export function carGeometry({ cell = 0.085, kind = 'hatch' } = {}) {
  const K = KINDS[kind] || KINDS.hatch;
  const field = (px, y, pz) => {
    const z = Math.abs(pz);
    let d = sdRoundBox(px, y, z, 0, K.y, 0, K.hl, K.hy, K.hw, 0.26);
    d = smin(d, sdRoundBox(px, y, z, K.cab.x, K.cab.y, 0, K.cab.hl, K.cab.hy, K.cab.hw, 0.3), kind === 'van' ? 0.25 : 0.36); // the cabin
    d = smin(d, sdEllipsoid(px, y, z, K.hood[0], K.hood[1], 0, K.hood[2], K.hood[3], 0.7), 0.25); // a bonnet that slopes up to the glass
    for (const ax of K.wheels) d = smax(d, -(Math.max(Math.hypot(px - ax, y - 0.36) - (K.wr + 0.06), Math.abs(z - 0.86) - 0.3)), 0.04); // wheel arches
    d = smax(d, 0.17 - y, 0.03);
    return d;
  };
  const paint = lin(0.97, 0.97, 0.97);
  const glass = lin(0.1, 0.15, 0.22);
  const trim = lin(0.1, 0.1, 0.11);
  const body = meshSDF(field, {
    min: [-2.7, 0.1, -1.1], max: [2.7, 2.2, 1.1], cell, smooth: 1,
    color: (x, y, z, nx, ny, nz) => {
      const ao = 0.55 + 0.45 * aoAt(field, x, y, z, nx, ny, nz, 0.18);
      const az = Math.abs(z);
      const inGlass = y > K.glassY[0] && y < K.glassY[1] && x > K.glassX[0] && x < K.glassX[1] && ny < 0.55 && (az > 0.3 || Math.abs(nx) > 0.5);
      const roofBlend = sstep(K.glassY[1], K.glassY[1] - 0.1, y);
      if (inGlass && roofBlend > 0.01) return [glass[0] * ao, glass[1] * ao, glass[2] * ao];
      if (y < 0.4 && (Math.abs(x) > K.hl - 0.22 || ny < -0.2)) return [trim[0] * ao, trim[1] * ao, trim[2] * ao];
      const k = 0.92 + 0.08 * ny;
      return [paint[0] * ao * k, paint[1] * ao * k, paint[2] * ao * k];
    },
  });
  const parts = [];
  const tyre = lin(0.05, 0.05, 0.055);
  const rim = lin(0.66, 0.68, 0.72);
  const addGeo = (geo, mat, color) => { const g = geo.index ? geo.toNonIndexed() : geo; const n = g.attributes.position.count; const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.set(color, i * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.applyMatrix4(mat); parts.push(g); };
  for (const x of K.wheels) for (const z of [-0.8, 0.8]) {
    const m = new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(x, K.wr - 0.01, z);
    addGeo(new THREE.CylinderGeometry(K.wr, K.wr, 0.24, 14), m, tyre);
    const m2 = new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(x, K.wr - 0.01, z + Math.sign(z) * 0.035);
    addGeo(new THREE.CylinderGeometry(K.wr * 0.6, K.wr * 0.6, 0.2, 10), m2, rim);
  }
  const lamp = (x, z, c) => addGeo(new THREE.SphereGeometry(0.1, 8, 6), new THREE.Matrix4().compose(new THREE.Vector3(x, K.y + 0.08, z), new THREE.Quaternion(), new THREE.Vector3(0.5, 0.8, 1.6)), c);
  for (const z of [-0.62, 0.62]) { lamp(K.lamps, z, lin(1, 0.93, 0.7)); lamp(-K.lamps, z, lin(0.85, 0.15, 0.15)); }
  // a plate on the back and a mirror each side
  addGeo(new THREE.BoxGeometry(0.04, 0.12, 0.42), new THREE.Matrix4().makeTranslation(-K.hl - 0.02, K.y - 0.12, 0), lin(0.95, 0.9, 0.6));
  for (const z of [-0.95, 0.95]) addGeo(new THREE.BoxGeometry(0.1, 0.12, 0.1), new THREE.Matrix4().makeTranslation(K.cab.x + K.cab.hl * 0.55, K.y + K.hy + 0.1, z), trim);
  return { body: toGeometry(body), details: mergeGeos(parts), kind };
}
