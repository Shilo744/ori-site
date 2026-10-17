// "Ori, Can You...?" — one building's walls: a solid core, a skin of wall pieces around REAL window openings (you see the reveal and the glass set back
// inside), frames, sills, shutters, roller-shutter boxes, eyebrows over the windows, a plinth, floor lines, a cornice and a parapet. The ground floor of
// the street side comes from shopfront.js; balconies, AC units and washing from balconies.js.
import { FLOOR, RC, FACES, P, faceQuad, faceBox, wallBands, hash01 } from './face.js';

export const WALL_TONES = ['#f3ece0', '#f6e7c9', '#f2d6c3', '#ecd0cb', '#d3e2d6', '#d1e1ea', '#efe3cf', '#e8dcc6', '#e2e8d3', '#f3dede', '#f6f1e8', '#ece6dc'];
const TRIMS = ['#ffffff', '#f8f3ea', '#efe7d8'];
const SHUTTERS = ['#6f8f7b', '#3f6f86', '#b8644a', '#ece6d6', '#2f4a6b', '#c9a35c', '#7a9a8e'];
const WIN_W = 1.5;
const WIN_H = 1.75;
const SILL = 0.8; // from the floor up to the sill

/** The look of one lot: colours + which dressing it gets. */
export function lotStyle(lot, rnd, named) {
  const style = lot.id === 'startup' ? 'modern' : lot.id === 'cityhall' ? 'civic' : lot.id === 'auntie' ? 'house' : rnd() < 0.5 ? 'shutters' : rnd() < 0.7 ? 'bauhaus' : 'plain';
  const wall = named && lot.id !== 'kiosk' ? (lot.id === 'cityhall' ? '#f1ebe0' : WALL_TONES[Math.floor(rnd() * 6)]) : lot.tone && rnd() < 0.35 ? lot.tone : WALL_TONES[Math.floor(rnd() * WALL_TONES.length)];
  return {
    style, wall,
    trim: TRIMS[Math.floor(rnd() * TRIMS.length)],
    shutter: SHUTTERS[Math.floor(rnd() * SHUTTERS.length)],
    accent: lot.accent || '#e8d8c3',
    seed: Math.floor(rnd() * 1e6),
    ac: rnd() < 0.7, laundry: rnd() < 0.4, planters: rnd() < 0.75,
  };
}

/**
 * Builds the walls of a lot. `b` = the chunk's builders { walls, trim, roofs, glass, metal, cloth }, `ground(f, key)` returns the ground floor of a face
 * ({ bands, dress() }) — shopfront.js for the street side. Returns what the other modules need (the opening slots).
 */
export function buildShell(b, lot, st, rnd, { ground, extras }) {
  const r = lot.rect;
  const h = lot.h;
  const floors = Math.max(1, Math.round(h / FLOOR));
  const topY = floors * FLOOR > h - 0.2 ? h : h; // the parapet stands on h
  // the solid core (walls are drawn as a skin of pieces around the openings, so the core sits RC inside)
  b.walls.setColor(st.wall).box(r.x0 + RC, 0, r.z0 + RC, r.x1 - RC, h, r.z1 - RC, { uvMeters: [4, 4], skip: { top: true, bottom: true } });
  b.roofs.setColor('#b7b2aa').floor(r.x0 + RC, r.z0 + RC, r.x1 - RC, r.z1 - RC, h + 0.01, 3);

  const slots = { front: null, balconyFloors: [] };
  for (const key of ['S', 'N', 'E', 'W']) {
    const f = FACES[key];
    const len = f.len(r);
    const isFront = key === lot.side;
    const margin = key === 'E' || key === 'W' ? RC : 0;
    const uOff = hash01(st.seed, key.charCodeAt(0)) * 4;
    const nWin = Math.max(1, Math.floor((len - 1.8) / 3.0));
    const step = (len - 1.8) / nWin;
    const centers = [];
    for (let k = 0; k < nWin; k++) centers.push(0.9 + step * (k + 0.5));
    const bands = [];
    const dress = [];
    // the ground floor
    const g = ground(f, key, len, centers, isFront);
    bands.push(...g.bands);
    dress.push(g.dress);
    // the upper floors
    const balconySlots = isFront && len > 12 ? [Math.round(nWin * 0.3 - 0.5), Math.round(nWin * 0.7 - 0.5)].map((k) => Math.max(0, Math.min(nWin - 1, k))) : [];
    for (let fl = 1; fl < floors; fl++) {
      const balcony = balconySlots.length > 0 && fl % 2 === 0 && st.style !== 'modern';
      const y0 = fl * FLOOR + (balcony ? 0.05 : SILL);
      const y1 = y0 + (balcony ? 2.3 : WIN_H);
      const modern = st.style === 'modern';
      const w = modern ? 2.4 : WIN_W;
      const ops = [];
      centers.forEach((c, k) => {
        const door = balcony;
        const hw = (door && !balconySlots.includes(k) ? 0.62 : modern ? 1.2 : door ? 0.65 : WIN_W / 2);
        ops.push({ s0: c - hw, s1: c + hw, y0, y1, door, k, fl, big: balconySlots.includes(k) });
        void w;
      });
      bands.push({ y0, y1, openings: ops.map((o) => [o.s0, o.s1]) });
      dress.push(() => { for (const o of ops) dressOpening(b, f, r, o, st, rnd, key, extras); });
      if (balcony) slots.balconyFloors.push({ fl, key, f, ks: balconySlots, centers });
    }
    // fill the gaps between bands with plain wall, then the whole face
    bands.sort((p, q) => p.y0 - q.y0);
    const all = [];
    let y = 0;
    for (const bd of bands) { if (bd.y0 > y + 0.001) all.push({ y0: y, y1: bd.y0, openings: [] }); all.push(bd); y = bd.y1; }
    if (y < h) all.push({ y0: y, y1: h, openings: [] });
    wallBands(b.walls.setColor(st.wall), f, r, len, all, uOff, margin);
    for (const d of dress) d();
    // floor lines, eyebrows and the cornice
    faceDetails(b, f, r, len, h, floors, st, key);
  }
  return { floors, slots, h, topY };
}

