// "Ori, Can You...?" — the ground floor of a building's street side: shopfronts with big glass (you see a lit room behind it), a door with its canopy
// and steps, striped awnings that move in the wind, painted fascia signs, and the plain doors + windows of the flats. The other faces get ordinary windows.
import { RC, FLOOR, faceQuad, faceBox, slopeStrip, quadW, P, hash01 } from './face.js';
import { dressOpening } from './facade.js';
import { SHOP_SIGNS } from '../signs.js';

const SHOP_LIKE = new Set(['cafe', 'studio', 'startup', 'sidegig', 'perach', 'workshop', 'cityhall']);
const AWNINGS = [['#e5625e', '#fbf6ec'], ['#2f7f9a', '#fbf6ec'], ['#e8a73a', '#fbf6ec'], ['#4f8f5e', '#fbf6ec'], ['#b8456a', '#fbf6ec'], ['#35507f', '#fbf6ec']];

/** A sign: a coloured board behind, then the painted atlas cell in front of it. */
function signQuad(b, atlas, f, r, id, s0, s1, y0, y1) {
  const [u0, v0, u1, v1] = atlas.uv(id);
  b.trim.setColor('#2b2d33');
  faceBox(b.trim, f, r, s0 - 0.08, s1 + 0.08, y0 - 0.06, y1 + 0.06, 0.1, 0);
  b.signs.setColor('#ffffff');
  faceQuad(b.signs, f, r, s0, s1, y0, y1, 0.115, [u0, v0, u1, v0, u1, v1, u0, v1]);
}

/** A striped awning with a scalloped valance, pinned at the wall and free at the front edge. */
function awning(b, f, r, s0, s1, yTop, yBot, depth, c1, c2) {
  const n = Math.max(2, Math.round((s1 - s0) / 0.3));
  for (let i = 0; i < n; i++) {
    const a = s0 + ((s1 - s0) * i) / n;
    const c = s0 + ((s1 - s0) * (i + 1)) / n;
    b.cloth.setColor(i % 2 ? c2 : c1);
    slopeStrip(b.cloth, f, r, a, c, yTop, 0.02, yBot, depth, [0, 0, 1, 1]);
    // the valance: a vertical frill at the front edge (the lower corners swing)
    const e = depth + 0.01;
    quadW(b.cloth, P(f, r, a, yBot - 0.26, e), P(f, r, c, yBot - 0.26, e), P(f, r, c, yBot, e), P(f, r, a, yBot, e), f.n[0], 0, f.n[1], [1, 1, 0.8, 0.8]);
  }
  b.metal.setColor('#3c4048');
  faceBox(b.metal, f, r, s0, s0 + 0.04, yBot - 0.02, yTop, depth, 0.0);
  faceBox(b.metal, f, r, s1 - 0.04, s1, yBot - 0.02, yTop, depth, 0.0);
}

/**
 * Makes the `ground(f, key, len, centers, isFront)` callback of facade.buildShell for one lot.
 * place = the named place of the lot (or null), kind picks shop / home / civic.
 */
