// A pure-pursuit "autopilot" for NEON DRIFT: steering from a look-ahead point on the road, speed from the curvature profile
// of the track (braking points are found by a backward pass). It is the test/benchmark driver today and the base of the AI
// opponents in T43. PURE (no three, no DOM).
import { surfacePoint, wrapS } from './track.js';
import { maxYawRate } from './physics.js';
import { clamp } from './rng.js';

/**
 * Allowed speed (m/s) at each track sample for a given car type: corner speed from the curvature (with the downforce of
 * the car), then limited by how hard the car can brake into the next corner. Cached on the track per car type.
 */
export function speedProfile(track, car, safety = 0.9) {
  const key = `sp:${car.type}:${safety}`;
  if (track.cache[key]) return track.cache[key];
  const p = car.p;
  const n = track.n;
  const v = new Float64Array(n);
  const vCap = p.vRef * 0.95;
  for (let i = 0; i < n; i++) {
    // use the worst curvature within a few metres ahead so the profile is not late on corner entry
    let k = 0;
    for (let d = -2; d <= 4; d++) k = Math.max(k, Math.abs(track.kappaS[(i + d + n) % n]));
    const a0 = safety * p.aLat0 * p.grip;
    const down = safety * p.aLatDown * p.grip;
    const denom = k - down;
    const vc = denom <= 1e-6 ? vCap : Math.sqrt(a0 / denom);
    v[i] = Math.min(vCap, vc);
  }
  const aB = p.brake * 0.72;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = n * 2 - 1; i >= 0; i--) {
      const a = i % n;
      const b = (i + 1) % n;
      const lim = Math.sqrt(v[b] * v[b] + 2 * aB * track.ds);
      if (lim < v[a]) v[a] = lim;
    }
  }
  track.cache[key] = v;
  return v;
}

/**
 * A driver function `drive(car, out)` filling `out.throttle/brake/steer/handbrake/boost` for the given car on the track.
 * @param {object} opts `skill` scales the target speed (1 = flat out on the profile), `offset` is the lateral line (m).
 */
export function createDriver(track, car, opts = {}) {
  const skill = opts.skill ?? 1;
  const profile = speedProfile(track, car);
  const tp = {};
  const n = track.n;
  return function drive(c, out) {
    const speed = Math.max(c.speed, 0.1);
    const look = clamp(9 + speed * 0.42, 11, 48);
    const offset = typeof opts.offset === 'function' ? opts.offset(c) : (opts.offset || 0);
    surfacePoint(track, c.s + look, offset, tp);
    let ang = Math.atan2(tp.z - c.z, tp.x - c.x) - c.psi;
    ang = Math.atan2(Math.sin(ang), Math.cos(ang));
    const kappa = (2 * Math.sin(ang)) / look;
    const need = kappa * Math.max(c.u, 1);
    out.steer = clamp(need / Math.max(maxYawRate(c, Math.max(c.u, 1)), 0.25), -1, 1);
    // target speed: the profile a little ahead (we need time to brake), scaled by skill
    const ahead = wrapS(track, c.s + speed * 0.12);
    const f = ahead / track.ds;
    const i = Math.floor(f) % n;
    const w = f - Math.floor(f);
    const vt = (profile[i] * (1 - w) + profile[(i + 1) % n] * w) * skill;
    const err = vt - c.speed;
    out.throttle = err > 0 ? clamp(err * 0.5 + 0.15, 0, 1) : 0;
    out.brake = err < -1.5 ? clamp((-err - 1.5) * 0.12, 0, 1) : 0;
    out.handbrake = false;
    out.boost = c.boost > 60 && Math.abs(out.steer) < 0.15 && err > 3;
    return out;
  };
}

