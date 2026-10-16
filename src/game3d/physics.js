// NEON DRIFT driving model. PURE (no three, no DOM, no Math.random/Date): a fixed 1/120 s step, so the same inputs on the same
// track always give the same state (see `stateHash`).
//
// The model is an "arcade bicycle": the car's heading is steered directly (yaw rate = steer × the most the tyres can bite at
// this speed), the velocity vector follows the heading through a lateral-grip force that is capped (so you can understeer,
// slide and drift), the handbrake takes grip away from the rear, drifting charges the boost meter, and an engine curve with
// six automatic gears drives the car. Walls stand at the edge of the run-off strip (see track.js) and are inescapable.
import { clamp, smoothstep, mulberry32, hashNumbers } from './rng.js';
import { closest, frameAt, WALL_MARGIN } from './track.js';

export const DT = 1 / 120;
const G = 9.81;
const DRIFT_ANGLE = 0.6; // rad (≈34°): slip angle at full steering lock while sliding

/** Per-car tuning. `gt` is the default. */
export const CAR_TYPES = {
  hatch: { name: 'Hatch', vRef: 84, accel: 1.0, grip: 1.1, aLat0: 13.2, aLatDown: 0.0016, steer: 1.05, cd: 0.00088, mass: 1.0 },
  gt: { name: 'GT', vRef: 92, accel: 1.0, grip: 1.0, aLat0: 12.4, aLatDown: 0.0018, steer: 1.0, cd: 0.0008, mass: 1.15 },
  hyper: { name: 'Hyper', vRef: 100, accel: 1.1, grip: 0.94, aLat0: 12.0, aLatDown: 0.0021, steer: 0.96, cd: 0.00072, mass: 1.1 },
};

const GEAR_FRAC = [0.2, 0.3, 0.43, 0.58, 0.77, 1.0]; // speed at the redline of each gear, as a fraction of vRef
const GEAR_ACC = [13.5, 11.5, 9.6, 8.0, 6.6, 5.6]; // peak drive acceleration of each gear (m/s²)
export const GEARS = GEAR_FRAC.length;
const IDLE = 1000;
const REDLINE = 8000;

export const BODY = { length: 4.5, halfWidth: 0.95, circleR: 1.02, circleOffset: 1.25, wheelbase: 2.7 };

function params(type) {
  const base = CAR_TYPES[type] || CAR_TYPES.gt;
  return {
    ...base,
    maxSteer: 0.55, // rad at the wheels, for the low-speed (kinematic) turning radius
    brake: 15.5,
    reverseAcc: 6.5,
    reverseMax: 13,
    rolling: 0.12,
    tractionLong: 12.3,
    boostAcc: 17,
    boostDrain: 38,
    boostMin: 15,
    driftCharge: 26,
    redirect: 0.5, // share of the speed kept when the tyres kill sideways motion
  };
}

/** A fresh car (all numeric fields preallocated: stepping never allocates). */
export function createCar(type = 'gt') {
  return {
    type,
    p: params(type),
    // pose + velocity (world frame, ground plane)
    x: 0, z: 0, y: 0, psi: 0, vx: 0, vz: 0, omega: 0,
    prevX: 0, prevZ: 0, prevPsi: 0,
    // driver inputs after smoothing
    steer: 0, throttle: 0, brake: 0, hb: 0,
    // drivetrain
    gear: 1, rpm: IDLE, shiftT: 0,
    // derived each step
    u: 0, v: 0, speed: 0, slip: 0, ax: 0, ay: 0,
    // boost + drift
    boost: 0, boosting: 0, drifting: 0, driftT: 0, driftScore: 0, driftBest: 0,
    // track relationship
    s: 0, lateral: 0, idx: -1, offroad: 0, grade: 0, bank: 0, roadWidth: 16,
    // events of the last step (for sound / particles / camera)
    hit: 0, hitT: 0, bump: 0, wheelspin: 0,
  };
}

/** Puts a car on the road at arc length `s`, `lateral` metres right of the centre line, facing along the road. */
export function placeCar(car, track, s, lateral = 0, speed = 0) {
  const fr = frameAt(track, s, _fr);
  car.x = fr.x + fr.rx * lateral;
  car.z = fr.z + fr.rz * lateral;
  car.psi = fr.heading;
  car.vx = Math.cos(car.psi) * speed;
  car.vz = Math.sin(car.psi) * speed;
  car.omega = 0;
  car.steer = car.throttle = car.brake = car.hb = 0;
  car.gear = 1;
  while (car.gear < GEARS && revOf(car, car.gear, speed) > 0.93) car.gear++;
  car.rpm = IDLE;
  car.shiftT = 0;
  car.boost = 0;
  car.boosting = 0;
  car.drifting = 0;
  car.driftT = 0;
  car.idx = -1;
  car.prevX = car.x; car.prevZ = car.z; car.prevPsi = car.psi;
  syncTrack(car, track);
  return car;
}
const _fr = {};
const _cl = {};
const _cl2 = {};