export function makeGround(b, lot, st, place, rnd, atlas, hooks, art) {
  const r = lot.rect;
  const named = !!place;
  const home = named ? !SHOP_LIKE.has(lot.id) : rnd() < 0.42;
  const shopSign = SHOP_SIGNS[Math.floor(rnd() * SHOP_SIGNS.length)];
  const awnCols = AWNINGS[Math.floor(rnd() * AWNINGS.length)];
  const tone = place ? place.tone : shopSign.tone;
  const plan = {};
  if (lot.id === 'kiosk') return makeKiosk(b, lot, st, place, atlas);
  return (f, key, len, centers, isFront) => {
    if (!isFront && st.mural && st.mural.key === key && len >= 9.5) {
      // a mural fills the ground floor of this wall (no windows there)
      const w = Math.min(len - 2.4, 8.4);
      const s0 = (len - w) / 2;
      return { bands: [], dress: () => { const [u0, v0, u1, v1] = art.uvMural(st.mural.id); b.art.setColor('#ffffff'); faceQuad(b.art, f, r, s0, s0 + w, 0.6, 3.2, 0.03, [u0, v0, u1, v0, u1, v1, u0, v1]); } };
    }
    if (!isFront) {
      // sides and back: ordinary windows at 1 m
      const ops = centers.map((c, k) => ({ s0: c - 0.62, s1: c + 0.62, y0: 1.0, y1: 2.55, door: false, k, fl: 0 }));
      return { bands: [{ y0: 1.0, y1: 2.55, openings: ops.map((o) => [o.s0, o.s1]) }], dress: () => ops.forEach((o) => dressOpening(b, f, r, o, { ...st, style: 'plain' }, rnd, key, null)) };
    }
    const doorW = lot.id === 'cityhall' ? 3.4 : 1.7;
    const dm = place ? len / 2 : home ? len / 2 : len * (0.32 + hash01(st.seed, 7) * 0.36);
    const d0 = dm - doorW / 2;
    const d1 = dm + doorW / 2;
    const bands = [];
    const parts = [];
    if (home) {
      // two ordinary windows either side of the entrance
      const wins = [];
      for (const [a, c] of [[0.9, d0 - 0.7], [d1 + 0.7, len - 0.9]]) {
        if (c - a < 1.4) continue;
        const mid = (a + c) / 2;
        const hw = Math.min(0.9, (c - a) / 2);
        wins.push([mid - hw, mid + hw]);
      }
      bands.push({ y0: 0, y1: 1.0, openings: [[d0, d1]] }, { y0: 1.0, y1: 2.5, openings: [[d0, d1], ...wins] }, { y0: 2.5, y1: 2.55, openings: wins });
      parts.push(() => {
        wins.forEach(([a, c], k) => dressOpening(b, f, r, { s0: a, s1: c, y0: 1.0, y1: 2.55, door: false, k, fl: 0 }, { ...st, style: st.style === 'bauhaus' ? 'bauhaus' : 'shutters' }, rnd, key, null));
      });
    } else {
      const panes = [];
      for (const [a, c] of [[0.8, d0 - 0.3], [d1 + 0.3, len - 0.8]]) if (c - a > 1.3) panes.push([a, c]);
      bands.push({ y0: 0, y1: 0.55, openings: [[d0, d1]] }, { y0: 0.55, y1: 2.5, openings: [[d0, d1], ...panes] }, { y0: 2.5, y1: 2.8, openings: panes });
      parts.push(() => {
        panes.forEach(([a, c], k) => {
          // the shop window: warm lit room behind the glass
          b.glass.attr = 2 + Math.floor(hash01(st.seed, k, 3) * 250) * 4;
          b.glass.attr2 = Math.round((c - a) * 10) * 100 + Math.round(2.25 * 10);
          b.glass.setColor('#ffeccd');
          faceQuad(b.glass, f, r, a, c, 0.55, 2.8, -RC + 0.02);
          b.metal.setColor('#2d3036');
          const fw = 0.05;
          const e0 = -RC + 0.02;
          const e1 = -RC + 0.1;
          faceBox(b.metal, f, r, a, a + fw, 0.55, 2.8, e1, e0);
          faceBox(b.metal, f, r, c - fw, c, 0.55, 2.8, e1, e0);
          faceBox(b.metal, f, r, a, c, 2.75, 2.8, e1, e0);
          faceBox(b.metal, f, r, a, c, 0.55, 0.6, e1, e0);
          const bars = Math.max(0, Math.round((c - a) / 1.5) - 1);
          for (let i = 1; i <= bars; i++) { const s = a + ((c - a) * i) / (bars + 1); faceBox(b.metal, f, r, s - 0.025, s + 0.025, 0.55, 2.8, e1, e0); }
          // the stall riser: a tiled skirt under the window
          b.trim.setColor(place ? place.tone : shopSign.tone);
          faceBox(b.trim, f, r, a - 0.08, c + 0.08, 0.0, 0.55, 0.07, 0);
          // a ledge with a few things on it, and a soft light on the pavement at dusk is the street lights' job
          b.trim.setColor('#e9e2d4');
          faceBox(b.trim, f, r, a - 0.08, c + 0.08, 0.55, 0.62, 0.16, -RC + 0.04);
          hooks.onShopWindow({ f, r, a, c, key, seed: hash01(st.seed, k, 9) });
        });
      });
    }
    // the door (same for every kind): a recessed leaf with a frame
    parts.push(() => {
      b.glass.attr = 0 + Math.floor(hash01(st.seed, 5) * 250) * 4;
      b.glass.attr2 = Math.round(doorW * 10) * 100 + 25;
      b.glass.setColor('#7b8794');
      faceQuad(b.glass, f, r, d0, d1, 0.0, 2.5, -RC + 0.02);
      b.metal.setColor(place ? place.tone : '#3c4048');
      const e0 = -RC + 0.02;
      const e1 = -RC + 0.1;
      faceBox(b.metal, f, r, d0, d0 + 0.07, 0, 2.5, e1, e0);
      faceBox(b.metal, f, r, d1 - 0.07, d1, 0, 2.5, e1, e0);
      faceBox(b.metal, f, r, d0, d1, 2.43, 2.5, e1, e0);
      faceBox(b.metal, f, r, dm - 0.03, dm + 0.03, 0, 2.5, e1, e0);
      b.metal.setColor('#d8dce2');
      faceBox(b.metal, f, r, dm - 0.2, dm - 0.14, 1.0, 1.25, e1 + 0.05, e1);
      faceBox(b.metal, f, r, dm + 0.14, dm + 0.2, 1.0, 1.25, e1 + 0.05, e1);
      // steps up from the pavement
      b.trim.setColor('#d8d2c6');
      faceBox(b.trim, f, r, d0 - 0.3, d1 + 0.3, 0, 0.17, 0.95, 0);
      faceBox(b.trim, f, r, d0 - 0.1, d1 + 0.1, 0.17, 0.3, 0.55, 0);
      // a canopy over named doors
      if (place) {
        b.trim.setColor(place.tone);
        faceBox(b.trim, f, r, d0 - 0.5, d1 + 0.5, 2.64, 2.78, 1.15, 0);
        b.trim.setColor('#f3efe7');
        faceBox(b.trim, f, r, d0 - 0.5, d0 - 0.42, 0, 2.64, 1.15, 1.07);
        faceBox(b.trim, f, r, d1 + 0.42, d1 + 0.5, 0, 2.64, 1.15, 1.07);
      }
    });
    // posters on the corner piers
    parts.push(() => {
      if (len < 8 || lot.id === 'cityhall' || hash01(st.seed, 11) > 0.75) return;
      b.art.setColor('#ffffff');
      [[0.2, 0.72, st.poster[0]], [len - 0.72, len - 0.2, st.poster[1]]].forEach(([s0, s1, id], k) => {
        if (k === 1 && hash01(st.seed, 12) > 0.5) return;
        const [u0, v0, u1, v1] = art.uvPoster(id);
        faceQuad(b.art, f, r, s0, s1, 0.95, 0.95 + (s1 - s0) * 2, 0.025, [u0, v0, u1, v0, u1, v1, u0, v1]);
      });
    });
    // signs
    parts.push(() => {
      if (place) {
        const wide = lot.id === 'cityhall' ? 9.6 : 4.6;
        const y = lot.id === 'cityhall' ? 10.9 : 3.0;
        const hgt = lot.id === 'cityhall' ? (wide / 4.2) * 0.75 : wide / 4.2;
        signQuad(b, atlas, f, r, lot.id, len / 2 - wide / 2, len / 2 + wide / 2, y, y + hgt);
      } else if (!home) {
        const wide = Math.min(len - 2, 4.2);
        signQuad(b, atlas, f, r, shopSign.id, dm - wide / 2, dm + wide / 2, 2.92, 2.92 + wide / 4.2 * 0.6);
      }
      // awnings over shop windows and the cafe
      if (!home && (!place || lot.id === 'cafe')) {
        const hasPlaceAwning = lot.id === 'cafe';
        const c1 = hasPlaceAwning ? place.tone : awnCols[0];
        const c2 = awnCols[1];
        if (hasPlaceAwning) awning(b, f, r, 0.6, len - 0.6, 2.95, 2.4, 1.9, c1, c2);
        else if (!place) awning(b, f, r, 0.5, d0 - 0.2 > 2 ? d0 - 0.2 : len - 0.5, 2.9, 2.45, 1.35, c1, c2);
      }
    });
    if (lot.id === 'cityhall') parts.push(() => portico(b, f, r, len, lot.h));
    void FLOOR; void plan; void tone;
    return { bands, dress: () => parts.forEach((p) => p()) };
  };
}

