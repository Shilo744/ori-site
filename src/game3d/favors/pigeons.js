// "Ori, Can You...?" — the pigeons (PURE: no three, no DOM, deterministic from a seed). Little flocks live on a few spots (the plaza, the fountain, the café terrace, the bus
// stop): they walk about with their heads bobbing, peck at the ground, and when Ori (or anybody) comes close they burst into the air, fly an arc and settle again a few
// metres further on. `update(dt, intruders)` moves them; the renderer reads `birds`.
import { mulberry32 } from '../rng.js';

const SCARE = 3.4; // metres: closer than this and they take off
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * @param {number} seed
 * @param {{ x: number, z: number, n: number, r?: number }[]} spots  where flocks live and how many birds
 */
export function createPigeons(seed, spots) {
  const rnd = mulberry32(seed * 977 + 3);
  const birds = [];
  spots.forEach((s, si) => {
    for (let i = 0; i < s.n; i++) {
      const a = rnd() * 6.283;
      const r = rnd() * (s.r ?? 3);
      birds.push({ x: s.x + Math.cos(a) * r, y: 0, z: s.z + Math.sin(a) * r, heading: rnd() * 6.283, state: 'peck', t: rnd() * 3, phase: rnd() * 6.283, spot: si, from: null, to: null, dur: 0, u: 0, fly: 0, peck: 0, walk: 0 });
    }
  });
  const landSpot = (b, avoid) => {
    const s = spots[b.spot];
    for (let k = 0; k < 8; k++) {
      const a = rnd() * 6.283;
      const r = 4 + rnd() * ((s.r ?? 3) + 5);
      const x = s.x + Math.cos(a) * r;
      const z = s.z + Math.sin(a) * r;
      if (!avoid || Math.hypot(x - avoid.x, z - avoid.z) > 9) return { x, z };
    }
    return { x: s.x, z: s.z };
  };
  return {
    birds,
    spots,
    update(dt, intruders = []) {
      for (const b of birds) {
        b.phase += dt * (b.state === 'fly' ? 26 : 6);
        let near = null;
        let nd = SCARE;
        for (const o of intruders) { const d = Math.hypot(o.x - b.x, o.z - b.z); if (d < nd) { nd = d; near = o; } }
        if (b.state !== 'fly' && near) {
          // burst into the air, away from whoever came close
          b.state = 'fly';
          b.from = { x: b.x, z: b.z };
          const t = landSpot(b, near);
          b.to = t;
          b.dur = 1.6 + rnd() * 1.4;
          b.u = 0;
          b.heading = Math.atan2(t.x - b.x, t.z - b.z);
        }
        if (b.state === 'fly') {
          b.u += dt / b.dur;
          const u = clamp(b.u, 0, 1);
          const e = u * u * (3 - 2 * u);
          b.x = b.from.x + (b.to.x - b.from.x) * e;
          b.z = b.from.z + (b.to.z - b.from.z) * e;
          b.y = Math.sin(Math.PI * u) * (2.4 + b.dur * 0.6);
          b.fly = Math.min(1, b.fly + dt * 6);
          b.peck = 0;
          if (b.u >= 1) { b.state = 'peck'; b.y = 0; b.t = 1 + rnd() * 2; b.fly = 0; }
        } else {
          b.fly = Math.max(0, b.fly - dt * 8);
          b.t -= dt;
          if (b.t <= 0) {
            // alternate between pecking in place and a few quick steps
            if (b.walk > 0) { b.walk = 0; b.t = 0.8 + rnd() * 2.2; } else if (rnd() < 0.45) { b.walk = 0.5 + rnd() * 0.8; b.heading += (rnd() - 0.5) * 2.4; b.t = b.walk; } else b.t = 0.6 + rnd() * 1.6;
          }
          if (b.walk > 0) {
            const s = spots[b.spot];
            const nx = b.x + Math.sin(b.heading) * 0.9 * dt;
            const nz = b.z + Math.cos(b.heading) * 0.9 * dt;
            if (Math.hypot(nx - s.x, nz - s.z) < (s.r ?? 3) + 6) { b.x = nx; b.z = nz; } else b.heading += 2.2;
            b.peck = 0.2 + 0.2 * Math.max(0, Math.sin(b.phase * 1.6)); // head bobbing as it walks
          } else b.peck = Math.max(0, Math.sin(b.phase * 0.9 + b.spot)) ** 3; // pecks at the ground
        }
      }
    },
  };
}