function syncTrack(car, track) {
  const c = closest(track, car.x, car.z, car.idx, _cl);
  car.idx = c.idx;
  car.s = c.s;
  car.lateral = c.lateral;
  car.roadWidth = c.width;
  const fr = frameAt(track, c.s, _fr);
  car.grade = fr.grade;
  car.bank = fr.bank;
  car.y = fr.y - Math.sin(fr.bank) * c.lateral;
}

// ── engine ────────────────────────────────────────────────────────────────

/** Normalised engine torque (0.3..1) at a normalised rev position x in 0..1: peaks around 62% of the range. */
export function torque(x) {
  const t = 0.55 + 0.45 * (1 - ((x - 0.62) / 0.62) * ((x - 0.62) / 0.62));
  return clamp(t, 0.3, 1);
}
const gearTop = (car, g) => car.p.vRef * GEAR_FRAC[g - 1];
const revOf = (car, g, speed) => clamp(speed / gearTop(car, g), 0, 1.06);

/** The most the car can yaw per second right now (rad/s) — the tyres' bite, shared by the steering and the AI. */
export function maxYawRate(car, speed = Math.abs(car.u)) {
  const p = car.p;
  const kin = (speed * Math.tan(p.maxSteer)) / BODY.wheelbase;
  const grip = (p.steer * 1.05 * aLat(car, speed)) / Math.max(speed, 6);
  const hb = car.hb;
  return Math.min(kin * (1 + 0.35 * hb), grip * (1 + 1.15 * hb));
}
/** Lateral acceleration the tyres can give at this speed (m/s²), before handbrake / off-road. */
export function aLat(car, speed = Math.abs(car.u)) {
  return (car.p.aLat0 + car.p.aLatDown * speed * speed) * car.p.grip;
}

// ── one fixed step ────────────────────────────────────────────────────────

/** @typedef {{ throttle?: number, brake?: number, steer?: number, handbrake?: boolean | number, boost?: boolean }} CarInput */

/**
 * Advances one car by `dt` (use DT). `input.steer` is −1..1 (+ = right). `track` may be null (free space, no walls).
 * Returns the car.
 */