/** Columns and a pediment across the front of City Hall. */
function portico(b, f, r, len, h) {
  b.trim.setColor('#efece6');
  const n = 8;
  for (let i = 0; i < n; i++) {
    const s = 3 + ((len - 6) * i) / (n - 1);
    faceBox(b.trim, f, r, s - 0.3, s + 0.3, 0.2, 8.6, 1.4, 0.8);
    faceBox(b.trim, f, r, s - 0.4, s + 0.4, 0, 0.2, 1.5, 0.7);
    faceBox(b.trim, f, r, s - 0.4, s + 0.4, 8.5, 8.6, 1.5, 0.7);
  }
  faceBox(b.trim, f, r, 2.2, len - 2.2, 8.6, 9.6, 1.6, 0.0);
  faceBox(b.trim, f, r, 2.0, len - 2.0, 9.6, 10.2, 1.8, 0.3);
  void h;
}

/** The kiosk: a small hut with a serving hatch, a counter, a striped awning and a rooftop sign. */
function makeKiosk(b, lot, st, place, atlas) {
  const r = lot.rect;
  return (f, key, len, centers, isFront) => {
    if (!isFront) return { bands: [], dress: () => {} };
    const w0 = 0.5;
    const w1 = len - 0.5;
    return {
      bands: [{ y0: 0.95, y1: 2.2, openings: [[w0, w1]] }],
      dress: () => {
        b.glass.attr = 2 + 77 * 4;
        b.glass.attr2 = Math.round((w1 - w0) * 10) * 100 + 12;
        b.glass.setColor('#fff0cf');
        faceQuad(b.glass, f, r, w0, w1, 0.95, 2.2, -RC + 0.02);
        b.metal.setColor('#3c4048');
        faceBox(b.metal, f, r, w0, w1, 0.95, 1.0, -RC + 0.1, -RC + 0.02);
        b.trim.setColor('#8a6a45');
        faceBox(b.trim, f, r, 0.3, len - 0.3, 0.0, 1.0, 0.45, 0); // the counter
        b.trim.setColor('#c79a62');
        faceBox(b.trim, f, r, 0.2, len - 0.2, 1.0, 1.06, 0.6, 0);
        awning(b, f, r, 0.2, len - 0.2, 2.6, 2.2, 1.0, '#f2c14e', '#fbf6ec');
        signQuad(b, atlas, f, r, 'kiosk', len / 2 - 1.8, len / 2 + 1.8, lot.h + 0.9, lot.h + 1.9);
      },
    };
  };
}
