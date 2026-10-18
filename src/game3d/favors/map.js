// "Ori, Can You...?" — the neighbourhood as DATA (PURE: no three, no DOM, deterministic from a seed). Roughly 290 x 296 m of Tel-Aviv-ish
// streets: a 3 x 3 grid of avenues, 4 block columns (the first is the beach promenade) x 4 rows. Every named place sits on a block
// edge with its door on the sidewalk; the rest of the frontage is filled with plain apartment blocks. `buildMap` also makes the props,
// the colliders and the street graph that the controller, the camera, the pedestrians and (later) the quest feasibility check use.
//   x → east, z → south, y → up. A "facing" is the unit vector from the facade out to the street.
import { mulberry32 } from '../rng.js';
import { PLACES } from './content.js';
import { box, circle, createCollisionWorld } from './collide.js';

export const ROAD_X = [-95, -15, 65]; // centre lines of the north-south avenues
export const ROAD_Z = [-75, 5, 85]; // centre lines of the east-west streets
export const ROAD_W = 10; // asphalt
export const WALK = 4; // sidewalk, each side
export const HALF = ROAD_W / 2 + WALK; // road centre → building line
export const BOUNDS = { x0: -140, x1: 148, z0: -148, z1: 148 };
export const PLAYER_R = 0.42;

// block columns / rows between the avenues (column 0 = the beach promenade)
const COLS = [[BOUNDS.x0, ROAD_X[0] - HALF], [ROAD_X[0] + HALF, ROAD_X[1] - HALF], [ROAD_X[1] + HALF, ROAD_X[2] - HALF], [ROAD_X[2] + HALF, BOUNDS.x1]];
const ROWS = [[BOUNDS.z0, ROAD_Z[0] - HALF], [ROAD_Z[0] + HALF, ROAD_Z[1] - HALF], [ROAD_Z[1] + HALF, ROAD_Z[2] - HALF], [ROAD_Z[2] + HALF, BOUNDS.z1]];

const SIDES = {
  N: { nx: 0, nz: -1 },
  S: { nx: 0, nz: 1 },
  W: { nx: -1, nz: 0 },
  E: { nx: 1, nz: 0 },
};

/** The named places: which block, which edge, where along it, how big. (c, r) = block column / row. */
const DEFS = [
  { id: 'home', c: 2, r: 1, side: 'S', at: 12, w: 22, d: 16, h: 26 },
  { id: 'mum', c: 2, r: 2, side: 'N', at: 4, w: 22, d: 15, h: 19 },
  { id: 'auntie', c: 1, r: 3, side: 'N', at: 10, w: 20, d: 14, h: 9 },
  { id: 'cityhall', c: 3, r: 1, side: 'W', at: 8, w: 38, d: 22, h: 20 },
  { id: 'perach', c: 1, r: 1, side: 'S', at: 16, w: 20, d: 14, h: 13 },
  { id: 'studio', c: 2, r: 0, side: 'S', at: 14, w: 24, d: 15, h: 16 },
  { id: 'startup', c: 3, r: 2, side: 'W', at: 10, w: 26, d: 18, h: 30 },
  { id: 'sidegig', c: 3, r: 3, side: 'N', at: 14, w: 20, d: 14, h: 11 },
  { id: 'cafe', c: 1, r: 2, side: 'E', at: 20, w: 18, d: 14, h: 8 },
  { id: 'workshop', c: 2, r: 3, side: 'N', at: 30, w: 16, d: 12, h: 7 },
  { id: 'kiosk', c: 1, r: 1, side: 'E', at: 50, w: 4, d: 5, h: 3.2 },
];
const BIG_PARK = { c: 1, r: 0 }; // the whole block is the park
const COURT = { c: 3, r: 0, side: 'S', at: 20, w: 28, d: 16 }; // a flat court on the south edge of the north-east block
const BUSSTOP = { x: -81, z: -2.3, w: 6, d: 1.4 }; // a shelter on the sidewalk of the main street

const TONES = ['#f3efe7', '#efe9dd', '#f6f1e8', '#ece6dc', '#f1ece3', '#e8e3da', '#f4e9e2', '#e6ece9'];
const ACCENTS = ['#e8d8c3', '#cfd9e6', '#e7cfd2', '#d6e2d3'];