export function stepCar(car, input, track, dt = DT) {
  const p = car.p;
  car.prevX = car.x; car.prevZ = car.z; car.prevPsi = car.psi;
  car.hit = 0;
  car.bump = 0;
  car.hitT = Math.max(0, car.hitT - dt);

  // 1 — smoothed driver inputs (keyboards press 0/1; pads and the AI are analog)
  const tSteer = clamp(input.steer || 0, -1, 1);
  const rate = Math.abs(tSteer) > Math.abs(car.steer) || tSteer * car.steer < 0 ? 5.2 : 8.5;
  car.steer += clamp(tSteer - car.steer, -rate * dt, rate * dt);
  car.throttle += clamp(clamp(input.throttle || 0, 0, 1) - car.throttle, -9 * dt, 7 * dt);
  car.brake += clamp(clamp(input.brake || 0, 0, 1) - car.brake, -12 * dt, 10 * dt);
  const hbTarget = input.handbrake ? (typeof input.handbrake === 'number' ? clamp(input.handbrake, 0, 1) : 1) : 0;
  car.hb += clamp(hbTarget - car.hb, -dt / 0.24, dt / 0.09);

  // 2 — body frame velocity
  let c = Math.cos(car.psi);
  let s = Math.sin(car.psi);
  let u = car.vx * c + car.vz * s;

  // 3 — surface under the car
  let off = 0;
  if (track) {
    const half = car.roadWidth / 2;
    off = smoothstep(half + 0.2, half + 1.6, Math.abs(car.lateral));
  }
  car.offroad = off;

  // 4 — gearbox (automatic)
  const fwd = Math.max(u, 0);
  if (car.shiftT > 0) car.shiftT = Math.max(0, car.shiftT - dt);
  else {
    if (car.gear < GEARS && revOf(car, car.gear, fwd) > 0.93) { car.gear++; car.shiftT = 0.13; }
    else if (car.gear > 1 && revOf(car, car.gear, fwd) < 0.3) car.gear--;
  }
  const rev = revOf(car, car.gear, fwd);
  car.rpm = IDLE + (REDLINE - IDLE) * Math.max(rev, car.throttle * 0.05);

  // 5 — boost
  if (input.boost && !car.boosting && car.boost >= p.boostMin) car.boosting = 1;
  if (car.boosting) {
    car.boost -= p.boostDrain * dt;
    if (car.boost <= 0) { car.boost = 0; car.boosting = 0; }
    else if (!input.boost) car.boosting = 0;
  }

  // 6 — longitudinal forces (m/s², applied along the heading unless stated)
  let aLong = 0;
  const reversing = u < -0.5;
  const wantReverse = car.brake > 0.05 && car.throttle < 0.05 && u < 0.8;
  if (car.throttle > 0.02 && !reversing) {
    const cut = car.shiftT > 0 ? 0.12 : 1;
    aLong = car.throttle * torque(rev) * GEAR_ACC[car.gear - 1] * p.accel * cut;
    aLong = Math.min(aLong, p.tractionLong * (1 - 0.4 * off));
  } else if (wantReverse) {
    if (u > -p.reverseMax) aLong = -p.reverseAcc * car.brake;
  }
  if (car.boosting) aLong += p.boostAcc;
  const gradeA = -G * car.grade * 0.5;

  // brakes oppose the velocity vector (so they also scrub a slide); the throttle brakes a reversing car
  let aBrake = 0;
  if (u > 0.5) aBrake = car.brake * p.brake;
  else if (reversing) aBrake = car.throttle * p.brake;
  aBrake += car.hb * 3.2;

  // 7 — apply forces to the world velocity
  let vx = car.vx;
  let vz = car.vz;
  const sp = Math.hypot(vx, vz);
  vx += (c * (aLong + gradeA)) * dt;
  vz += (s * (aLong + gradeA)) * dt;
  if (sp > 1e-4) {
    const ux = vx / (Math.hypot(vx, vz) || 1);
    const uz = vz / (Math.hypot(vx, vz) || 1);
    const cd = p.cd * (car.boosting ? 0.62 : 1);
    const drag = cd * sp * sp + p.rolling + off * (4 + 0.0035 * sp * sp) + aBrake;
    const dv = Math.min(drag * dt, Math.hypot(vx, vz));
    vx -= ux * dv;
    vz -= uz * dv;
  }

  // 8 — steering. Gripping: the yaw rate follows the steering input (limited by what the tyres give). Sliding (handbrake or a big
  // slip angle): the steering picks the slip angle instead — the nose is held `steer × DRIFT_ANGLE` away from the direction of
  // travel, so a drift is held with the steering and ends by letting go (the car straightens up by itself).
  const spdAbs = Math.abs(u);
  const omegaMax = maxYawRate(car, spdAbs) * (1 - 0.25 * off);
  const dir = u >= -0.2 ? 1 : -1;
  const omegaGrip = car.steer * omegaMax * dir * smoothstep(0.3, 2.5, spdAbs);
  const slideW = clamp(Math.max(car.hb, smoothstep(0.22, 0.5, Math.abs(car.slip))), 0, 1) * smoothstep(6, 14, spdAbs) * (u > 0 ? 1 : 0);
  let omegaTarget = omegaGrip;
  if (slideW > 0) {
    const course = Math.atan2(vz, vx);
    let e = course + car.steer * DRIFT_ANGLE - car.psi;
    e = Math.atan2(Math.sin(e), Math.cos(e));
    const lim = Math.max(omegaMax * (1 + 1.15 * car.hb), 1.7);
    const omegaSlide = clamp(e * 7, -lim, lim);
    omegaTarget = omegaGrip + (omegaSlide - omegaGrip) * slideW;
  }
  car.omega += (omegaTarget - car.omega) * (1 - Math.exp(-dt * 11));
  car.psi += car.omega * dt;
  if (car.psi > Math.PI) car.psi -= 2 * Math.PI;
  else if (car.psi < -Math.PI) car.psi += 2 * Math.PI;

  // 9 — lateral grip in the NEW body frame: the tyres pull the sideways velocity back, at most `aLat × grip` per second
  c = Math.cos(car.psi);
  s = Math.sin(car.psi);
  u = vx * c + vz * s;
  let v = -vx * s + vz * c;
  const grip = aLat(car, Math.abs(u)) * (1 - 0.62 * car.hb) * (1 - 0.35 * off);
  const v0 = Math.hypot(u, v);
  const kill = Math.min(Math.abs(v), grip * dt);
  const v1 = v > 0 ? v - kill : v + kill;
  if (kill > 0) {
    // part of the killed sideways speed is redirected forward instead of being scrubbed
    const mag1 = Math.hypot(u, v1);
    const target = mag1 + p.redirect * (v0 - mag1);
    const uNew = Math.sqrt(Math.max(0, target * target - v1 * v1));
    u = u >= 0 ? uNew : -uNew;
  }
  v = v1;
  car.wheelspin = kill > 0 && Math.abs(v) > 0.5 ? 1 : 0;
  vx = u * c - v * s;
  vz = u * s + v * c;

  // 10 — slip angle, drift and boost charge
  const spd = Math.hypot(u, v);
  const beta = spd > 3 ? Math.atan2(v, Math.abs(u)) * (u >= 0 ? 1 : -1) : 0;
  car.slip = beta;
  const drifting = spd > 10 && Math.abs(beta) > 0.2 && u > 0 ? 1 : 0;
  if (drifting) {
    car.driftT += dt;
    car.driftScore += spd * Math.abs(beta) * dt * 3.2;
    car.boost = Math.min(100, car.boost + p.driftCharge * clamp((Math.abs(beta) - 0.12) / 0.35, 0, 1) * clamp(spd / 45, 0, 1) * dt);
  } else if (car.drifting) {
    car.driftBest = Math.max(car.driftBest, car.driftT);
  }
  if (!drifting) car.driftT = Math.max(0, car.driftT - dt * 2);
  car.drifting = drifting;

  // 11 — integrate
  car.vx = vx;
  car.vz = vz;
  car.x += vx * dt;
  car.z += vz * dt;
  car.u = u;
  car.v = v;
  car.speed = spd;
  car.ax += (aLong + gradeA - aBrake * Math.sign(u) - car.ax) * Math.min(1, dt * 8);
  car.ay += (-(u * car.omega) - car.ay) * Math.min(1, dt * 8);

  // 12 — road: progress, walls
  if (track) {
    syncTrack(car, track);
    if (collideWalls(car, track)) syncTrack(car, track);
  }
  return car;
}

