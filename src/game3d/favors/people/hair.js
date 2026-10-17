// "Ori, Can You...?" — hair as a smooth lumpy volume: a dome round the skull plus a few hundred curl blobs blended into it (a signed distance
// field again, see sdf.js), carved back where the face, the ears and the neck must show. Styles: curly (Ori), short, buzz, wavy, long, bun,
// bald. PURE: gives a mesh in the head frame (vertex colours carry the shading: baked occlusion + a little tonal variation).
import { smin, smax, sdEllipsoid, sdSphere, meshSDF, aoAt } from '../sdf.js';
import { mulberry32 } from '../../rng.js';
import { linear } from './head.js';
import { MeshBuilder, sweepTube } from './geo.js';

export const HAIR_STYLES = ['curly', 'short', 'buzz', 'wavy', 'long', 'bun', 'bald'];

/** A bucketed set of blobs: the smooth union of the ones near a point (the rest cannot matter). */
function blobField(blobs, k, cellSize = 0.045) {
  const cells = new Map();
  const key = (i, j, l) => (i + 64) * 16384 + (j + 64) * 128 + (l + 64);
  blobs.forEach((b, n) => {
    const reach = Math.max(b.rx, b.ry, b.rz) + k + 0.004;
    const i0 = Math.floor((b.x - reach) / cellSize); const i1 = Math.floor((b.x + reach) / cellSize);
    const j0 = Math.floor((b.y - reach) / cellSize); const j1 = Math.floor((b.y + reach) / cellSize);
    const l0 = Math.floor((b.z - reach) / cellSize); const l1 = Math.floor((b.z + reach) / cellSize);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let l = l0; l <= l1; l++) { const c = key(i, j, l); let a = cells.get(c); if (!a) { a = []; cells.set(c, a); } a.push(n); }
  });
  return (x, y, z) => {
    const list = cells.get(key(Math.floor(x / cellSize), Math.floor(y / cellSize), Math.floor(z / cellSize)));
    let d = 1;
    if (!list) return d;
    for (let n = 0; n < list.length; n++) { const b = blobs[list[n]]; d = smin(d, sdEllipsoid(x, y, z, b.x, b.y, b.z, b.rx, b.ry, b.rz), k); }
    return d;
  };
}

/** Points on a Fibonacci sphere (unit vectors), n of them. */
function fib(n) {
  const out = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) { const y = 1 - (i + 0.5) * (2 / n); const r = Math.sqrt(1 - y * y); const a = i * ga; out.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
  return out;
}

const STYLE = {
  // dome radii (x, y, z), centre y, curl blob radius range, how many blobs, hairline height, how low the sides / back go
  curly: { r: [0.165, 0.158, 0.17], cy: 0.046, cz: -0.024, blob: [0.032, 0.05], n: 110, n2: 0, line: 0.064, side: -0.034, back: -0.13, k: 0.012, curls: 860, curlR: 0.0135, curlL: 0.042 },
  wavy: { r: [0.14, 0.138, 0.15], cy: 0.04, cz: -0.02, blob: [0.03, 0.044], n: 70, n2: 0, line: 0.082, side: 0.0, back: -0.1, k: 0.03, curls: 120, curlR: 0.016, curlL: 0.07 },
  short: { r: [0.131, 0.128, 0.136], cy: 0.034, cz: -0.014, blob: [0.02, 0.03], n: 40, n2: 0, line: 0.085, side: 0.02, back: -0.04, k: 0.03 },
  buzz: { r: [0.1235, 0.1215, 0.1285], cy: 0.032, cz: -0.012, blob: [0.01, 0.01], n: 0, n2: 0, line: 0.075, side: 0.02, back: -0.03, k: 0.02 },
  long: { r: [0.14, 0.138, 0.15], cy: 0.04, cz: -0.024, blob: [0.03, 0.04], n: 50, n2: 0, line: 0.085, side: -0.1, back: -0.36, k: 0.035 },
  bun: { r: [0.132, 0.13, 0.138], cy: 0.034, cz: -0.014, blob: [0.02, 0.03], n: 30, n2: 0, line: 0.082, side: 0.0, back: -0.05, k: 0.03 },
};

