// NEON DRIFT drivers — a pure-pursuit autopilot with a racing line, a speed profile from the curvature, overtaking, mistakes and
// a pace mode for the rolling start. It is the test/benchmark driver, the AI of the rivals and the player's "bot" in the tests.
// PURE (no three, no DOM, no Math.random: every random choice comes from the seeded `rnd` it is given).
import { surfacePoint, wrapS, deltaS } from './track.js';
import { maxYawRate, DT } from './physics.js';
import { clamp, smoothstep, wrapIdx } from './rng.js';

/** Circular box blur of `a` with half-width `w` samples. */
function blur(a, w) {
  const n = a.length;
  const out = new Float32Array(n);
  let acc = 0;
  for (let i = -w; i <= w; i++) acc += a[wrapIdx(i, n)];
  for (let i = 0; i < n; i++) {
    out[i] = acc / (2 * w + 1);
    acc += a[wrapIdx(i + w + 1, n)] - a[wrapIdx(i - w, n)];
  }
  return out;
}

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
    // the worst curvature within a few metres ahead, so the profile is not late on corner entry
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
 * The racing line as a lateral offset (m, + = right) per track sample: wide on the way into a corner, tight at the apex, wide
 * again on the way out — a difference of two blurs of the curvature. Cached on the track.
 */
export function racingLine(track, gain = 560) {
  const key = `line:${gain}`;
  if (track.cache[key]) return track.cache[key];
  const k = Float32Array.from(track.kappaS);
  const narrow = blur(k, 14);
  const wide = blur(k, 46);
  const line = new Float32Array(track.n);
  for (let i = 0; i < track.n; i++) {
    const room = track.width[i] / 2 - 2.6; // keep the car clear of the kerb
    line[i] = clamp(gain * (narrow[i] - 0.62 * wide[i]), -room, room);
  }
  track.cache[key] = line;
  return line;
}

function sample(arr, track, s) {
  const f = wrapS(track, s) / track.ds;
  const i = Math.floor(f) % track.n;
  const w = f - Math.floor(f);
  return arr[i] * (1 - w) + arr[(i + 1) % track.n] * w;
}

/**
 * A driver function `drive(car, out, ctx?)` filling `out.throttle/brake/steer/handbrake/boost` for the car on the track.
 * @param {object} opts
 *   skill      scales the target speed (1 = the full speed profile)
 *   line       follow the racing line (default true)
 *   bias       a constant lateral offset (m) added to the line: every rival has its own
 *   fixedSpeed hold exactly this speed (the rolling start pace) instead of the profile
 *   lane       with fixedSpeed: the lateral offset to hold
 *   bonus      speed multiplier on the racing line (the line allows a little more)
 *   mistakes   0..1: how often the driver lifts / wobbles (Easy)
 *   rnd        seeded random source (needed with mistakes)
 *   boost      use the boost on straights
 *   avoid      go around slower cars ahead (default true)
 * `ctx`: { others: [{ s, lateral, speed }], mul: extra speed multiplier (rubber band) }
 */
export function createDriver(track, car, opts = {}) {
  const skill = opts.skill ?? 1;
  const useLine = opts.line ?? true;
  const bonus = opts.bonus ?? (useLine ? 1.045 : 1);
  const profile = speedProfile(track, car);
  const line = racingLine(track);
  const tp = {};
  const n = track.n;
  const st = { offset: 0, lapse: 0, nextLapse: 6 + (opts.rnd ? opts.rnd() * 10 : 8), wob: 0 };
  return function drive(c, out, ctx = null, dt = DT) {
    const speed = Math.max(c.speed, 0.1);
    const look = clamp(9 + speed * 0.42, 11, 48);
    // where on the road do we want to be?
    let target = opts.fixedSpeed ? opts.lane || 0 : (useLine ? sample(line, track, c.s + look * 0.7) : 0) + (opts.bias || 0);
    let slower = Infinity;
    if (ctx && ctx.others && opts.avoid !== false && !opts.fixedSpeed) {
      for (const o of ctx.others) {
        const ds = deltaS(track, c.s, o.s);
        if (ds > 1 && ds < 30 && Math.abs(o.lateral - c.lateral) < 5.5) {
          const side = o.lateral >= c.lateral ? -1 : 1; // pass on the side with more room
          const room = track.width[Math.floor(c.idx >= 0 ? c.idx : 0) % n] / 2 - 2;
          const alt = clamp(o.lateral + side * 3.3, -room, room);
          target += (alt - target) * smoothstep(30, 11, ds);
          if (ds < 12 && o.speed < c.speed) slower = Math.min(slower, o.speed);
        }
      }
    }
    st.offset += (target - st.offset) * Math.min(1, dt * 3.2);
    // mistakes: a short lift and a wobble now and then (Easy)
    let lapse = 1;
    if (opts.mistakes && opts.rnd) {
      st.nextLapse -= dt;
      if (st.nextLapse <= 0) { st.lapse = 0.7 + opts.rnd() * 0.5; st.nextLapse = (9 + opts.rnd() * 14) / opts.mistakes; st.wob = (opts.rnd() - 0.5) * 3.2; }
      if (st.lapse > 0) { st.lapse -= dt; lapse = 0.78; } else st.wob *= 1 - Math.min(1, dt * 2);
    }
    surfacePoint(track, c.s + look, st.offset + st.wob, tp);
    let ang = Math.atan2(tp.z - c.z, tp.x - c.x) - c.psi;
    ang = Math.atan2(Math.sin(ang), Math.cos(ang));
    const kappa = (2 * Math.sin(ang)) / look;
    const need = kappa * Math.max(c.u, 1);
    out.steer = clamp(need / Math.max(maxYawRate(c, Math.max(c.u, 1)), 0.25), -1, 1);
    // how fast?
    let vt;
    if (opts.fixedSpeed) vt = opts.fixedSpeed;
    else {
      const f = wrapS(track, c.s + speed * 0.12) / track.ds;
      const i = Math.floor(f) % n;
      const w = f - Math.floor(f);
      vt = (profile[i] * (1 - w) + profile[(i + 1) % n] * w) * skill * bonus * lapse * ((ctx && ctx.mul) || 1);
      if (slower < Infinity) vt = Math.min(vt, slower + 1.5);
    }
    const err = vt - c.speed;
    out.throttle = err > 0 ? clamp(err * 0.5 + 0.15, 0, 1) : 0;
    out.brake = err < -1.5 ? clamp((-err - 1.5) * 0.12, 0, 1) : 0;
    out.handbrake = false;
    out.boost = !!opts.boost && c.boost > 55 && Math.abs(out.steer) < 0.12 && err > 4;
    return out;
  };
}