// ── walls ──────────────────────────────────────────────────────────────────

/** Keeps the car inside the walls at the edge of the run-off strip; slides along them and scrubs speed. */
export function collideWalls(car, track) {
  // the two body circles (front/rear axle) must stay inside; the deepest one wins this step
  const c = Math.cos(car.psi);
  const s = Math.sin(car.psi);
  let worst = 0;
  let wnx = 0;
  let wnz = 0;
  let wtx = 0;
  let wtz = 0;
  for (let k = -1; k <= 1; k += 2) {
    const px = car.x + c * BODY.circleOffset * k;
    const pz = car.z + s * BODY.circleOffset * k;
    const cl = closest(track, px, pz, car.idx, _cl2);
    const limit = cl.width / 2 + WALL_MARGIN - BODY.circleR;
    const pen = Math.abs(cl.lateral) - limit;
    if (pen > worst) {
      worst = pen;
      const sgn = cl.lateral > 0 ? 1 : -1;
      wnx = cl.tz * sgn; // inward normal = −sign × right, right = (−tz, tx)
      wnz = -cl.tx * sgn;
      wtx = cl.tx;
      wtz = cl.tz;
    }
  }
  if (worst <= 0) return false;
  car.x += wnx * worst;
  car.z += wnz * worst;
  // velocity: remove (and bounce a little of) the part that goes into the wall, scrub the rest
  const vn = car.vx * wnx + car.vz * wnz;
  const vt = car.vx * wtx + car.vz * wtz;
  let tang = vt;
  let norm = vn;
  const impact = Math.max(0, -vn);
  if (vn < 0) norm = -vn * 0.12;
  const scrub = Math.min(0.5, 0.05 + 0.011 * impact);
  tang *= 1 - scrub;
  tang -= Math.sign(tang) * Math.min(Math.abs(tang), 3.5 * DT); // keeps riding the wall costly
  car.vx = wtx * tang + wnx * norm;
  car.vz = wtz * tang + wnz * norm;
  // glance off: turn the nose towards the wall's direction of travel
  const wallAng = Math.atan2(wtz * Math.sign(tang || 1), wtx * Math.sign(tang || 1));
  let d = wallAng - car.psi;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  car.psi += d * Math.min(0.18, 0.012 * impact + 0.004);
  car.omega *= 0.85;
  car.hit = impact;
  if (impact > 1.5) car.hitT = 0.35;
  car.driftT = 0;
  return true;
}

