// "Ori, Can You...?" — the passers-by (PURE): a few dozen pedestrians who stroll along the sidewalks of the street graph, turn at the
// corners, and step out of Ori's way. Deterministic from the seed; the 3D side only draws what is here.
import { mulberry32 } from '../rng.js';

const LANE_MIN = 6.05; // metres from the street centre: between the lamps (5.6) and the palms (7.5)
const LANE_MAX = 6.9;

export function createCrowd(map, { count = 40, seed = 7 } = {}) {
  const rnd = mulberry32(seed);
  const adj = new Map();
  for (const e of map.edges) {
    for (const [a, b] of [[e[0], e[1]], [e[1], e[0]]]) {
      if (!adj.has(a)) adj.set(a, []);
      adj.get(a).push({ from: a, to: b, len: e[2], axis: e[3] });
    }
  }
  const nodes = map.nodes;
  const edgeList = [...adj.values()].flat();
  const walkers = [];

  const place = (w) => {
    const A = nodes[w.from];
    const B = nodes[w.to];
    const cx = A.x + (B.x - A.x) * w.t;
    const cz = A.z + (B.z - A.z) * w.t;
    // the sidewalk is perpendicular to the street
    return w.axis === 'x' ? [cx, cz + w.side * w.lat] : [cx + w.side * w.lat, cz];
  };

  for (let i = 0; i < count; i++) {
    const e = edgeList[Math.floor(rnd() * edgeList.length)];
    const w = {
      id: i, from: e.from, to: e.to, len: e.len, axis: e.axis, t: rnd(), side: rnd() < 0.5 ? -1 : 1, lat: LANE_MIN + rnd() * (LANE_MAX - LANE_MIN),
      speed: 0.9 + rnd() * 0.9, x: 0, z: 0, heading: 0, stop: 0,
      look: { shirt: Math.floor(rnd() * 8), pants: Math.floor(rnd() * 5), skin: Math.floor(rnd() * 5), hair: Math.floor(rnd() * 6), height: 0.92 + rnd() * 0.16 },
    };
    [w.x, w.z] = place(w);
    walkers.push(w);
  }

  function nextEdge(w) {
    const opts = adj.get(w.to).filter((o) => o.to !== w.from);
    const list = opts.length ? opts : adj.get(w.to);
    const o = list[Math.floor(rnd() * list.length)];
    w.from = o.from;
    w.to = o.to;
    w.len = o.len;
    w.axis = o.axis;
    w.t = 0;
    if (rnd() < 0.5) w.side = -w.side; // cross the street sometimes
  }

  return {
    walkers,
    /** dt seconds; `avoid` = { x, z } (Ori) — walkers within 1.3 m are nudged aside. */
    update(dt, avoid) {
      for (const w of walkers) {
        if (w.stop > 0) { w.stop -= dt; continue; }
        w.t += (w.speed * dt) / w.len;
        if (w.t >= 1) {
          nextEdge(w);
          if (rnd() < 0.18) w.stop = 0.6 + rnd() * 2.2; // stops at the corner to look at the phone
        }
        const [tx, tz] = place(w);
        const k = Math.min(1, dt * 4.5);
        const nx = w.x + (tx - w.x) * k;
        const nz = w.z + (tz - w.z) * k;
        if (Math.hypot(nx - w.x, nz - w.z) > 1e-4) w.heading = Math.atan2(nx - w.x, nz - w.z);
        w.x = nx;
        w.z = nz;
        if (avoid) {
          const dx = w.x - avoid.x;
          const dz = w.z - avoid.z;
          const d = Math.hypot(dx, dz);
          if (d < 1.3 && d > 1e-4) { w.x += (dx / d) * (1.3 - d) * 0.5; w.z += (dz / d) * (1.3 - d) * 0.5; }
        }
      }
    },
  };
}
