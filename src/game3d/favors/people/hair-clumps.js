// "Ori, Can You...?" — hair as BIG SCULPTED CLUMPS (style 'clumps': Shilo). The hair is a shell that follows the skull of the measured head (head-real.js; `A.base` is its
// distance field) plus a list of capsule clumps that give the volume and the swept-up waves. Every number is DATA in the person spec (hair.clumps, hair.hairline, hair.shell),
// and they were FITTED by scripts/_fit-hair.mjs so that the silhouette of the hair in front, side, back and top view matches the reference turnaround (.duo/gpt, private).
// PURE: returns { mesh, curls: null, bounds } like buildHair in hair.js (head frame; vertex colours carry the shading).
import { smin, smax, sdEllipsoid, sdCapsule, meshSDF, aoAt } from '../sdf.js';
import { linear } from './head.js';

const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The x positions where the hairline height is given (spec.hair.hairline = the 12 heights). */
export const HAIRLINE_X = [-0.122, -0.112, -0.102, -0.085, -0.055, -0.02, 0.02, 0.055, 0.085, 0.102, 0.112, 0.122];
export const HAIRLINE_DEFAULT = [0.03, 0.07, 0.098, 0.12, 0.142, 0.15, 0.151, 0.144, 0.124, 0.1, 0.07, 0.03];
/** Shell thickness: [base, top, front lift, side volume] (metres). */
export const SHELL_DEFAULT = [0.016, 0.022, 0.012, 0.03];

const tableAt = (xs, ys, x) => {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) { const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + (ys[i] - ys[i - 1]) * t; }
  return ys[ys.length - 1];
};

/** The fixed rules of the hair for a head `A` (anchors) and a hair spec: where it may grow and how thick the shell is. */
export function hairParts(spec, A) {
  const vol = spec.volume ?? 1;
  const line = spec.hairline || HAIRLINE_DEFAULT;
  const sh = spec.shell || SHELL_DEFAULT;
  const lineY = (x) => tableAt(HAIRLINE_X, line, x);
  const zW = spec.zWindow ?? 0.05; // the face window reaches back to here (further back the temple is skin too)
  // the lowest the hair grows: in front of the ear a narrow sideburn, behind it down to the nape
  const lowY = (ax, z) => {
    const side = 0.062 - 0.062 * sst(0.09, 0.1, ax) * sst(zW - 0.05, zW - 0.038, z) * sst(zW, zW - 0.022, z);
    return side + (-0.075 - side) * sst(-0.012, -0.05, z);
  };
  const thick = (x, y, z) => {
    const ax = Math.abs(x);
    let t = sh[0] + sh[1] * sst(0.045, 0.17, y) * (1 - 0.25 * sst(0.185, 0.209, y));
    t += sh[2] * vol * sst(0.045, 0.105, z) * sst(0.1, 0.16, y) * (1 - sst(0.07, 0.12, ax));
    t += sh[3] * vol * sst(0.02, 0.1, y) * sst(0.06, 0.1, ax) * sst(0.06, -0.04, z);
    t *= 1 - 0.5 * sst(-0.08, -0.15, z) * (1 - sst(0.12, 0.2, y));
    return t;
  };
  const earD = (ax, y, z) => sdEllipsoid(ax, y, z, 0.1185, 0.0041, -0.05, 0.05, 0.056, 0.04); // (the ear stays free)
  /** Is a point of the shell allowed to be hair (outside the face window, above the lowest line, clear of the ear)? */
  const allowed = (x, y, z) => {
    const ax = Math.abs(x);
    if (y < lowY(ax, z)) return false;
    if (z > zW && y < lineY(x) && ax < 0.122) return false;
    if (earD(ax, y, z) < 0) return false;
    return true;
  };
  return { lineY, lowY, thick, earD, allowed, zW };
}