// ── car vs car ─────────────────────────────────────────────────────────────

/** Pushes two overlapping cars apart and exchanges momentum along the contact normal. Returns the closing speed (0 = no contact). */
export function collideCars(a, b) {
  const R2 = 2 * BODY.circleR;
  const ac = Math.cos(a.psi);
  const as = Math.sin(a.psi);
  const bc = Math.cos(b.psi);
  const bs = Math.sin(b.psi);
  let best = 0;
  let nx = 0;
  let nz = 0;
  for (let i = -1; i <= 1; i += 2) {
    const ax = a.x + ac * BODY.circleOffset * i;
    const az = a.z + as * BODY.circleOffset * i;
    for (let j = -1; j <= 1; j += 2) {
      const bx = b.x + bc * BODY.circleOffset * j;
      const bz = b.z + bs * BODY.circleOffset * j;
      const dx = ax - bx;
      const dz = az - bz;
      const d2 = dx * dx + dz * dz;
      if (d2 < R2 * R2) {
        const d = Math.sqrt(d2) || 1e-6;
        const pen = R2 - d;
        if (pen > best) { best = pen; nx = dx / d; nz = dz / d; }
      }
    }
  }
  if (best <= 0) return 0;
  const ma = a.p.mass;
  const mb = b.p.mass;
  const wa = mb / (ma + mb);
  const wb = ma / (ma + mb);
  a.x += nx * best * wa;
  a.z += nz * best * wa;
  b.x -= nx * best * wb;
  b.z -= nz * best * wb;
  const rvn = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
  if (rvn < 0) {
    const e = 0.3;
    const j = (-(1 + e) * rvn) / (1 / ma + 1 / mb);
    a.vx += (j / ma) * nx; a.vz += (j / ma) * nz;
    b.vx -= (j / mb) * nx; b.vz -= (j / mb) * nz;
    a.bump = b.bump = -rvn;
    // a little spin from the glancing blow
    a.omega += clamp((nx * as - nz * ac) * -rvn * 0.02, -0.6, 0.6);
    b.omega -= clamp((nx * bs - nz * bc) * -rvn * 0.02, -0.6, 0.6);
    return -rvn;
  }
  return 0;
}

// ── simulation: fixed-step accumulator over many cars ──────────────────────

/**
 * A deterministic simulation of several cars on a track. `update(frameDt, inputs)` runs as many fixed steps as fit (at most
 * `maxSteps` per call), `alpha` is the render interpolation factor afterwards.
 */
export function createSim({ track, seed = 1, cars = [] }) {
  const sim = {
    track,
    seed,
    rng: mulberry32(seed),
    cars,
    time: 0,
    tick: 0,
    accum: 0,
    alpha: 0,
    maxSteps: 8,
    /** One fixed step with `inputs[i]` for car i. */
    step(inputs) {
      for (let i = 0; i < cars.length; i++) stepCar(cars[i], inputs[i] || NO_INPUT, track, DT);
      for (let i = 0; i < cars.length; i++) {
        for (let j = i + 1; j < cars.length; j++) {
          if (Math.abs(cars[i].s - cars[j].s) < 12 || Math.abs(Math.abs(cars[i].s - cars[j].s) - track.length) < 12) collideCars(cars[i], cars[j]);
        }
      }
      sim.tick++;
      sim.time = sim.tick * DT;
    },
    /** Feeds real frame time; returns the number of fixed steps executed. */
    update(frameDt, inputs) {
      sim.accum += Math.min(frameDt, 0.25);
      let n = 0;
      while (sim.accum >= DT - 1e-9 && n < sim.maxSteps) {
        sim.step(inputs);
        sim.accum -= DT;
        n++;
      }
      if (n === sim.maxSteps && sim.accum >= DT) sim.accum = 0; // spiral of death: drop the backlog
      sim.alpha = clamp(sim.accum / DT, 0, 1);
      return n;
    },
  };
  return sim;
}
const NO_INPUT = Object.freeze({});

/** Fingerprint of every car's dynamic state (determinism / timestep-independence tests). */
export function stateHash(sim) {
  let h = hashNumbers([sim.tick]);
  for (const c of sim.cars) {
    h = hashNumbers([c.x, c.z, c.psi, c.vx, c.vz, c.omega, c.steer, c.throttle, c.brake, c.hb, c.gear, c.rpm, c.boost, c.boosting, c.driftScore, c.s, c.lateral], h);
  }
  return h;
}

