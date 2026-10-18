// "Ori, Can You...?" — the neighbourhood's moving traffic: a few cars cruise along every avenue and street in their own lane (right-hand traffic), slow for anything in
// front of them (a car, Ori on foot, the car Ori drives) and give way at the crossings (the east-west streets yield to the avenues). They share the parked cars' geometry
// and paint (props.makeCar). Deterministic from the seed; wraps round the neighbourhood.
import { mulberry32 } from '../rng.js';
import { ROAD_X, ROAD_Z, BOUNDS } from './map.js';

const LANE = 1.7;
const KINDS = ['hatch', 'sedan', 'hatch', 'van', 'sedan'];
const COLOURS = [0xe9e6df, 0x2d3139, 0xb23a3a, 0x3b6ea8, 0xd8b441, 0x6b8f71, 0xa9adb5, 0x7a4f8f];

export function createTraffic({ props, seed = 1, perLane = 2 }) {
  const rnd = mulberry32((seed * 7919 + 13) >>> 0);
  const cars = [];
  const lines = [...ROAD_Z.map((c) => ({ axis: 'x', c })), ...ROAD_X.map((c) => ({ axis: 'z', c }))];
  for (const ln of lines) {
    const lo = ln.axis === 'x' ? BOUNDS.x0 + 6 : BOUNDS.z0 + 6;
    const hi = ln.axis === 'x' ? BOUNDS.x1 - 6 : BOUNDS.z1 - 6;
    for (const dir of [1, -1]) for (let k = 0; k < perLane; k++) ln.queue = (ln.queue || []).concat([[dir, lo + ((k + rnd() * 0.7) / perLane) * (hi - lo)]]);
  }
  const addCar = (ln, dir, u) => {
    const kind = KINDS[Math.floor(rnd() * KINDS.length)];
    const mesh = props.makeCar(kind, COLOURS[Math.floor(rnd() * COLOURS.length)]);
    const lo = ln.axis === 'x' ? BOUNDS.x0 + 6 : BOUNDS.z0 + 6;
    const hi = ln.axis === 'x' ? BOUNDS.x1 - 6 : BOUNDS.z1 - 6;
    const c = { axis: ln.axis, c: ln.c, dir, u, lo, hi, v: 0, want: 7 + rnd() * 4, x: 0, z: 0, heading: 0, mesh, len: kind === 'van' ? 2.5 : 2.3, kind };
    cars.push(c);
    return c;
  };
  const place = (c) => {
    if (c.axis === 'x') { c.x = c.u; c.z = c.c + LANE * c.dir; c.heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; } else { c.z = c.u; c.x = c.c - LANE * c.dir; c.heading = c.dir > 0 ? 0 : Math.PI; }
    c.mesh.group.position.set(c.x, 0, c.z);
    c.mesh.group.rotation.y = c.heading - Math.PI / 2;
  };
  for (const ln of lines) for (const [dir, u] of ln.queue) addCar(ln, dir, u);
  for (const c of cars) place(c);

  let clock = 0;
  // one cycle = 12 s: the avenues go (5 s), all red (1 s), the streets go (5 s), all red (1 s)
  const green = (axis) => { const t = clock % 12; return axis === 'z' ? t < 5 : t >= 6 && t < 11; };

  return {
    cars,
    /** `others`: [{ x, z, r }] things to stop for (Ori on foot, the car he drives). */
    update(dt, others = []) {
      dt = Math.min(dt, 0.1);
      clock += dt;
      for (const c of cars) {
        const fx = Math.sin(c.heading);
        const fz = Math.cos(c.heading);
        let gap = Infinity;
        const check = (ox, oz, r, yields) => {
          const rx = ox - c.x;
          const rz = oz - c.z;
          const ahead = rx * fx + rz * fz;
          const lat = Math.abs(rx * fz - rz * fx);
          if (ahead > 0 && lat < 1.5 + r * 0.3) gap = Math.min(gap, ahead - c.len - r);
        };
        for (const o of cars) if (o !== c) check(o.x, o.z, 1, false);
        // the lights: a red one is a wall at the stop line (5.8 m before the middle of the crossing); once past that line the car goes on through
        if (!green(c.axis)) {
          const cross = c.axis === 'x' ? ROAD_X : ROAD_Z;
          for (const cr of cross) { const dist = (cr - c.u) * c.dir; if (dist > 5.2 && dist < 40) gap = Math.min(gap, dist - 5.8 - c.len / 2); }
        }
        for (const o of others) check(o.x, o.z, o.r || 0.5, false);
        // brake to keep a gap that grows with the speed
        const safe = 3 + c.v * 0.9;
        const target = gap < safe ? Math.max(0, c.want * Math.max(0, (gap - 1.5) / (safe - 1.5))) : c.want;
        c.v += (target - c.v) * Math.min(1, (target < c.v ? 4.5 : 1.1) * dt);
        c.u += c.dir * c.v * dt;
        if (c.u > c.hi) c.u = c.lo;
        else if (c.u < c.lo) c.u = c.hi;
        place(c);
      }
    },
    /** A car that got hit leaves the traffic (the caller makes a free body of it): returns { x, z, heading, vx, vz, mesh, kind } or null. */
    detach(c) {
      const i = cars.indexOf(c);
      if (i < 0) return null;
      cars.splice(i, 1);
      return { x: c.x, z: c.z, heading: c.heading, vx: Math.sin(c.heading) * c.v, vz: Math.cos(c.heading) * c.v, mesh: c.mesh, kind: c.kind };
    },
    /** A fresh car on a random lane, as far from `from` as it can be (the replacement for a wreck that was cleared away). */
    spawn(from) {
      let best = null; let bd = -1;
      for (let k = 0; k < 6; k++) {
        const ln = lines[Math.floor(rnd() * lines.length)];
        const dir = rnd() < 0.5 ? 1 : -1;
        const u = (ln.axis === 'x' ? BOUNDS.x0 + 8 : BOUNDS.z0 + 8) + rnd() * ((ln.axis === 'x' ? BOUNDS.x1 - BOUNDS.x0 : BOUNDS.z1 - BOUNDS.z0) - 16);
        const x = ln.axis === 'x' ? u : ln.c; const z = ln.axis === 'x' ? ln.c : u;
        const d = from ? Math.hypot(x - from.x, z - from.z) : 0;
        if (d > bd) { bd = d; best = [ln, dir, u]; }
      }
      const c = addCar(best[0], best[1], best[2]);
      place(c);
    },
    /** Pushes a driven car (state { x, z, speed }) out of any traffic car it touches; returns true when it hit one. */
    bump(st, r = 1.5) {
      let hit = false;
      for (const c of cars) {
        const dx = st.x - c.x;
        const dz = st.z - c.z;
        const d = Math.hypot(dx, dz);
        const min = r + 1.15;
        if (d < min && d > 1e-4) { st.x += (dx / d) * (min - d); st.z += (dz / d) * (min - d); st.speed *= 0.6; c.v *= 0.5; hit = true; }
      }
      return hit;
    },
    dispose() { for (const c of cars) c.mesh.dispose(); cars.length = 0; },
  };
}
