// "Ori, Can You...?" — the Tel Aviv roof: solar water heaters (a tilted collector with a tank on top), water tanks on frames, stair cores, satellite dishes,
// antennas with crossbars and AC condensers; plus the terracotta gable of Auntie's house.
import * as THREE from 'three';

const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const V = new THREE.Vector3();
const S = new THREE.Vector3();
const euler = new THREE.Euler();

/** Appends a three geometry under position / euler rotation / scale with a flat colour. */
function put(B, geo, x, y, z, color, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  Q.setFromEuler(euler.set(rx, ry, rz));
  M.compose(V.set(x, y, z), Q, S.set(sx, sy, sz));
  B.geometry(geo, M, color);
}

let shared = null;
function geos() {
  if (shared) return shared;
  shared = {
    cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
    cap: new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    dish: new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4),
    fan: new THREE.CylinderGeometry(1, 1, 1, 16),
  };
  return shared;
}
export function disposeRoofGeos() { if (shared) { Object.values(shared).forEach((g) => g.dispose()); shared = null; } }

/** Everything on a flat roof. `y` = the roof level. */
export function rooftop(b, r, y, rnd, st) {
  const g = geos();
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const at = (fx, fz) => [r.x0 + 1.6 + (w - 3.2) * fx, r.z0 + 1.6 + (d - 3.2) * fz];
  const R = b.roofs;
  // a stair / lift core
  if (rnd() < 0.8) {
    const [x, z] = at(0.55 + rnd() * 0.3, 0.55 + rnd() * 0.3);
    R.setColor('#e6e1d8').box(x - 1.3, y, z - 1.2, x + 1.3, y + 2.5, z + 1.2);
    R.setColor('#cfc9be').box(x - 1.45, y + 2.5, z - 1.35, x + 1.45, y + 2.64, z + 1.35);
    R.setColor('#5a6068').box(x - 0.45, y, z + 1.2, x + 0.45, y + 2.0, z + 1.23);
  }
  // a solar water heater (a collector tilted towards the sun and a tank on top)
  if (rnd() < 0.85) {
    const [x, z] = at(0.1 + rnd() * 0.6, 0.1 + rnd() * 0.6);
    const n = 1 + (rnd() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const xx = x + i * 2.4;
      R.setColor('#25324a');
      put(R, new THREE.BoxGeometry(2.0, 0.07, 1.3), xx, y + 0.65, z, '#26344f', { rx: -0.5 });
      R.setColor('#9aa0a8').box(xx - 1.0, y, z - 0.5, xx - 0.92, y + 0.45, z - 0.43).box(xx + 0.92, y, z - 0.5, xx + 1.0, y + 0.45, z - 0.43).box(xx - 1.0, y, z + 0.45, xx - 0.92, y + 0.85, z + 0.52).box(xx + 0.92, y, z + 0.45, xx + 1.0, y + 0.85, z + 0.52);
      put(R, g.cyl, xx, y + 1.18, z + 0.35, '#e9ecef', { rz: Math.PI / 2, sx: 0.3, sy: 1.5, sz: 0.3 });
      put(R, g.cap, xx + 0.75, y + 1.18, z + 0.35, '#e9ecef', { rz: -Math.PI / 2, sx: 0.3, sy: 0.3, sz: 0.3 });
      put(R, g.cap, xx - 0.75, y + 1.18, z + 0.35, '#e9ecef', { rz: Math.PI / 2, sx: 0.3, sy: 0.3, sz: 0.3 });
    }
  }
  // a water tank on a steel frame
  if (rnd() < 0.55) {
    const [x, z] = at(0.15 + rnd() * 0.7, 0.15 + rnd() * 0.7);
    R.setColor('#7d838c');
    for (const dx of [-0.6, 0.6]) for (const dz of [-0.6, 0.6]) R.box(x + dx - 0.05, y, z + dz - 0.05, x + dx + 0.05, y + 1.1, z + dz + 0.05);
    R.box(x - 0.75, y + 1.08, z - 0.75, x + 0.75, y + 1.16, z + 0.75);
    put(R, g.cyl, x, y + 1.9, z, '#dfe3e8', { sx: 0.7, sy: 1.5, sz: 0.7 });
    put(R, g.cap, x, y + 2.65, z, '#cfd4da', { sx: 0.7, sy: 0.35, sz: 0.7 });
  }
  // dishes, antennas and AC condensers
  const nDish = Math.floor(rnd() * 3);
  for (let i = 0; i < nDish; i++) {
    const [x, z] = at(rnd(), rnd());
    R.setColor('#9aa0a8').box(x - 0.03, y, z - 0.03, x + 0.03, y + 0.7, z + 0.03);
    put(R, g.dish, x, y + 0.85, z, '#e2e5e9', { rx: -0.9, ry: rnd() * 6, sx: 0.4, sy: 0.4, sz: 0.4 });
  }
  if (rnd() < 0.6) {
    const [x, z] = at(rnd(), rnd());
    R.setColor('#8a9098').box(x - 0.03, y, z - 0.03, x + 0.03, y + 3.4, z + 0.03);
    for (let k = 0; k < 4; k++) R.box(x - 0.45 + k * 0.05, y + 2.0 + k * 0.4, z - 0.015, x + 0.45 - k * 0.05, y + 2.03 + k * 0.4, z + 0.015);
  }
  const nAc = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < nAc; i++) {
    const [x, z] = at(rnd(), rnd());
    R.setColor('#d9dbde').box(x - 0.5, y, z - 0.4, x + 0.5, y + 0.8, z + 0.4);
    put(R, g.fan, x, y + 0.82, z, '#3a3f46', { sx: 0.3, sy: 0.04, sz: 0.3 });
  }
  void st;
}