const rect = (x0, z0, x1, z1) => ({ x0, z0, x1, z1 });
const overlaps = (a, b, m = 0) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.z0 < b.z1 + m && a.z1 > b.z0 - m;
const inside = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/** A rectangle `w` wide (along the edge) and `d` deep (into the block) flush with the given edge of a block, `at` metres along it. */
function edgeRect(b, side, at, w, d) {
  if (side === 'N') return rect(b.x0 + at, b.z0, b.x0 + at + w, b.z0 + d);
  if (side === 'S') return rect(b.x0 + at, b.z1 - d, b.x0 + at + w, b.z1);
  if (side === 'W') return rect(b.x0, b.z0 + at, b.x0 + d, b.z0 + at + w);
  return rect(b.x1 - d, b.z0 + at, b.x1, b.z0 + at + w);
}
/** The door: the middle of the facade, plus a spot on the sidewalk where Ori stands to use it. */
function doorOf(r, side, standOff = 1.3) {
  const n = SIDES[side];
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const fx = side === 'W' ? r.x0 : side === 'E' ? r.x1 : cx;
  const fz = side === 'N' ? r.z0 : side === 'S' ? r.z1 : cz;
  return { x: fx + n.nx * standOff, z: fz + n.nz * standOff, fx, fz, nx: n.nx, nz: n.nz };
}

export const KERB = 0.14; // height of the sidewalks above the road