/** @returns {{ mesh: object, bounds: object }|null} the hair mesh in the head frame (null for bald) */
export function buildHair(spec = {}, A, { cell = 0.0065, seed = 7, quality = 1 } = {}) {
  const style = spec.style || 'curly';
  if (style === 'bald') return null;
  const S = STYLE[style] || STYLE.short;
  const vol = spec.volume ?? 1;
  const rnd = mulberry32(seed + 31 * HAIR_STYLES.indexOf(style));
  const R = S.r.map((v) => v * (v > 0.12 ? 1 + (vol - 1) * 0.5 : 1));
  const C = [0, S.cy, S.cz];
  const blobs = [];
  // the curl blobs sit on and just outside the dome
  const place = (count, rmin, rmax, off) => {
    const dirs = fib(Math.round(count * 1.7));
    let made = 0;
    for (const d of dirs) {
      const [dx, dy, dz] = d;
      if (dy < (style === 'curly' ? -0.42 : -0.12)) continue; // none far below the dome's equator
      if (dz > 0.25 && dy < 0.62) continue; // keep the face clear
      if (dz > 0.25 && Math.abs(dx) < 0.55 && dy < 0.78) continue;
      const jitter = 0.9 + rnd() * 0.18;
      const r = rmin + rnd() * (rmax - rmin);
      const x = C[0] + dx * (R[0] + off) * jitter;
      const y = C[1] + dy * (R[1] + off) * jitter;
      const z = C[2] + dz * (R[2] + off) * jitter;
      blobs.push({ x, y, z, rx: r, ry: r * (0.82 + rnd() * 0.3), rz: r * (0.9 + rnd() * 0.25) });
      made++;
    }
  };
  if (S.n) place(S.n, S.blob[0], S.blob[1], S.curls ? -0.034 : -0.012);
  if (S.n2) place(S.n2, S.blob[0] * 0.6, S.blob[1] * 0.62, 0.012);
  // a fringe: curls hanging over the forehead
  if (style === 'curly' || style === 'wavy') {
    const fr = style === 'curly' ? 15 : 6;
    for (let i = 0; i < fr; i++) {
      const u = fr > 1 ? 0.12 + (i / (fr - 1)) * 0.76 : 0.5;
      const x = (u - 0.5) * 0.21 + (rnd() - 0.5) * 0.012;
      const y = S.line - 0.005 - Math.sin(u * Math.PI) * 0.01 + (rnd() - 0.5) * 0.014 - (u < 0.25 ? 0.02 * (0.25 - u) * 4 : 0);
      const z = A.surface(Math.max(-0.08, Math.min(0.08, x)), y) + 0.008 + rnd() * 0.01;
      const r = style === 'curly' ? 0.017 + rnd() * 0.013 : 0.02;
      blobs.push({ x, y, z, rx: r, ry: r * 1.15, rz: r });
    }
  }
  const blobsD = blobField(blobs, S.k);
  const bunC = style === 'bun' ? [0, 0.1, -0.12] : null;
  const longBack = style === 'long';
  const field = (x, y, z) => {
    const ax = Math.abs(x);
    const shrink = S.curls ? 0.93 : 0.93; // the curls stand on a smaller, darker mass
    let d = sdEllipsoid(ax, y, z, C[0], C[1], C[2], R[0] * shrink, R[1] * shrink, R[2] * shrink);
    if (S.n || S.n2 || style === 'curly') d = smin(d, blobsD(x, y, z), S.k);
    if (bunC) d = smin(d, sdSphere(ax, y, z, bunC[0], bunC[1], bunC[2], 0.07), 0.03);
    if (longBack) { // a sheet of hair hanging behind the head and over the shoulders
      d = smin(d, sdEllipsoid(ax, y, z, 0, -0.17, -0.1, 0.125, 0.2, 0.06), 0.06);
    }
    // carve the face window (forehead / eyes / cheeks), then everything below the hairline at the sides and back
    const line = S.line + 0.03 * (ax / 0.1) ** 2;
    const face = Math.max(0.058 - z, y - line, ax - (style === 'buzz' ? 0.11 : 0.098));
    d = smax(d, -face, 0.016);
    const lowest = z > -0.05 ? S.side : S.side + (S.back - S.side) * Math.min(1, (-0.05 - z) / 0.1);
    d = smax(d, lowest - y, 0.012);
    return d;
  };
  const col = linear(spec.color || '#2a1a12');
  const hiC = linear(spec.highlight || spec.color || '#4d3220');
  const mesh = meshSDF(field, {
    min: [-0.25, -0.5, -0.27], max: [0.25, 0.3, 0.23], cell, smooth: 1,
    color: (x, y, z, nx, ny, nz) => {
      const o = 0.3 + 0.7 * aoAt(field, x, y, z, nx, ny, nz, 0.035);
      const sheen = Math.max(0, ny) * 0.5 + 0.18 * Math.sin(x * 190 + y * 130) * Math.sin(z * 170 - y * 90);
      const t = Math.max(0, Math.min(1, sheen));
      return [(col[0] + (hiC[0] - col[0]) * t) * o, (col[1] + (hiC[1] - col[1]) * t) * o, (col[2] + (hiC[2] - col[2]) * t) * o];
    },
  });
  // ringlets: helical tubes standing on the surface (the smooth volume underneath fills the gaps and stays dark)
  let curls = null;
  const count = Math.round((S.curls ?? 0) * (spec.curlDensity ?? 1) * (quality ?? 1));
  if (count > 0) {
    const B = new MeshBuilder();
    const dirs = fib(Math.round(count * 1.7));
    let made = 0;
    const grad = (x, y, z) => { const e = 0.004; const gx = field(x + e, y, z) - field(x - e, y, z); const gy = field(x, y + e, z) - field(x, y - e, z); const gz = field(x, y, z + e) - field(x, y, z - e); const l = Math.hypot(gx, gy, gz) || 1; return [gx / l, gy / l, gz / l]; };
    for (const d of dirs) {
      const [dx, dy, dz] = d;
      if (dy < -0.4) continue;
      // march out from the dome's centre to the hair surface
      let lo = 0.04; let hi = 0.36;
      if (field(C[0] + dx * lo, C[1] + dy * lo, C[2] + dz * lo) > 0) continue;
      if (field(C[0] + dx * hi, C[1] + dy * hi, C[2] + dz * hi) < 0) continue;
      for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (field(C[0] + dx * m, C[1] + dy * m, C[2] + dz * m) < 0) lo = m; else hi = m; }
      const px = C[0] + dx * lo; const py = C[1] + dy * lo; const pz = C[2] + dz * lo;
      if (pz > 0.03 && py < S.line + 0.002 && Math.abs(px) < 0.1) continue; // nothing on the face window
      const n = grad(px, py, pz);
      const g = 0.22 + 0.28 * Math.max(0, -n[1]); // curls hang a little, more on the sides
      let ax = n[0]; let ay = n[1] - g; let az = n[2];
      const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
      // an orthonormal frame round the axis
      const ref = Math.abs(ay) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let ux = ay * ref[2] - az * ref[1]; let uy = az * ref[0] - ax * ref[2]; let uz = ax * ref[1] - ay * ref[0];
      const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      const vx = ay * uz - az * uy; const vy = az * ux - ax * uz; const vz = ax * uy - ay * ux;
      const rh = (S.curlR || 0.012) * (0.8 + rnd() * 0.5);
      const L = (S.curlL || 0.05) * (0.7 + rnd() * 0.7);
      const turns = 1.4 + rnd() * 1.0;
      const ph = rnd() * 6.283;
      const steps = 13;
      const pts = [];
      for (let k = 0; k < steps; k++) {
        const t = k / (steps - 1);
        const a = ph + t * turns * 6.283;
        const rr = rh * (1 - 0.3 * t);
        const along = -0.012 + L * t;
        pts.push([px + ax * along + (ux * Math.cos(a) + vx * Math.sin(a)) * rr, py + ay * along + (uy * Math.cos(a) + vy * Math.sin(a)) * rr, pz + az * along + (uz * Math.cos(a) + vz * Math.sin(a)) * rr]);
      }
      const tone = 0.8 + rnd() * 0.45;
      sweepTube(B, pts, (t) => 0.0092 * (1 - 0.35 * t), {
        sides: 5, up: [0, 1, 0], bone: undefined,
        color: (t, phi) => { const k = (0.32 + 0.68 * t) * tone * (0.62 + 0.38 * Math.max(0, Math.cos(phi))); const m = k + 0.35 * t * t * Math.max(0, ny0(phi)); return [col[0] * m * 1.25 + hiC[0] * 0.45 * t * t, col[1] * m * 1.25 + hiC[1] * 0.45 * t * t, col[2] * m * 1.25 + hiC[2] * 0.45 * t * t]; },
      });
      made++;
    }
    curls = B.finish();
  }
  return { mesh, curls, bounds: { top: C[1] + R[1] } };
}
const ny0 = (phi) => Math.cos(phi);