/** Auntie's house: a terracotta gable along the longer side (uv in metres so the tile pattern keeps its scale). */
export function gableRoof(b, r, h) {
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const rise = 2.6;
  const ov = 0.5;
  const B = b.tiles;
  B.setColor('#ffffff');
  const L = alongX ? r.x1 - r.x0 + 2 * ov : r.z1 - r.z0 + 2 * ov;
  const slope = Math.hypot(rise, (alongX ? r.z1 - r.z0 : r.x1 - r.x0) / 2 + ov);
  const uv = [0, 0, L / 2, 0, L / 2, slope / 2, 0, slope / 2];
  if (alongX) {
    const zm = (r.z0 + r.z1) / 2;
    B.quad([r.x0 - ov, h, r.z1 + ov], [r.x1 + ov, h, r.z1 + ov], [r.x1 + ov, h + rise, zm], [r.x0 - ov, h + rise, zm], 0, 0.9, 0.45, uv);
    B.quad([r.x1 + ov, h, r.z0 - ov], [r.x0 - ov, h, r.z0 - ov], [r.x0 - ov, h + rise, zm], [r.x1 + ov, h + rise, zm], 0, 0.9, -0.45, uv);
    B.setColor('#f3eee6');
    B.quad([r.x0, h, r.z0], [r.x0, h, r.z1], [r.x0, h + rise * 0.96, zm], [r.x0, h + rise * 0.96, zm], -1, 0, 0);
    B.quad([r.x1, h, r.z1], [r.x1, h, r.z0], [r.x1, h + rise * 0.96, zm], [r.x1, h + rise * 0.96, zm], 1, 0, 0);
  } else {
    const xm = (r.x0 + r.x1) / 2;
    B.quad([r.x1 + ov, h, r.z1 + ov], [r.x1 + ov, h, r.z0 - ov], [xm, h + rise, r.z0 - ov], [xm, h + rise, r.z1 + ov], 0.45, 0.9, 0, uv);
    B.quad([r.x0 - ov, h, r.z0 - ov], [r.x0 - ov, h, r.z1 + ov], [xm, h + rise, r.z1 + ov], [xm, h + rise, r.z0 - ov], -0.45, 0.9, 0, uv);
    B.setColor('#f3eee6');
    B.quad([r.x0, h, r.z1], [r.x1, h, r.z1], [xm, h + rise * 0.96, r.z1], [xm, h + rise * 0.96, r.z1], 0, 0, 1);
    B.quad([r.x1, h, r.z0], [r.x0, h, r.z0], [xm, h + rise * 0.96, r.z0], [xm, h + rise * 0.96, r.z0], 0, 0, -1);
  }
}
