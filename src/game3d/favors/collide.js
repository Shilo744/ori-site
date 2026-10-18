// "Ori, Can You...?" — 2D collision on the ground plane (PURE, no three): axis-aligned boxes and circles in a spatial hash.
// The player is a circle: `push` slides it out of whatever it overlaps; `segment` tells the camera how far it can go before a wall.
// Collider shapes:  { t: 0, x0, z0, x1, z1 } (box)   { t: 1, x, z, r } (circle)

export const box = (x0, z0, x1, z1) => ({ t: 0, x0, z0, x1, z1 });
export const circle = (x, z, r) => ({ t: 1, x, z, r });

export function createCollisionWorld(colliders, cell = 8) {
  const cells = new Map();
  const key = (i, j) => i * 4096 + j + 2048;
  const add = (c, x0, z0, x1, z1) => {
    for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++) {
      for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
        const k = key(i, j);
        let a = cells.get(k);
        if (!a) cells.set(k, (a = []));
        a.push(c);
      }
    }
  };
  for (const c of colliders) {
    if (c.t === 0) add(c, c.x0, c.z0, c.x1, c.z1);
    else add(c, c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r);
  }
  let stamp = 0;
  const seen = new Map();
  const dyn = []; // a few colliders that come and go (the car Ori left in the street): checked every time, no spatial hash

  /** Calls fn(collider) once for every collider whose cells touch the square around (x, z). */
  function near(x, z, r, fn) {
    stamp++;
    for (let i = Math.floor((x - r) / cell); i <= Math.floor((x + r) / cell); i++) {
      for (let j = Math.floor((z - r) / cell); j <= Math.floor((z + r) / cell); j++) {
        const a = cells.get(key(i, j));
        if (!a) continue;
        for (let n = 0; n < a.length; n++) {
          const c = a[n];
          if (c.off || seen.get(c) === stamp) continue; // (`off`: a parked car that Ori has driven away)
          seen.set(c, stamp);
          fn(c);
        }
      }
    }
    for (let n = 0; n < dyn.length; n++) if (!dyn[n].off) fn(dyn[n]);
  }

  const out = { x: 0, z: 0, hit: false, nx: 0, nz: 0 };
  /** Moves the circle (x, z, r) out of everything it overlaps (slides along walls). Returns a shared result object. */
  function push(x, z, r) {
    out.hit = false;
    out.nx = 0;
    out.nz = 0;
    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      near(x, z, r + 0.01, (c) => {
        let nx;
        let nz;
        let pen; // how far the circle sits inside the collider, along the normal that leads out
        if (c.t === 0) {
          const px = x < c.x0 ? c.x0 : x > c.x1 ? c.x1 : x;
          const pz = z < c.z0 ? c.z0 : z > c.z1 ? c.z1 : z;
          const dx = x - px;
          const dz = z - pz;
          const d = Math.hypot(dx, dz);
          if (d > 1e-7) { nx = dx / d; nz = dz / d; pen = r - d; } else {
            // the centre is inside the box: leave through the nearest face
            const l = x - c.x0;
            const rr = c.x1 - x;
            const t = z - c.z0;
            const b = c.z1 - z;
            const m = Math.min(l, rr, t, b);
            if (m === l) { nx = -1; nz = 0; } else if (m === rr) { nx = 1; nz = 0; } else if (m === t) { nx = 0; nz = -1; } else { nx = 0; nz = 1; }
            pen = m + r;
          }
        } else {
          const dx = x - c.x;
          const dz = z - c.z;
          const d = Math.hypot(dx, dz);
          if (d > 1e-7) { nx = dx / d; nz = dz / d; } else { nx = 1; nz = 0; }
          pen = r + c.r - d;
        }
        if (pen > 0) {
          x += nx * pen;
          z += nz * pen;
          out.hit = true;
          out.nx = nx;
          out.nz = nz;
          moved = true;
        }
      });
      if (!moved) break;
    }
    out.x = x;
    out.z = z;
    return out;
  }

  /** True when the circle overlaps any collider (used for placement and the reachability flood fill). */
  function blocked(x, z, r) {
    let hit = false;
    near(x, z, r, (c) => {
      if (hit) return;
      if (c.t === 0) {
        const px = x < c.x0 ? c.x0 : x > c.x1 ? c.x1 : x;
        const pz = z < c.z0 ? c.z0 : z > c.z1 ? c.z1 : z;
        if (Math.hypot(x - px, z - pz) < r || (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1)) hit = true;
      } else if (Math.hypot(x - c.x, z - c.z) < r + c.r) hit = true;
    });
    return hit;
  }

  /** The first hit along the segment (a → b) as a fraction 0..1 (1 = clear). `pad` fattens every collider (the camera has a size). */
  function segment(ax, az, bx, bz, pad = 0) {
    let best = 1;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    near((ax + bx) / 2, (az + bz) / 2, len / 2 + pad + 1, (c) => {
      if (c.t === 0) {
        let t0 = 0;
        let t1 = 1;
        const lo = [c.x0 - pad, c.z0 - pad];
        const hi = [c.x1 + pad, c.z1 + pad];
        const o = [ax, az];
        const dd = [dx, dz];
        for (let k = 0; k < 2; k++) {
          if (Math.abs(dd[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) return; } else {
            let a = (lo[k] - o[k]) / dd[k];
            let b = (hi[k] - o[k]) / dd[k];
            if (a > b) { const s = a; a = b; b = s; }
            if (a > t0) t0 = a;
            if (b < t1) t1 = b;
            if (t0 > t1) return;
          }
        }
        if (t0 < best) best = t0;
      } else {
        const fx = ax - c.x;
        const fz = az - c.z;
        const rr = c.r + pad;
        const A = dx * dx + dz * dz;
        const B = 2 * (fx * dx + fz * dz);
        const C = fx * fx + fz * fz - rr * rr;
        if (C <= 0) { best = 0; return; }
        const disc = B * B - 4 * A * C;
        if (disc < 0 || A < 1e-12) return;
        const t = (-B - Math.sqrt(disc)) / (2 * A);
        if (t >= 0 && t < best) best = t;
      }
    });
    return best;
  }

  const addDynamic = (c) => { dyn.push(c); return c; };
  const removeDynamic = (c) => { const i = dyn.indexOf(c); if (i >= 0) dyn.splice(i, 1); };
  return { near, push, blocked, segment, addDynamic, removeDynamic, count: colliders.length };
}
