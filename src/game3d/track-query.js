// NEON DRIFT track queries: arc length -> road frame, closest point on the road, surface point/normal. PURE (no three, no DOM).
// The tables come from track-gen.js (see there for the conventions: x, z ground plane, heading ψ, right = (−sin ψ, cos ψ),
// lateral + = right of the centre line, bank > 0 = right edge lower).
import { wrapIdx } from './rng.js';

export const DS = 2; // sample spacing along the centre line (m)
export const WALL_MARGIN = 6; // run-off strip between the road edge and the wall (m)

/** Wraps s into [0, length). */
export function wrapS(t, s) {
  s %= t.length;
  return s < 0 ? s + t.length : s;
}

/** Signed circular difference b − a along the track, in (−length/2, length/2]. */
export function deltaS(t, a, b) {
  let d = (b - a) % t.length;
  if (d > t.length / 2) d -= t.length;
  else if (d <= -t.length / 2) d += t.length;
  return d;
}

/**
 * The road frame at arc length `s`: position, tangent, right vector, width, bank, curvature, grade.
 * Allocation-free when `out` is passed.
 */
export function frameAt(t, s, out = {}) {
  const n = t.n;
  const f = wrapS(t, s) / t.ds;
  const i = Math.floor(f) % n;
  const j = (i + 1) % n;
  const u = f - Math.floor(f);
  const w = 1 - u;
  out.s = wrapS(t, s);
  out.x = t.x[i] * w + t.x[j] * u;
  out.y = t.y[i] * w + t.y[j] * u;
  out.z = t.z[i] * w + t.z[j] * u;
  let tx = t.tx[i] * w + t.tx[j] * u;
  let tz = t.tz[i] * w + t.tz[j] * u;
  const l = Math.hypot(tx, tz) || 1;
  tx /= l;
  tz /= l;
  out.tx = tx;
  out.tz = tz;
  out.rx = -tz;
  out.rz = tx;
  out.heading = Math.atan2(tz, tx);
  out.width = t.width[i] * w + t.width[j] * u;
  out.bank = t.bank[i] * w + t.bank[j] * u;
  out.kappa = t.kappaS[i] * w + t.kappaS[j] * u;
  out.grade = t.grade[i] * w + t.grade[j] * u;
  return out;
}

/** The road surface point at arc length `s` and lateral offset `lat` (metres, + = right). */
export function surfacePoint(t, s, lat, out = {}) {
  const fr = frameAt(t, s, _fr);
  const cb = Math.cos(fr.bank);
  out.x = fr.x + fr.rx * lat * cb;
  out.z = fr.z + fr.rz * lat * cb;
  out.y = fr.y - Math.sin(fr.bank) * lat;
  return out;
}
const _fr = {};

/** Unit surface normal (nx, ny, nz) at a frame returned by frameAt. */
export function surfaceNormal(fr, out = {}) {
  const cb = Math.cos(fr.bank);
  const sb = Math.sin(fr.bank);
  const g = Math.atan(fr.grade);
  const cg = Math.cos(g);
  const sg = Math.sin(g);
  // right edge direction (rx·cb, −sb, rz·cb) × tangent (tx·cg, sg, tz·cg)
  const ax = fr.rx * cb;
  const ay = -sb;
  const az = fr.rz * cb;
  const bx = fr.tx * cg;
  const by = sg;
  const bz = fr.tz * cg;
  let nx = ay * bz - az * by;
  let ny = az * bx - ax * bz;
  let nz = ax * by - ay * bx;
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l; ny /= l; nz /= l;
  out.nx = nx; out.ny = ny; out.nz = nz;
  return out;
}

/**
 * Closest point of the centre line to (px, pz): { s, lateral, heading, idx, dist, width }.
 * With `hint` (a previous `idx`) only ±`win` samples are searched — falling back to a full scan when that finds
 * nothing close (a teleport). Allocation-free when `out` is passed.
 */
export function closest(t, px, pz, hint = -1, out = {}) {
  const n = t.n;
  let best = -1;
  let bd = Infinity;
  if (hint >= 0) {
    const win = 40;
    for (let k = -win; k <= win; k++) {
      const i = wrapIdx(hint + k, n);
      const dx = t.x[i] - px;
      const dz = t.z[i] - pz;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    if (bd > 60 * 60) { best = -1; bd = Infinity; }
  }
  if (best < 0) {
    for (let i = 0; i < n; i++) {
      const dx = t.x[i] - px;
      const dz = t.z[i] - pz;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
  }
  // refine on the two neighbouring segments
  let bestT = 0;
  let bestSeg = best;
  let bestD = Infinity;
  for (let k = -1; k <= 0; k++) {
    const a = wrapIdx(best + k, n);
    const b = (a + 1) % n;
    const ex = t.x[b] - t.x[a];
    const ez = t.z[b] - t.z[a];
    const len2 = ex * ex + ez * ez || 1;
    let u = ((px - t.x[a]) * ex + (pz - t.z[a]) * ez) / len2;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const qx = t.x[a] + ex * u - px;
    const qz = t.z[a] + ez * u - pz;
    const d = qx * qx + qz * qz;
    if (d < bestD) { bestD = d; bestSeg = a; bestT = u; }
  }
  const a = bestSeg;
  const b = (a + 1) % n;
  const u = bestT;
  let tx = t.tx[a] * (1 - u) + t.tx[b] * u;
  let tz = t.tz[a] * (1 - u) + t.tz[b] * u;
  const l = Math.hypot(tx, tz) || 1;
  tx /= l;
  tz /= l;
  const cx = t.x[a] + (t.x[b] - t.x[a]) * u;
  const cz = t.z[a] + (t.z[b] - t.z[a]) * u;
  out.idx = u > 0.5 ? b : a;
  out.s = wrapS(t, (a + u) * t.ds);
  out.lateral = (px - cx) * -tz + (pz - cz) * tx;
  out.heading = Math.atan2(tz, tx);
  out.tx = tx;
  out.tz = tz;
  out.dist = Math.sqrt(bestD);
  out.width = t.width[a] * (1 - u) + t.width[b] * u;
  return out;
}

/** Distance from the centre line to the wall for a road of this width (m). */
export const wallDistance = (width) => width / 2 + WALL_MARGIN;