/** A starting set of clumps for a head: capsule chains laid from the front over the crown to the back (the first guess the fitter improves). [ax, ay, az, bx, by, bz, r0, r1] */
export function defaultClumps(A, spec = {}) {
  const base = A.base;
  const D = Math.PI / 180;
  const C = [0, 0.05, -0.01];
  const skull = (nu, phi, off) => {
    const a = Math.abs(nu) * D; const ph = phi * D + (nu < 0 ? Math.PI : 0);
    const n = [Math.sin(a) * Math.sin(ph), Math.cos(nu * D), Math.sin(a) * Math.cos(ph)];
    let lo = 0.02; let hi = 0.32;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (base(C[0] + n[0] * m, C[1] + n[1] * m, C[2] + n[2] * m) < 0) lo = m; else hi = m; }
    const r = (lo + hi) / 2 + off;
    return [C[0] + n[0] * r, C[1] + n[1] * r, C[2] + n[2] * r];
  };
  const NU = [50, 43, 35, 26, 15, 4, -8, -22, -40, -60, -80];
  const OFF = [0.01, 0.03, 0.05, 0.062, 0.066, 0.064, 0.058, 0.05, 0.04, 0.03, 0.02];
  const RAD = [0.017, 0.022, 0.026, 0.028, 0.029, 0.029, 0.028, 0.026, 0.023, 0.02, 0.016];
  const K = spec.chains ?? 9; const rs = spec.rScale ?? 1; const stride = spec.stride ?? 2;
  const out = [];
  for (let k = 0; k < K; k++) {
    const u = (k / (K - 1)) * 2 - 1;
    const pts = NU.map((nu, i) => skull(nu, u * 78 + 3 * Math.sin((50 - nu) / 130 * Math.PI) * 10 * (spec.lean ?? 0.3) + 6 * Math.sin(k * 2.1 + (50 - nu) * 0.085), OFF[i] * (1 + 0.1 * Math.abs(u))));
    for (let i = 0; i < pts.length - 1; i += stride) out.push([...pts[i], ...pts[Math.min(i + stride, pts.length - 1)], RAD[i] * rs * (1 + 0.1 * Math.abs(u)), RAD[Math.min(i + stride, RAD.length - 1)] * rs * (1 + 0.1 * Math.abs(u))]);
  }
  return out;
}

/** The distance field of the whole hair (negative inside) in the head frame. */
export function clumpHairField(spec, A, clumps = spec.clumps) {
  const P = hairParts(spec, A);
  const base = A.base;
  const blend = spec.blend ?? 0.014;
  const reach = Math.max(...clumps.map((c) => Math.max(c[6], c[7]))) + blend + 0.01;
  const clumpD = (x, y, z) => {
    let d = 1;
    for (let i = 0; i < clumps.length; i++) {
      const c = clumps[i];
      d = smin(d, sdCapsule(x, y, z, c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]), blend);
    }
    return d;
  };
  void reach;
  return (x, y, z) => {
    const ax = Math.abs(x);
    const b = base(ax, y, z);
    if (b > 0.16 || y < -0.13) return Math.max(b, 0.05);
    let d = Math.max(b - P.thick(x, y, z), -(b + 0.03));
    if (sdEllipsoid(ax, y, z, 0, 0.12, -0.02, 0.2, 0.18, 0.23) < 0.05) d = smin(d, clumpD(x, y, z), blend);
    d = smax(d, P.lowY(ax, z) - y, 0.012);
    d = smax(d, -Math.max(P.zW - z, y - P.lineY(x), ax - 0.122), 0.012); // the face window
    d = smax(d, -P.earD(ax, y, z), 0.02);
    return d;
  };
}

/** @returns {{ mesh: object, curls: null, bounds: object }} */
export function buildClumpHair(spec = {}, A, { cell = 0.0065 } = {}) {
  const clumps = spec.clumps && spec.clumps.length ? spec.clumps : defaultClumps(A, spec);
  const P = hairParts(spec, A);
  const field = clumpHairField(spec, A, clumps);
  const col = linear(spec.color || '#3d291f');
  const hiC = linear(spec.highlight || '#58392a');
  const fadeC = linear(spec.fade || '#8a6a58');
  const mesh = meshSDF(field, {
    min: [-0.22, -0.12, -0.25], max: [0.22, 0.31, 0.22], cell, smooth: 1,
    color: (x, y, z, nx, ny, nz) => {
      const o = 0.4 + 0.6 * aoAt(field, x, y, z, nx, ny, nz, 0.03);
      const sheen = Math.max(0, ny) * 0.55 + 0.18 * Math.sin(x * 120 + Math.sin(z * 40) * 1.6) * Math.sin(z * 70 + y * 50);
      const t = Math.max(0, Math.min(1, sheen));
      let c = [col[0] + (hiC[0] - col[0]) * t, col[1] + (hiC[1] - col[1]) * t, col[2] + (hiC[2] - col[2]) * t];
      const ly = P.lowY(Math.abs(x), z);
      const f = 1 - sst(ly, ly + 0.035, y);
      c = [c[0] + (fadeC[0] - c[0]) * f * 0.5, c[1] + (fadeC[1] - c[1]) * f * 0.5, c[2] + (fadeC[2] - c[2]) * f * 0.5];
      return [c[0] * o, c[1] * o, c[2] * o];
    },
  });
  return { mesh, curls: null, bounds: { top: 0.3 } };
}
