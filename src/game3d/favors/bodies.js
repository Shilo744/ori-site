// "Ori, Can You...?" — cars that can be knocked about. A parked car or a traffic car that the car Ori drives touches turns into a free BODY: it takes the impulse of the hit (it slides,
// spins, bounces off walls and other bodies, rolls to a stop) and the driver loses some speed too. A body is three circles in the collision world (so Ori on foot and the traffic
// stop for it). PURE apart from the meshes it moves (props.makeCar groups).
import { wrapPi } from '../rng.js';

const R = 0.95; // circle radius of a car
const MASS_P = 1.1; // the car Ori drives is a little heavier
const INERTIA = 2.1;
const E = 0.25; // bounciness
const MAX_V = 19; // a knocked car never flies off faster than this (arcade)
const FRICTION = 9; // m/s² of tyre scrub once it is sliding

const cross = (ax, az, bx, bz) => ax * bz - az * bx;

export function createBodies({ world }) {
  const bodies = [];

  function circlesOf(b) {
    const fx = Math.sin(b.heading); const fz = Math.cos(b.heading);
    return b.offs.map((o) => ({ x: b.x + fx * o, z: b.z + fz * o }));
  }
  function syncColliders(b) {
    const cs = circlesOf(b);
    cs.forEach((c, i) => { b.cols[i].x = c.x; b.cols[i].z = c.z; });
  }

  return {
    bodies,
    /** Turns a car into a body. `mesh` is its group (position / rotation.y are kept in step); `src` is whatever the caller needs back. */
    add({ x, z, heading, vx = 0, vz = 0, mesh, long = 1.35, src = null }) {
      const b = { x, z, heading, vx, vz, w: 0, mesh, offs: [-long, 0, long], cols: [], rest: 0, src, age: 0, cool: 0 };
      b.cols = b.offs.map(() => world.addDynamic({ t: 1, x, z, r: R }));
      syncColliders(b);
      bodies.push(b);
      return b;
    },
    remove(b) {
      const i = bodies.indexOf(b);
      if (i < 0) return;
      for (const c of b.cols) world.removeDynamic(c);
      bodies.splice(i, 1);
    },
    /** The player's car (state { x, z, vx, vz, heading, speed }) against every body; returns the strongest hit (m/s along the normal), 0 when none. */
    hitBy(p, pOffs = [-1.35, 0, 1.35]) {
      let strongest = 0;
      const speed0 = p.speed;
      const pf = { x: Math.sin(p.heading), z: Math.cos(p.heading) };
      for (const b of bodies) {
        const pc = pOffs.map((o) => ({ x: p.x + pf.x * o, z: p.z + pf.z * o }));
        const cb = circlesOf(b);
        // the deepest overlap between one of the player's circles and one of the body's decides the contact (one push per frame, never a pile of them)
        let best = null;
        for (const a of pc) for (const c of cb) {
          const d = Math.hypot(c.x - a.x, c.z - a.z);
          if (d < 2 * R && (!best || 2 * R - d > best.over)) best = { a, c, d, over: 2 * R - d };
        }
        if (!best) continue;
        let dx = best.c.x - best.a.x; let dz = best.c.z - best.a.z;
        if (best.d < 1e-4) { dx = pf.x; dz = pf.z; best.d = 1; }
        const nx = dx / best.d; const nz = dz / best.d; // from the player's circle to the body's
        // separate (the body gives way more than the heavier car)
        b.x += nx * best.over * 0.65; b.z += nz * best.over * 0.65;
        p.x -= nx * best.over * 0.35; p.z -= nz * best.over * 0.35;
        const cx = (best.a.x + best.c.x) / 2; const cz = (best.a.z + best.c.z) / 2;
        const rx = cx - b.x; const rz = cz - b.z;
        const vbx = b.vx - b.w * rz; const vbz = b.vz + b.w * rx;
        const rel = (p.vx - vbx) * nx + (p.vz - vbz) * nz; // > 0: closing
        if (rel > 0) {
          const rn = cross(rx, rz, nx, nz);
          const j = ((1 + E) * rel) / (1 / MASS_P + 1 + (rn * rn) / INERTIA);
          b.vx += j * nx; b.vz += j * nz;
          b.w += (rx * nz - rz * nx) * j / INERTIA;
          p.speed -= (j / MASS_P) * (nx * pf.x + nz * pf.z);
          if (speed0 > 0 && b.cool <= 0) { p.speed = Math.min(p.speed, speed0 * 0.6); b.cool = 0.35; } // a real hit: it never just ploughs on at full speed (once per knock)
          p.vx = pf.x * p.speed; p.vz = pf.z * p.speed;
          strongest = Math.max(strongest, rel);
          b.rest = 0;
        }
      }
      return strongest;
    },
    update(dt) {
      dt = Math.min(dt, 0.05);
      for (const b of bodies) {
        b.age += dt;
        b.cool -= dt;
        const fx = Math.sin(b.heading); const fz = Math.cos(b.heading);
        // wheels: sideways slide dies fast, rolling along dies slowly
        const along = b.vx * fx + b.vz * fz;
        const lat = b.vx * fz - b.vz * fx;
        const fr = FRICTION * dt;
        const na = (Math.abs(along) <= fr ? 0 : along - Math.sign(along) * fr) * Math.exp(-0.5 * dt);
        const nl = lat * Math.exp(-7 * dt);
        b.vx = fx * na + fz * nl; b.vz = fz * na - fx * nl;
        const sp = Math.hypot(b.vx, b.vz);
        if (sp > MAX_V) { b.vx *= MAX_V / sp; b.vz *= MAX_V / sp; }
        b.w *= Math.exp(-3.2 * dt);
        b.x += b.vx * dt; b.z += b.vz * dt;
        b.heading = wrapPi(b.heading + b.w * dt);
        // walls and other things
        for (let k = 0; k < b.offs.length; k++) {
          const gx = b.x + Math.sin(b.heading) * b.offs[k]; const gz = b.z + Math.cos(b.heading) * b.offs[k];
          for (const c of b.cols) c.off = true; // (do not collide with itself)
          const r = world.push(gx, gz, R);
          for (const c of b.cols) c.off = false;
          if (r.hit) {
            b.x += r.x - gx; b.z += r.z - gz;
            const vn = b.vx * r.nx + b.vz * r.nz;
            if (vn < 0) { b.vx -= (1 + 0.3) * vn * r.nx; b.vz -= (1 + 0.3) * vn * r.nz; b.w *= 0.7; }
          }
        }
        b.rest = Math.hypot(b.vx, b.vz) < 0.25 && Math.abs(b.w) < 0.2 ? b.rest + dt : 0;
        syncColliders(b);
        if (b.mesh) { b.mesh.group.position.set(b.x, 0, b.z); b.mesh.group.rotation.y = b.heading - Math.PI / 2; }
      }
      // body against body (a car shoved into another one passes the push on)
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i]; const b = bodies[j];
          if (Math.hypot(a.x - b.x, a.z - b.z) > 6) continue;
          const ca = circlesOf(a); const cb = circlesOf(b);
          for (const p of ca) for (const q of cb) {
            let dx = q.x - p.x; let dz = q.z - p.z;
            const d = Math.hypot(dx, dz);
            if (d >= 2 * R || d < 1e-4) continue;
            dx /= d; dz /= d;
            const over = 2 * R - d;
            a.x -= dx * over * 0.5; a.z -= dz * over * 0.5; b.x += dx * over * 0.5; b.z += dz * over * 0.5;
            const rel = (a.vx - b.vx) * dx + (a.vz - b.vz) * dz;
            if (rel > 0) { const j2 = ((1 + E) * rel) / 2; a.vx -= j2 * dx; a.vz -= j2 * dz; b.vx += j2 * dx; b.vz += j2 * dz; a.rest = b.rest = 0; }
          }
        }
      }
    },
    dispose() { for (const b of [...bodies]) this.remove(b); },
  };
}