export function buildMap(seed = 51) {
  const rnd = mulberry32(seed);
  const blocks = [];
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) blocks.push({ id: `b${c}${r}`, c, r, ...rect(COLS[c][0], ROWS[r][0], COLS[c][1], ROWS[r][1]) });
  const blockAt = (c, r) => blocks[c * 4 + r];

  // ── named places ──
  const places = {};
  const lots = []; // every building footprint: { id, rect, side, h, tone, named }
  for (const d of DEFS) {
    const b = blockAt(d.c, d.r);
    const rc = edgeRect(b, d.side, d.at, d.w, d.d);
    const def = PLACES[d.id];
    const door = doorOf(rc, d.side, d.id === 'kiosk' ? 1.1 : 1.4);
    places[d.id] = { id: d.id, kind: def.kind, name: def.name, sign: def.sign, tone: def.tone, rect: rc, side: d.side, h: d.h, door, block: b.id };
    lots.push({ id: d.id, rect: rc, side: d.side, h: d.h, tone: '#f6f2ea', named: true });
  }
  {
    const b = blockAt(BIG_PARK.c, BIG_PARK.r);
    const def = PLACES.park;
    const cx = (b.x0 + b.x1) / 2;
    places.park = { id: 'park', kind: 'open', name: def.name, sign: def.sign, tone: def.tone, rect: rect(b.x0, b.z0, b.x1, b.z1), side: 'S', h: 0, door: { x: cx, z: b.z1 + 1.2, fx: cx, fz: b.z1, nx: 0, nz: 1 }, block: b.id };
  }
  const courtBlock = blockAt(COURT.c, COURT.r);
  const courtRect = edgeRect(courtBlock, COURT.side, COURT.at, COURT.w, COURT.d);
  places.court = { id: 'court', kind: 'open', name: PLACES.court.name, sign: PLACES.court.sign, tone: PLACES.court.tone, rect: courtRect, side: 'S', h: 0, door: doorOf(courtRect, 'S', 1.4), block: courtBlock.id };
  {
    const r = rect(BUSSTOP.x - BUSSTOP.w / 2, BUSSTOP.z - BUSSTOP.d / 2, BUSSTOP.x + BUSSTOP.w / 2, BUSSTOP.z + BUSSTOP.d / 2);
    const def = PLACES.busstop;
    places.busstop = { id: 'busstop', kind: 'open', name: def.name, sign: def.sign, tone: def.tone, rect: r, side: 'S', h: 2.6, door: { x: BUSSTOP.x, z: BUSSTOP.z + 1.6, fx: BUSSTOP.x, fz: BUSSTOP.z + BUSSTOP.d / 2, nx: 0, nz: 1 }, block: blockAt(1, 1).id };
  }

  // ── fillers: apartment blocks along the free frontage of every ordinary block ──
  const keep = [places.park.rect, courtRect, places.busstop.rect];
  const free = (cand, m = 1.2) => !lots.some((l) => overlaps(cand, l.rect, m)) && !keep.some((k) => overlaps(cand, k, 1));
  for (const b of blocks) {
    if (b.c === 0 || (b.c === BIG_PARK.c && b.r === BIG_PARK.r)) continue;
    for (const side of ['N', 'S', 'W', 'E']) {
      const along = side === 'N' || side === 'S' ? b.x1 - b.x0 : b.z1 - b.z0;
      let p = 0;
      while (p < along - 8) {
        const w = 9 + Math.floor(rnd() * 9);
        const d = 12 + Math.floor(rnd() * 4);
        const cand = edgeRect(b, side, p, Math.min(w, along - p), d);
        if (free(cand)) {
          const floors = 4 + Math.floor(rnd() * 5);
          lots.push({ id: `f${lots.length}`, rect: cand, side, h: floors * 3.1 + 1, tone: TONES[Math.floor(rnd() * TONES.length)], accent: ACCENTS[Math.floor(rnd() * ACCENTS.length)], named: false });
          p += w + (rnd() < 0.3 ? 3.5 : 0);
        } else p += 4;
      }
    }
  }

  // ── colliders: buildings, then props ──
  const colliders = [];
  for (const l of lots) colliders.push(box(l.rect.x0, l.rect.z0, l.rect.x1, l.rect.z1));
  colliders.push(box(places.busstop.rect.x0, places.busstop.rect.z0, places.busstop.rect.x1, places.busstop.rect.z1));
  // the world edges: the sea on the west, the end of the neighbourhood elsewhere
  colliders.push(box(BOUNDS.x0 - 20, BOUNDS.z0 - 20, BOUNDS.x0, BOUNDS.z1 + 20), box(BOUNDS.x1, BOUNDS.z0 - 20, BOUNDS.x1 + 20, BOUNDS.z1 + 20),
    box(BOUNDS.x0, BOUNDS.z0 - 20, BOUNDS.x1, BOUNDS.z0), box(BOUNDS.x0, BOUNDS.z1, BOUNDS.x1, BOUNDS.z1 + 20));

  const props = [];
  const doorSpots = Object.values(places).map((p) => p.door);
  const nearDoor = (x, z, m) => doorSpots.some((d) => Math.hypot(d.x - x, d.z - z) < m);
  const onRoadSeg = (x, z) => ROAD_X.some((rx) => Math.abs(x - rx) < ROAD_W / 2 + 0.5) || ROAD_Z.some((rz) => Math.abs(z - rz) < ROAD_W / 2 + 0.5);
  const clearOfLots = (x, z, m) => !lots.some((l) => inside({ x0: l.rect.x0 - m, z0: l.rect.z0 - m, x1: l.rect.x1 + m, z1: l.rect.z1 + m }, x, z));
  const addProp = (p, shape) => { props.push(p); if (shape) { colliders.push(shape); p.col = shape; } };

  // props along one street: axis 'x' = a street running east-west at z = c; side is -1 / +1 (north / south of the centre line)
  const placeAlong = (axis, c, side, off, step, startOff, make, skipCross = 16) => {
    const lo = axis === 'x' ? BOUNDS.x0 + 2 : BOUNDS.z0 + 2;
    const hi = axis === 'x' ? BOUNDS.x1 - 2 : BOUNDS.z1 - 2;
    const crossings = axis === 'x' ? ROAD_X : ROAD_Z;
    for (let t = lo + startOff; t < hi; t += step) {
      if (crossings.some((q) => Math.abs(t - q) < skipCross)) continue;
      const x = axis === 'x' ? t : c + side * off;
      const z = axis === 'x' ? c + side * off : t;
      if (nearDoor(x, z, 3.2) || !clearOfLots(x, z, 0.4)) continue;
      make(x, z, axis);
    }
  };
  // lamps at the kerb, palms on the sidewalk, parked cars in the kerb lane
  for (const [axis, lines] of [['x', ROAD_Z], ['z', ROAD_X]]) {
    for (const c of lines) {
      for (const side of [-1, 1]) {
        placeAlong(axis, c, side, ROAD_W / 2 + 0.6, 18, side > 0 ? 6 : 15, (x, z) => addProp({ type: 'lamp', x, z, rot: 0 }, circle(x, z, 0.22)));
        placeAlong(axis, c, side, ROAD_W / 2 + 2.5, 14, side > 0 ? 12 : 3, (x, z) => addProp({ type: 'palm', x, z, rot: rnd() * 6.28, v: Math.floor(rnd() * 3) }, circle(x, z, 0.32)), 12);
        placeAlong(axis, c, side, ROAD_W / 2 - 1.5, 11, rnd() * 9, (x, z, ax) => {
          if (rnd() < 0.45) return;
          const rot = ax === 'x' ? 0 : Math.PI / 2;
          const hw = ax === 'x' ? 2.2 : 0.95;
          const hd = ax === 'x' ? 0.95 : 2.2;
          addProp({ type: 'car', x, z, rot, v: Math.floor(rnd() * 5) }, box(x - hw, z - hd, x + hw, z + hd));
        }, 20);
      }
    }
  }
  // scooters and benches near the doors
  for (const p of Object.values(places)) {
    if (p.kind !== 'building') continue;
    const d = p.door;
    const sx = d.x + d.nz * 3.4 + d.nx * 0.4;
    const sz = d.z - d.nx * 3.4 + d.nz * 0.4;
    if (clearOfLots(sx, sz, 0.3) && !onRoadSeg(sx, sz)) addProp({ type: 'scooter', x: sx, z: sz, rot: Math.atan2(d.nx, d.nz), v: Math.floor(rnd() * 3) }, circle(sx, sz, 0.55));
  }
  // the beach promenade: palms, benches, umbrellas on the sand
  for (let z = BOUNDS.z0 + 12; z < BOUNDS.z1 - 6; z += 15) {
    if (ROAD_Z.some((rz) => Math.abs(z - rz) < HALF + 3)) continue;
    addProp({ type: 'palm', x: -112, z, rot: rnd() * 6.28, v: z % 2 ? 1 : 0 }, circle(-112, z, 0.32));
    if (rnd() < 0.5) addProp({ type: 'bench', x: -108.6, z: z + 4, rot: Math.PI / 2, v: 0 }, box(-109.1, z + 2.9, -108.1, z + 5.1));
    if (rnd() < 0.6) addProp({ type: 'umbrella', x: -131 - rnd() * 6, z: z + 3 + rnd() * 4, rot: rnd() * 6.28, v: Math.floor(rnd() * 4) }, circle(-132, z, 0.2));
  }
  // the park: a fountain, paths' worth of benches, trees with room between them
  {
    const pr = places.park.rect;
    const cx = (pr.x0 + pr.x1) / 2;
    const cz = (pr.z0 + pr.z1) / 2;
    addProp({ type: 'fountain', x: cx, z: cz, rot: 0, v: 0 }, circle(cx, cz, 3.4));
    let tries = 0;
    let trees = 0;
    while (trees < 30 && tries++ < 400) {
      const x = pr.x0 + 4 + rnd() * (pr.x1 - pr.x0 - 8);
      const z = pr.z0 + 4 + rnd() * (pr.z1 - pr.z0 - 8);
      if (Math.hypot(x - cx, z - cz) < 9 || Math.abs(x - cx) < 3 || Math.abs(z - cz) < 3) continue; // keep the two paths and the fountain open
      if (props.some((p) => (p.type === 'tree') && Math.hypot(p.x - x, p.z - z) < 6)) continue;
      addProp({ type: 'tree', x, z, rot: rnd() * 6.28, v: Math.floor(rnd() * 3) }, circle(x, z, 0.5));
      trees++;
    }
    for (const [bx, bz, br] of [[cx - 7, cz + 2, 0], [cx + 7, cz - 2, 0], [cx + 2, cz - 7, Math.PI / 2], [cx - 2, cz + 7, Math.PI / 2]]) {
      addProp({ type: 'bench', x: bx, z: bz, rot: br, v: 0 }, br ? box(bx - 0.5, bz - 1, bx + 0.5, bz + 1) : box(bx - 1, bz - 0.5, bx + 1, bz + 0.5));
    }
  }
  // plants and benches on the plaza of City Hall, a few trees in the courtyards
  {
    const ch = places.cityhall.door;
    for (const o of [-6, 6]) addProp({ type: 'palm', x: ch.x - 3.6, z: ch.z + o, rot: 0, v: 1 }, circle(ch.x - 3.6, ch.z + o, 0.32));
  }

  // ── the street graph: the avenue / street crossings + the promenade, and where every door joins it ──
  const GX = [-125, ...ROAD_X, 140];
  const GZ = [-140, ...ROAD_Z, 140];
  const nodes = [];
  const idx = (i, j) => i * GZ.length + j;
  for (let i = 0; i < GX.length; i++) for (let j = 0; j < GZ.length; j++) nodes.push({ id: idx(i, j), x: GX[i], z: GZ[j] });
  const edges = []; // [a, b, length, axis]
  for (let i = 0; i < GX.length; i++) {
    for (let j = 0; j < GZ.length; j++) {
      if (i + 1 < GX.length) edges.push([idx(i, j), idx(i + 1, j), Math.abs(GX[i + 1] - GX[i]), 'x']);
      if (j + 1 < GZ.length) edges.push([idx(i, j), idx(i, j + 1), Math.abs(GZ[j + 1] - GZ[j]), 'z']);
    }
  }
  // the raised pavement of each block (up to the kerb of the roads around it); the beach column only from the boardwalk inwards
  const slabs = blocks.map((b) => rect(b.c === 0 ? -124 : b.x0 - WALK, b.r > 0 ? b.z0 - WALK : b.z0, b.c < 3 ? b.x1 + WALK : b.x1, b.r < 3 ? b.z1 + WALK : b.z1));
  // Ori's own car: the parked car closest to his front door (pearl white, a design of its own; props3d draws kind 'ori')
  {
    const hd = places.home.door;
    let best = null;
    let bd = Infinity;
    for (const p of props) if (p.type === 'car') { const d = Math.hypot(p.x - hd.x, p.z - hd.z); if (d < bd) { bd = d; best = p; } }
    if (best) { best.kind = 'ori'; best.mine = true; best.v = 0; }
  }
  const map = {
    seed, bounds: BOUNDS, blocks, slabs, lots, places, props, colliders, nodes, edges,
    roads: { x: ROAD_X, z: ROAD_Z, width: ROAD_W, walk: WALK, half: HALF },
    zones: { park: places.park.rect, court: courtRect, sand: rect(BOUNDS.x0 - 40, BOUNDS.z0, -124, BOUNDS.z1), promenade: rect(-124, BOUNDS.z0, ROAD_X[0] - HALF, BOUNDS.z1) },
    spawn: { x: places.home.door.x + 2.5, z: places.home.door.z + 1.5, heading: Math.PI },
    GX, GZ,
  };
  map.world = createCollisionWorld(colliders);
  map.dist = placeDistances(map);
  return map;
}

