// "Ori, Can You...?" — the life on a facade: balconies with railings, plants and a chair, AC units on brackets, window boxes, washing on a line, drain pipes.
// Plants are not drawn here: they are collected as INSTANCES (a position + a kind) and drawn by foliage.js, so a whole street of bougainvillea is a few draw calls.
import { FLOOR, RC, faceBox, faceQuad, quadW, P, hash01 } from './face.js';

const LAUNDRY = ['#f4efe6', '#e5625e', '#4a90e2', '#f2c14e', '#43b581', '#ffffff', '#e7a8c4', '#2f3a5a'];
const POT = '#b5603e';

/** Hooks called while the openings of a face are built. `inst` collects plant instances: { kind, x, y, z, rot, s, c }. */
export function createExtras(b, inst, rnd) {
  return {
    onOpening({ f, r, o, st, seed, key }) {
      const { s0, s1, y0, y1, door, fl } = o;
      if (door) return;
      // an AC unit on the wall next to a window
      if (st.ac && seed > 0.18 && seed < 0.3) acUnit(b, f, r, s1 + 0.55, y0 + 0.2, st);
      // a window box with flowers on the sill
      if (st.planters && seed > 0.55 && seed < 0.66 && fl > 0) {
        b.fine.setColor(POT);
        faceBox(b.fine, f, r, s0 + 0.05, s1 - 0.05, y0 + 0.02, y0 + 0.26, 0.2, 0.0);
        const p = P(f, r, (s0 + s1) / 2, y0 + 0.26, 0.1);
        const flowering = hash01(st.seed, fl, 17) < 0.6;
        inst.push({ kind: 'box', x: p[0], y: p[1], z: p[2], rot: Math.atan2(f.n[0], f.n[1]), s: (s1 - s0) * 0.62, c: flowering ? '#e0307a' : '#4f9a52' });
      }
      // washing on a line out of the window
      if (st.laundry && seed > 0.9 && fl > 0) laundry(b, f, r, s1 + 0.1, s1 + 2.5, y1 - 0.2, rnd, st);
    },
    onShopWindow({ f, r, a, c, key, seed }) {
      // flower pots on the ledge of some shops
      if (seed < 0.5) {
        const n = Math.max(1, Math.floor((c - a) / 1.6));
        for (let i = 0; i < n; i++) {
          const s = a + ((c - a) * (i + 0.5)) / n;
          const p = P(f, r, s, 0.62, 0.1);
          inst.push({ kind: 'pot', x: p[0], y: p[1], z: p[2], rot: rnd() * 6.28, s: 0.5 + rnd() * 0.2, c: seed < 0.25 ? '#e0307a' : '#4f9a52' });
        }
      }
      void key;
    },
  };
}

function acUnit(b, f, r, s, y, st) {
  b.trim.setColor('#e9eaec');
  faceBox(b.trim, f, r, s - 0.42, s + 0.42, y, y + 0.55, 0.38, 0.0);
  b.metal.setColor('#6a7078');
  faceQuad(b.metal, f, r, s - 0.34, s + 0.0, y + 0.06, y + 0.49, 0.385);
  b.metal.setColor('#9aa0a8');
  faceBox(b.metal, f, r, s - 0.5, s - 0.46, y - 0.15, y + 0.2, 0.1, 0.0);
  faceBox(b.metal, f, r, s + 0.46, s + 0.5, y - 0.15, y + 0.2, 0.1, 0.0);
  void st; void RC;
}

/** A line with a few clothes on it, running along the wall at a little distance. */
function laundry(b, f, r, s0, s1, y, rnd, st) {
  b.metal.setColor('#6a6e75');
  faceBox(b.metal, f, r, s0 - 0.02, s0 + 0.02, y - 0.2, y + 0.1, 0.34, 0.0);
  faceBox(b.metal, f, r, s1 - 0.02, s1 + 0.02, y - 0.2, y + 0.1, 0.34, 0.0);
  faceBox(b.metal, f, r, s0, s1, y - 0.01, y + 0.01, 0.34, 0.32);
  const n = 3 + Math.floor(hash01(st.seed, Math.floor(s0 * 10)) * 3);
  for (let i = 0; i < n; i++) {
    const a = s0 + 0.12 + ((s1 - s0 - 0.3) * i) / n;
    const w = 0.28 + rnd() * 0.22;
    const h = 0.4 + rnd() * 0.35;
    b.cloth.setColor(LAUNDRY[Math.floor(rnd() * LAUNDRY.length)]);
    quadW(b.cloth, P(f, r, a, y - h, 0.36), P(f, r, a + w, y - h, 0.36), P(f, r, a + w, y, 0.36), P(f, r, a, y, 0.36), f.n[0], 0, f.n[1], [1, 1, 0, 0]);
  }
}

