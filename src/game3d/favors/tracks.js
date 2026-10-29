// "Ori's Life" — the race tracks out of town (PURE) [experimental] (Shilo: "tracks that are not inside the city, a race somewhere else, and not only one against one"): a track is a closed loop
// (a smooth line through a few control points), a width, some laps and a look. This file makes the geometry the races and the 3D world need: the line sampled every few metres,
// where a point of it is, how far a car is from it (the barrier), the rings to pass, the places on the grid, how tight each turn is (the speed a driver can carry through it) and the obstacles
// on the road (cones, tyres, barrels, oil). The 3D side is track3d.js; the race itself is missions.js (fieldRace).
import { mulberry32 } from '../rng.js';

const STEP = 5; // metres between two points of the sampled line
export const CP_EVERY = 5; // a ring every 25 m
export const GRID_GAP = 7; // metres between two rows of the grid
/** Where the races begin: the east end of the main avenue, at the edge of town (the flag on the map, the gate in the street, R there). No race is run inside the city. */
export const EXIT = { x: 134, z: 5 };

const scaled = (a, k) => a.map(([x, z]) => [Math.round(x * k), Math.round(z * k)]);

/** The tracks. The control points are metres from `origin` (where the track hangs in the world, far from the city and from the rooms); the line runs clockwise from the start line, along +x.
 * `hazard` = how many obstacles (0..1 of one per 45 m), `mix` = which kinds, by weight. */
export const TRACKS = {
  speedway: {
    id: 'speedway', name: 'Sababa Speedway', far: '14 km out of town', theme: 'speedway', width: 14, laps: 2, origin: { x: 0, z: 2200 }, hazard: 0.4, mix: { cone: 5, oil: 2, barrel: 2 },
    control: [[-70, 0], [20, 0], [110, 0], [175, 35], [200, 105], [170, 178], [100, 205], [35, 182], [-25, 198], [-95, 200], [-158, 158], [-172, 86], [-138, 28]],
  },
  harbor: {
    id: 'harbor', name: 'Old Port Sprint', far: '21 km out of town', theme: 'harbor', width: 12, laps: 2, origin: { x: 2000, z: 2200 }, hazard: 0.95, mix: { cone: 4, tyres: 4, barrel: 3, oil: 2 },
    control: [[-80, 0], [0, 0], [80, 0], [140, 24], [150, 76], [108, 108], [58, 96], [34, 136], [74, 170], [140, 176], [196, 210], [188, 274], [122, 298], [62, 272], [4, 296], [-56, 326], [-120, 296], [-130, 230], [-78, 196], [-118, 152], [-152, 92], [-132, 30]],
  },
  coast: {
    id: 'coast', name: 'Coast Road', far: '31 km out of town', theme: 'coast', width: 14, laps: 2, origin: { x: 1000, z: 2200 }, hazard: 0.65, mix: { cone: 3, tyres: 2, barrel: 3, oil: 3 },
    control: [[-80, 0], [0, 0], [100, 8], [180, 40], [240, 104], [272, 184], [240, 264], [168, 304], [88, 288], [32, 240], [-32, 208], [-104, 232], [-168, 208], [-200, 144], [-184, 72]],
  },
  ridge: {
    id: 'ridge', name: 'Ridge Run', far: '47 km out of town', theme: 'ridge', width: 12, laps: 2, origin: { x: 3000, z: 2200 }, hazard: 0.85, mix: { cone: 2, tyres: 4, barrel: 4, oil: 3 },
    control: scaled([[-90, 0], [0, 0], [100, 0], [190, -10], [260, 40], [250, 120], [170, 150], [90, 130], [30, 170], [40, 250], [120, 290], [220, 300], [300, 350], [290, 430], [200, 460], [100, 430], [10, 390], [-60, 420], [-130, 380], [-150, 300], [-110, 230], [-170, 170], [-190, 90], [-150, 20]], 0.7),
  },
};
export const TRACK_IDS = Object.keys(TRACKS);
/** The obstacles: a cone (knocked over, a little slower), a stack of tyres (solid), a barrel (knocked away, slower), an oil patch (the tyres lose their grip for a moment). `r` = the radius in metres. */
export const HAZARD_R = { cone: 0.5, tyres: 1.1, barrel: 0.75, oil: 3.1 };