// ── routing: doors join the nearest street segment; Dijkstra over the little grid ──
function snapToGraph(map, x, z) {
  let best = null;
  for (const [a, b, , axis] of map.edges) {
    const A = map.nodes[a];
    const B = map.nodes[b];
    let px;
    let pz;
    if (axis === 'x') { px = Math.min(Math.max(x, Math.min(A.x, B.x)), Math.max(A.x, B.x)); pz = A.z; } else { px = A.x; pz = Math.min(Math.max(z, Math.min(A.z, B.z)), Math.max(A.z, B.z)); }
    const d = Math.hypot(px - x, pz - z);
    if (!best || d < best.d) best = { d, x: px, z: pz, a, b };
  }
  return best;
}

/** Walking distance (m) between two points through the street graph (door → street → … → street → door). */
export function walkDistance(map, ax, az, bx, bz) {
  const s = snapToGraph(map, ax, az);
  const e = snapToGraph(map, bx, bz);
  if (s.a === e.a && s.b === e.b) return s.d + Math.hypot(s.x - e.x, s.z - e.z) + e.d;
  const N = map.nodes.length;
  const adj = Array.from({ length: N }, () => []);
  for (const [a, b, len] of map.edges) { adj[a].push([b, len]); adj[b].push([a, len]); }
  const dist = new Array(N).fill(Infinity);
  const done = new Array(N).fill(false);
  const A = map.nodes[s.a];
  const B = map.nodes[s.b];
  dist[s.a] = Math.hypot(A.x - s.x, A.z - s.z);
  dist[s.b] = Math.min(dist[s.b], Math.hypot(B.x - s.x, B.z - s.z));
  for (let n = 0; n < N; n++) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = true;
    for (const [v, len] of adj[u]) if (dist[u] + len < dist[v]) dist[v] = dist[u] + len;
  }
  const EA = map.nodes[e.a];
  const EB = map.nodes[e.b];
  return s.d + Math.min(dist[e.a] + Math.hypot(EA.x - e.x, EA.z - e.z), dist[e.b] + Math.hypot(EB.x - e.x, EB.z - e.z)) + e.d;
}