/** The glass, frame, sill, shutters and roller-box of one opening. */
export function dressOpening(b, f, r, o, st, rnd, key, extras) {
  const { s0, s1, y0, y1, door, fl, k } = o;
  const seed = hash01(st.seed, fl * 31 + k, key.charCodeAt(0));
  const w = s1 - s0;
  const hh = y1 - y0;
  // ── glass, set back in the reveal ──
  const lit = seed < 0.55 ? 1 : 0;
  b.glass.attr = (lit + Math.floor(seed * 250) * 4);
  b.glass.attr2 = Math.round(w * 10) * 100 + Math.round(hh * 10);
  b.glass.setColor(seed > 0.8 ? '#a9bdd2' : '#dfe9f2');
  faceQuad(b.glass, f, r, s0, s1, y0, y1, -RC + 0.02);
  // ── frame: four bars + a transom/mullion on some ──
  b.fine.setColor(seed > 0.5 ? st.trim : '#3c4048');
  const e1 = -RC + 0.1;
  faceQuad(b.fine, f, r, s0, s0 + 0.06, y0, y1, e1);
  faceQuad(b.fine, f, r, s1 - 0.06, s1, y0, y1, e1);
  faceQuad(b.fine, f, r, s0, s1, y1 - 0.06, y1, e1);
  faceQuad(b.fine, f, r, s0, s1, y0, y0 + 0.06, e1);
  if (seed > 0.35 && !o.big) { faceQuad(b.fine, f, r, (s0 + s1) / 2 - 0.025, (s0 + s1) / 2 + 0.025, y0, y1, e1); if (hh > 1.9) faceQuad(b.fine, f, r, s0, s1, y0 + hh * 0.62, y0 + hh * 0.62 + 0.04, e1); }
  // ── sill + lintel ──
  b.fine.setColor(st.trim);
  if (!door) faceBox(b.fine, f, r, s0 - 0.1, s1 + 0.1, y0 - 0.08, y0 + 0.02, 0.14, -RC + 0.04);
  faceBox(b.fine, f, r, s0 - 0.08, s1 + 0.08, y1 + 0.0, y1 + 0.1, 0.07, -RC + 0.04);
  // ── shutters / roller box / AC / planters ──
  if (st.style === 'shutters' && seed < 0.62) {
    const open = seed < 0.4;
    const panels = open ? [[s0 - 0.56, s0 - 0.02], [s1 + 0.02, s1 + 0.56]] : [[s0 + 0.02, s1 - 0.02]];
    for (const [a, c] of panels) {
      b.metal.setColor(st.shutter);
      if (open) faceBox(b.metal, f, r, a, c, y0 - 0.02, y1 + 0.02, 0.05, 0);
      else faceBox(b.metal, f, r, a, c, y0, y1, -RC + 0.16, -RC + 0.09);
      b.metal.setColor('#000000');
      const e = open ? 0.062 : -RC + 0.172;
      for (let y = y0 + 0.12; y < y1 - 0.08; y += 0.19) faceQuad(b.metal, f, r, a + 0.03, c - 0.03, y, y + 0.035, e);
    }
  } else if (st.style !== 'shutters' && seed > 0.74 && !door) {
    b.metal.setColor('#c9c4b8');
    faceBox(b.metal, f, r, s0 - 0.05, s1 + 0.05, y1 + 0.1, y1 + 0.38, 0.22, 0);
    const down = 0.25 + seed * 0.4;
    faceQuad(b.metal, f, r, s0 - 0.02, s1 + 0.02, y1 - hh * down, y1 + 0.1, -RC + 0.12);
  }
  if (extras) extras.onOpening({ f, r, o, st, seed, key });
}

/** Floor lines, window-row eyebrows, plinth and cornice around one face. */
function faceDetails(b, f, r, len, h, floors, st, key) {
  b.trim.setColor(st.trim);
  // plinth
  b.trim.setColor('#cfc8bb');
  faceBox(b.trim, f, r, -0.02, len + 0.02, 0, 0.55, 0.06, 0);
  b.trim.setColor(st.trim);
  // floor lines (a thin projecting band at every floor) or long eyebrows on bauhaus blocks
  for (let fl = 1; fl < floors; fl++) {
    if (st.style === 'bauhaus') {
      faceBox(b.trim, f, r, -0.05, len + 0.05, fl * FLOOR + SILL + WIN_H + 0.08, fl * FLOOR + SILL + WIN_H + 0.2, 0.55, 0);
    } else if (st.style !== 'house') {
      faceBox(b.trim, f, r, -0.03, len + 0.03, fl * FLOOR - 0.12, fl * FLOOR + 0.05, 0.07, 0);
    }
  }
  if (st.style === 'house') return;
  // cornice + parapet
  faceBox(b.trim, f, r, -0.3, len + 0.3, h - 0.35, h, 0.34, 0);
  faceBox(b.trim, f, r, 0, len, h, h + 0.8, 0.0, -RC + 0.08);
  faceBox(b.trim, f, r, -0.3, len + 0.3, h + 0.8, h + 0.92, 0.14, -RC + 0.02);
  void key; void P;
}