/** The balconies of a building: slab, railing (iron posts or a solid parapet), plants, sometimes a little table and chairs. */
export function buildBalconies(b, lot, st, shell, inst, rnd) {
  const r = lot.rect;
  for (const bf of shell.slots.balconyFloors) {
    const { f, fl, ks, centers } = bf;
    for (const k of ks) {
      const c = centers[k];
      const half = 1.45;
      const y = fl * FLOOR;
      const seed = hash01(st.seed, fl, k + 40);
      const depth = 1.2;
      // the slab, with a lip
      b.trim.setColor(st.accent);
      faceBox(b.trim, f, r, c - half, c + half, y - 0.02, y + 0.14, depth, 0.0);
      b.trim.setColor(st.trim);
      faceBox(b.trim, f, r, c - half - 0.03, c + half + 0.03, y - 0.1, y - 0.02, depth + 0.03, 0.0);
      // the railing
      const solid = seed < 0.4;
      if (solid) {
        b.trim.setColor(st.trim);
        faceBox(b.trim, f, r, c - half, c + half, y + 0.14, y + 0.95, depth, depth - 0.12);
        faceBox(b.trim, f, r, c - half, c - half + 0.12, y + 0.14, y + 0.95, depth, 0.0);
        faceBox(b.trim, f, r, c + half - 0.12, c + half, y + 0.14, y + 0.95, depth, 0.0);
        faceBox(b.trim, f, r, c - half - 0.04, c + half + 0.04, y + 0.95, y + 1.02, depth + 0.04, -0.0);
      } else {
        b.metal.setColor(seed < 0.7 ? '#2f3338' : '#e8e4da');
        faceBox(b.metal, f, r, c - half, c + half, y + 0.96, y + 1.02, depth, depth - 0.05);
        faceBox(b.metal, f, r, c - half, c + half, y + 0.14, y + 0.2, depth, depth - 0.04);
        const posts = Math.round((half * 2) / 0.16);
        for (let i = 0; i <= posts; i++) { const s = c - half + ((half * 2) * i) / posts; faceBox(b.metal, f, r, s - 0.012, s + 0.012, y + 0.2, y + 0.96, depth - 0.015, depth - 0.045, { skip: { top: true, bottom: true } }); }
        for (const sd of [-1, 1]) {
          const sx = sd < 0 ? c - half : c + half - 0.05;
          faceBox(b.metal, f, r, sx, sx + 0.05, y + 0.14, y + 1.02, depth, 0.0);
        }
      }
      // plants on the rail and trailing over the front
      const nPlants = 2 + Math.floor(seed * 3);
      for (let i = 0; i < nPlants; i++) {
        const s = c - half + 0.3 + ((half * 2 - 0.6) * (i + 0.5)) / nPlants;
        const p = P(f, r, s, y + 1.0, depth - 0.1);
        b.fine.setColor(POT);
        faceBox(b.fine, f, r, s - 0.2, s + 0.2, y + 1.02, y + 1.28, depth + 0.02, depth - 0.2);
        inst.push({ kind: 'box', x: p[0], y: p[1] + 0.3, z: p[2], rot: rnd() * 6.28, s: 0.55 + rnd() * 0.25, c: seed < 0.55 ? '#e0307a' : seed < 0.8 ? '#ea5a3c' : '#4f9a52' });
        if (rnd() < 0.55) { const q = P(f, r, s + (rnd() - 0.5) * 0.3, y + 0.95, depth + 0.1); inst.push({ kind: 'vine', x: q[0], y: q[1], z: q[2], rot: Math.atan2(f.n[0], f.n[1]), s: 0.7 + rnd() * 0.6, c: seed < 0.55 ? '#e0307a' : '#4f9a52' }); }
      }
      // a small ac unit or a clothes rack
      if (seed > 0.8) acUnit(b, f, r, c + half + 0.7, y + 0.25, st);
      if (seed > 0.5 && seed < 0.66) { // a chair and a little table
        b.metal.setColor('#3a3f48');
        const t = P(f, r, c - 0.4, y + 0.14, depth * 0.55);
        inst.push({ kind: 'chair', x: t[0], y: t[1], z: t[2], rot: Math.atan2(f.n[0], f.n[1]) + 0.3, s: 1, c: '#c79a62' });
      }
      if (seed > 0.66 && seed < 0.8) laundry(b, f, r, c - half + 0.1, c + half - 0.1, y + 2.15, rnd, st);
    }
  }
}

/** A drain pipe down the corner of a face. */
export function drainPipe(b, f, r, s, h) {
  b.metal.setColor('#9aa0a8');
  faceBox(b.metal, f, r, s - 0.045, s + 0.045, 0.0, h - 0.3, 0.1, 0.0);
  faceBox(b.metal, f, r, s - 0.07, s + 0.07, h - 0.45, h - 0.3, 0.13, 0.0);
}