function placeDistances(map) {
  const ids = Object.keys(map.places);
  const out = {};
  for (const a of ids) {
    out[a] = {};
    for (const b of ids) out[a][b] = a === b ? 0 : walkDistance(map, map.places[a].door.x, map.places[a].door.z, map.places[b].door.x, map.places[b].door.z);
  }
  return out;
}

/** Checks the map is playable: no overlapping buildings, every door and the spawn reachable on foot, everything inside the bounds. */
export function validateMap(map) {
  const errors = [];
  const l = map.lots;
  for (let i = 0; i < l.length; i++) {
    const a = l[i].rect;
    if (a.x0 < BOUNDS.x0 || a.x1 > BOUNDS.x1 || a.z0 < BOUNDS.z0 || a.z1 > BOUNDS.z1) errors.push(`lot ${l[i].id} leaves the map`);
    for (let j = i + 1; j < l.length; j++) if (overlaps(a, l[j].rect, 0.5)) errors.push(`lots ${l[i].id} and ${l[j].id} overlap`);
  }
  for (const p of Object.values(map.places)) {
    if (!(p.id in map.dist)) errors.push(`place ${p.id} has no distances`);
    if (map.world.blocked(p.door.x, p.door.z, PLAYER_R)) errors.push(`the door spot of ${p.id} is blocked`);
  }
  // flood fill on a 1 m grid from the spawn
  const W = Math.ceil(BOUNDS.x1 - BOUNDS.x0);
  const H = Math.ceil(BOUNDS.z1 - BOUNDS.z0);
  const seen = new Uint8Array(W * H);
  const cx = (i) => BOUNDS.x0 + i + 0.5;
  const cz = (j) => BOUNDS.z0 + j + 0.5;
  const start = [Math.floor(map.spawn.x - BOUNDS.x0), Math.floor(map.spawn.z - BOUNDS.z0)];
  const stack = [start];
  seen[start[1] * W + start[0]] = 1;
  let reached = 0;
  while (stack.length) {
    const [i, j] = stack.pop();
    reached++;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H || seen[nj * W + ni]) continue;
      if (map.world.blocked(cx(ni), cz(nj), PLAYER_R)) continue;
      seen[nj * W + ni] = 1;
      stack.push([ni, nj]);
    }
  }
  for (const p of Object.values(map.places)) {
    const i = Math.floor(p.door.x - BOUNDS.x0);
    const j = Math.floor(p.door.z - BOUNDS.z0);
    if (!seen[j * W + i]) errors.push(`the door of ${p.id} cannot be reached on foot from the spawn`);
  }
  return { ok: errors.length === 0, errors, reachableCells: reached, totalCells: W * H };
}

/** The height of the ground under (x, z): the raised sidewalks / blocks, or the road and the sand at 0. */
export function groundHeight(map, x, z) {
  for (const sl of map.slabs) if (x >= sl.x0 && x <= sl.x1 && z >= sl.z0 && z <= sl.z1) return KERB;
  return 0;
}