const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
/** A closed smooth line through the control points, resampled every `step` metres: [[x, z], ...]. */
export function smoothLoop(ctrl, step = STEP) {
  const n = ctrl.length;
  const dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i + n - 1) % n]; const p1 = ctrl[i]; const p2 = ctrl[(i + 1) % n]; const p3 = ctrl[(i + 2) % n];
    const k = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2));
    for (let j = 0; j < k; j++) { const t = j / k; dense.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t)]); }
  }
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) { const a = dense[i - 1]; const b = dense[i % dense.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const total = cum[cum.length - 1];
  const m = Math.max(8, Math.round(total / step));
  const out = [];
  let k = 1;
  for (let i = 0; i < m; i++) {
    const d = (i / m) * total;
    while (cum[k] < d) k++;
    const a = dense[k - 1]; const b = dense[k % dense.length];
    const u = (d - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return out;
}

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
/** The obstacles of a track: spread over the lap (never on the grid, never right after the start line), each wholly on the road, the same every time. */
function makeHazards(T, def) {
  const rnd = mulberry32(hash(def.id));
  const kinds = Object.keys(def.mix);
  const sum = kinds.reduce((a, k) => a + def.mix[k], 0);
  const count = Math.round((T.total / 45) * def.hazard);
  const from = 95; const to = T.total - 70;
  const half = def.width / 2;
  const out = [];
  for (let k = 0; k < count; k++) {
    const d = from + ((to - from) * (k + 0.15 + 0.7 * rnd())) / count;
    let pick = rnd() * sum; let kind = kinds[0];
    for (const kk of kinds) { pick -= def.mix[kk]; if (pick <= 0) { kind = kk; break; } }
    const r = HAZARD_R[kind];
    const room = half - r - 1.4;
    const lat = (rnd() * 2 - 1) * room;
    const p = T.offsetAt(d, lat);
    out.push({ i: out.length, kind, d, lat, r, x: p.x, z: p.z });
    if (kind === 'cone') { // cones come in pairs
      const lat2 = lat > 0 ? lat - 1.6 : lat + 1.6;
      const q = T.offsetAt(d + 2, lat2);
      out.push({ i: out.length, kind, d: d + 2, lat: lat2, r, x: q.x, z: q.z });
    }
  }
  return out;
}

const BRAKE = 16; // how hard a driver slows for a turn (m/s²): what he may carry into it
const cache = new Map();
/** Everything a race or the 3D world needs to know about a track (made once). */
export function buildTrack(id) {
  if (cache.has(id)) return cache.get(id);
  const def = TRACKS[id];
  if (!def) return null;
  const path = smoothLoop(def.control.map(([x, z]) => [x + def.origin.x, z + def.origin.z]));
  const n = path.length;
  let total = 0;
  for (let i = 0; i < n; i++) total += Math.hypot(path[(i + 1) % n][0] - path[i][0], path[(i + 1) % n][1] - path[i][1]);
  const seg = total / n; // (the sampled points are evenly spaced, so a distance is an index)
  const wrap = (d) => ((d % total) + total) % total;
  // how tight the turn is at every point (the radius of the circle through the points two steps either side), the smallest of three neighbours
  const rad = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = path[(i + n - 2) % n]; const b = path[i]; const c = path[(i + 2) % n];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]); const bc = Math.hypot(c[0] - b[0], c[1] - b[1]); const ac = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const area2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    rad[i] = area2 > 1e-6 ? Math.min(400, (ab * bc * ac) / (2 * area2)) : 400;
  }
  const radius = Float32Array.from(rad, (_, i) => Math.min(rad[(i + n - 1) % n], rad[i], rad[(i + 1) % n]));
  const T = {
    id, name: def.name, far: def.far, theme: def.theme, width: def.width, laps: def.laps, origin: def.origin, path, n, seg, total, radius,
    /** The point `d` metres along the line (any number: it wraps), and the way it points. */
    at(d) {
      const u = wrap(d) / seg; const i = Math.floor(u) % n; const f = u - Math.floor(u);
      const a = path[i]; const b = path[(i + 1) % n];
      return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, h: Math.atan2(b[0] - a[0], b[1] - a[1]) };
    },
    /** The same point, `lat` metres to the right of the line (negative = left). */
    offsetAt(d, lat) { const p = T.at(d); return { x: p.x + Math.cos(p.h) * lat, z: p.z - Math.sin(p.h) * lat, h: p.h }; },
    /** The nearest point of the line to (x, z): its distance along, how far off (dist) and on which side (lat), and the unit vector from the line to the car. */
    nearest(x, z) {
      let best = null;
      for (let i = 0; i < n; i++) {
        const a = path[i]; const b = path[(i + 1) % n];
        const dx = b[0] - a[0]; const dz = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
        const px = a[0] + dx * t; const pz = a[1] + dz * t;
        const dist = Math.hypot(x - px, z - pz);
        if (!best || dist < best.dist) best = { i, t, px, pz, dist, dx, dz };
      }
      const nx = best.dist > 1e-6 ? (x - best.px) / best.dist : 0;
      const nz = best.dist > 1e-6 ? (z - best.pz) / best.dist : 0;
      const len = Math.hypot(best.dx, best.dz);
      const lat = (best.dx / len) * (z - best.pz) * -1 + (best.dz / len) * (x - best.px); // (positive: to the right of the way it points)
      return { d: (best.i + best.t) * seg, lat, dist: best.dist, px: best.px, pz: best.pz, nx, nz };
    },
    /** The fastest a driver may be going at `d` metres along to take the turns ahead: sqrt(aLat · radius) for each turn, and what he can still slow down from (so he brakes BEFORE a turn). `aLat` = his grip in m/s². */
    speedAt(d, aLat, look = 18) {
      const u = wrap(d) / seg; const i0 = Math.floor(u) % n; const f = u - Math.floor(u);
      let v = Infinity;
      for (let k = 0; k <= look; k++) {
        const vc2 = aLat * radius[(i0 + k) % n];
        const allowed = Math.sqrt(vc2 + 2 * BRAKE * Math.max(0, k - f) * seg); // (the true distance to that point of the line: the limit does not jump when the car crosses a sample)
        if (allowed < v) v = allowed;
      }
      return v;
    },
    /** The rings of one lap, in order; the last one is the finish line. */
    cps: [],
    /** A place on the grid (0 = front left, 1 = front right, 2 = the row behind...): behind the start line, two abreast. */
    slot(k) { const back = GRID_GAP * (1 + Math.floor(k / 2)); return T.offsetAt(-back, k % 2 ? 3 : -3); },
    hazards: [],
  };
  for (let i = CP_EVERY; i < n; i += CP_EVERY) { const p = path[i]; T.cps.push({ x: p[0], z: p[1], d: i * seg }); }
  T.cps.push({ x: path[0][0], z: path[0][1], d: total });
  T.hazards = makeHazards(T, def);
  cache.set(id, T);
  return T;
}

/** The smallest radius of a turn of the line (metres): a car must be able to take it. */
export function minRadius(T) {
  let best = Infinity;
  for (let i = 0; i < T.n; i++) {
    const a = T.path[(i + T.n - 2) % T.n]; const b = T.path[i]; const c = T.path[(i + 2) % T.n];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]); const bc = Math.hypot(c[0] - b[0], c[1] - b[1]); const ac = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const area2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    if (area2 > 1e-6) best = Math.min(best, (ab * bc * ac) / (2 * area2));
  }
  return best;
}
