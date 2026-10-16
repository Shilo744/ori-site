// NEON DRIFT pure logic: track generator + driving physics + autopilot (no browser, no three).  npm run test:drift
import assert from 'node:assert/strict';
import { generateTrack, validateTrack, trackHash, frameAt, closest, surfacePoint, surfaceNormal, deltaS, wrapS, LIMITS, WALL_MARGIN, DS } from '../src/game3d/track.js';
import { createCar, placeCar, stepCar, createSim, stateHash, collideCars, maxYawRate, aLat, DT, BODY } from '../src/game3d/physics.js';
import { createDriver } from '../src/game3d/autodrive.js';
import { mulberry32 } from '../src/game3d/rng.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const TRACKS = new Map();
const trackFor = (seed) => { if (!TRACKS.has(seed)) TRACKS.set(seed, generateTrack(seed)); return TRACKS.get(seed); };
const run = (car, input, seconds, track = null, each = null) => {
  for (let i = 0, k = Math.round(seconds / DT); i < k; i++) { stepCar(car, typeof input === 'function' ? input(i * DT, car) : input, track); if (each) each(car, i * DT); }
  return car;
};

// ── track ──────────────────────────────────────────────────────────────────
console.log('track');
test('generation is deterministic and different seeds give different tracks', () => {
  assert.equal(trackHash(generateTrack(7)), trackHash(generateTrack(7)));
  assert.notEqual(trackHash(generateTrack(7)), trackHash(generateTrack(8)));
});
test('200 seeds all produce a valid track (no fallback needed)', () => {
  let worst = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const t = generateTrack(seed);
    const v = validateTrack(t);
    assert.ok(v.ok, `seed ${seed}: ${v.errors.join('; ')}`);
    assert.equal(t.fallback, false, `seed ${seed} fell back`);
    worst = Math.max(worst, t.attempts);
  }
  console.log(`    (worst case needed ${worst} candidates)`);
});
test('length 2.5–4.5 km, radius, grade, width and bank stay inside the limits for every seed', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const { stats, length } = trackFor(seed);
    assert.ok(length >= LIMITS.minLength && length <= LIMITS.maxLength, `length ${length}`);
    assert.ok(stats.minRadius >= LIMITS.minRadius, `radius ${stats.minRadius}`);
    assert.ok(stats.maxGrade <= LIMITS.maxGrade, `grade ${stats.maxGrade}`);
    assert.ok(stats.minWidth >= 12 && stats.maxWidth <= 24, `width ${stats.minWidth}-${stats.maxWidth}`);
    assert.ok(stats.maxBank <= LIMITS.maxBank + 1e-9, `bank ${stats.maxBank}`);
  }
});
test('every track has a long straight and at least two hairpins', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const { stats } = trackFor(seed);
    assert.ok(stats.longestStraight >= LIMITS.minStraight, `seed ${seed}: straight ${stats.longestStraight}`);
    assert.ok(stats.hairpins >= 2, `seed ${seed}: hairpins ${stats.hairpins}`);
  }
});
test('arc length is uniform and the loop is closed with a continuous tangent', () => {
  for (const seed of [3, 11, 42]) {
    const t = trackFor(seed);
    for (let i = 0; i < t.n; i++) {
      const j = (i + 1) % t.n;
      const d = Math.hypot(t.x[j] - t.x[i], t.z[j] - t.z[i]);
      assert.ok(Math.abs(d - t.ds) < t.ds * 0.12, `seed ${seed} step ${i}: ${d}`);
    }
    assert.ok(Math.abs(t.length - t.n * t.ds) < 1e-6);
    const turn = Math.abs(t.stats.totalTurn);
    assert.ok(Math.abs(turn - 2 * Math.PI) < 0.05, `turn ${turn}`);
  }
});
test('frameAt: positions advance by the distance asked, wrap around the lap, and the right vector is perpendicular', () => {
  const t = trackFor(5);
  const a = frameAt(t, 100.3, {});
  const b = frameAt(t, 100.3 + 0.5, {});
  assert.ok(Math.abs(Math.hypot(b.x - a.x, b.z - a.z) - 0.5) < 0.02);
  const w = frameAt(t, -3, {});
  const w2 = frameAt(t, t.length - 3, {});
  assert.ok(Math.abs(w.x - w2.x) < 1e-9 && Math.abs(w.z - w2.z) < 1e-9);
  assert.ok(Math.abs(a.tx * a.rx + a.tz * a.rz) < 1e-9);
  assert.ok(Math.abs(Math.hypot(a.tx, a.tz) - 1) < 1e-9);
});
test('closest: a point on the centre line maps back to its s with lateral 0', () => {
  const t = trackFor(9);
  const out = {};
  for (let s = 5; s < t.length; s += 97.3) {
    const f = frameAt(t, s, {});
    closest(t, f.x, f.z, -1, out);
    assert.ok(Math.abs(deltaS(t, s, out.s)) < 0.2, `s ${s} -> ${out.s}`);
    assert.ok(Math.abs(out.lateral) < 0.1);
  }
});
test('closest: lateral offsets come back signed (right is positive) and heading matches the tangent', () => {
  const t = trackFor(9);
  const out = {};
  for (const lat of [-7, -2.5, 3, 8]) {
    for (let s = 20; s < t.length; s += 211.7) {
      const p = surfacePoint(t, s, lat, {});
      const f = frameAt(t, s, {});
      closest(t, f.x + f.rx * lat, f.z + f.rz * lat, -1, out);
      assert.ok(Math.abs(out.lateral - lat) < 0.15, `lat ${lat}: got ${out.lateral}`);
      assert.ok(Math.abs(deltaS(t, s, out.s)) < 0.5);
      let dh = out.heading - f.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      assert.ok(Math.abs(dh) < 0.02);
      assert.ok(p.y !== undefined);
    }
  }
});
test('closest with a hint equals the global search', () => {
  const t = trackFor(4);
  const rnd = mulberry32(5);
  const a = {};
  const b = {};
  for (let i = 0; i < 400; i++) {
    const s = rnd() * t.length;
    const f = frameAt(t, s, {});
    const lat = (rnd() - 0.5) * 20;
    const x = f.x + f.rx * lat;
    const z = f.z + f.rz * lat;
    closest(t, x, z, -1, a);
    closest(t, x, z, Math.floor(s / t.ds) + Math.floor((rnd() - 0.5) * 20), b);
    assert.ok(Math.abs(a.s - b.s) < 1e-6 && Math.abs(a.lateral - b.lateral) < 1e-6);
  }
});
test('arc length s grows monotonically when walking the centre line', () => {
  const t = trackFor(2);
  const out = {};
  let prev = 0;
  let idx = -1;
  for (let s = 0; s < t.length - 1; s += 3.1) {
    const f = frameAt(t, s, {});
    closest(t, f.x, f.z, idx, out);
    idx = out.idx;
    assert.ok(out.s >= prev - 0.05, `non-monotone at ${s}`);
    prev = out.s;
  }
});
test('the start straight is flat and straight, and the surface normal points up', () => {
  const t = trackFor(6);
  for (let s = -80; s <= 120; s += 20) {
    const f = frameAt(t, s, {});
    assert.ok(Math.abs(f.kappa) < 0.002, `kappa ${f.kappa}`);
    const nrm = surfaceNormal(f, {});
    assert.ok(nrm.ny > 0.95);
    assert.ok(Math.abs(Math.hypot(nrm.nx, nrm.ny, nrm.nz) - 1) < 1e-9);
  }
});
test('banking leans into the corners: right turns lower the right edge', () => {
  const t = trackFor(1);
  let checked = 0;
  for (let i = 0; i < t.n; i += 5) {
    if (Math.abs(t.kappaS[i]) > 0.01) {
      assert.ok(Math.sign(t.bank[i]) === Math.sign(t.kappaS[i]));
      checked++;
    }
  }
  assert.ok(checked > 20);
  assert.ok(DS === 2 && WALL_MARGIN > 0 && wrapS(t, -1) > t.length - 2);
});

// ── physics ────────────────────────────────────────────────────────────────
console.log('physics');
test('full throttle accelerates to the top speed (≈ 280 km/h), 0–100 km/h in 2.2–4.5 s', () => {
  const car = createCar('gt');
  let t100 = 0;
  run(car, { throttle: 1 }, 40, null, (c, t) => { if (!t100 && c.speed >= 27.78) t100 = t; });
  assert.ok(t100 > 2.2 && t100 < 4.5, `0-100 in ${t100}`);
  assert.ok(car.speed > 74 && car.speed < 90, `top speed ${car.speed}`);
  assert.equal(car.gear, 6);
});
test('gears only go up while accelerating, revs stay between idle and redline', () => {
  const car = createCar('gt');
  let last = 1;
  run(car, { throttle: 1 }, 25, null, (c) => {
    assert.ok(c.gear >= last, 'downshift while accelerating');
    last = c.gear;
    assert.ok(c.rpm >= 999 && c.rpm <= 8500, `rpm ${c.rpm}`);
  });
  assert.ok(last >= 5);
});
test('braking from 60 m/s stops in under 130 m with ≥ 1.4 g', () => {
  const car = createCar('gt');
  car.vx = 60;
  car.gear = 5;
  let dist = 0;
  let time = 0;
  while (car.speed > 0.5 && time < 12) { stepCar(car, { brake: 1 }, null); dist += car.speed * DT; time += DT; }
  assert.ok(dist < 130, `${dist} m`);
  assert.ok(60 / time >= 13.7, `decel ${60 / time}`);
});
test('holding the brake from a standstill reverses, up to a cap; throttle then brakes a reversing car', () => {
  const car = createCar('gt');
  run(car, { brake: 1 }, 4);
  assert.ok(car.u < -3, `u ${car.u}`);
  run(car, { brake: 1 }, 8);
  assert.ok(car.u >= -car.p.reverseMax - 0.5);
  run(car, { throttle: 1 }, 4);
  assert.ok(car.u > -1, `u ${car.u}`);
});
test('the car does not turn while standing still', () => {
  const car = createCar('gt');
  run(car, { steer: 1 }, 2);
  assert.ok(Math.abs(car.psi) < 1e-6);
});
test('steering radius at full lock grows with speed', () => {
  const radius = (speed) => {
    const car = createCar('gt');
    car.vx = speed;
    car.gear = 6;
    while (car.gear > 1 && speed / (car.p.vRef * [0.2, 0.3, 0.43, 0.58, 0.77, 1][car.gear - 1]) < 0.3) car.gear--;
    run(car, (t, c) => ({ throttle: Math.min(1, Math.max(0, (speed - c.speed) * 0.5 + 0.25)), steer: 1 }), 1.5);
    return car.speed / Math.abs(car.omega);
  };
  const r = [10, 20, 35, 55, 75].map(radius);
  for (let i = 1; i < r.length; i++) assert.ok(r[i] > r[i - 1], `radius ${r.map((x) => x.toFixed(0))}`);
  assert.ok(r[0] < 25 && r[4] > 150, `radius ${r.map((x) => x.toFixed(0))}`);
});
test('cornering stays within 12% of the grip limit', () => {
  for (const speed of [20, 35, 50, 70]) {
    const car = createCar('gt');
    car.vx = speed;
    car.gear = 4;
    let worst = 0;
    let prev = 0;
    // centripetal acceleration = speed × how fast the direction of travel turns
    run(car, (t, c) => ({ throttle: c.speed < speed ? 1 : 0.35, steer: 1 }), 4, null, (c, t) => {
      const course = Math.atan2(c.vz, c.vx);
      const dc = Math.atan2(Math.sin(course - prev), Math.cos(course - prev));
      prev = course;
      if (t > 1) worst = Math.max(worst, (c.speed * Math.abs(dc)) / DT);
    });
    assert.ok(worst <= aLat(car, speed) * 1.12, `speed ${speed}: ${worst} vs ${aLat(car, speed)}`);
  }
});
test('the handbrake with steering throws the car sideways (slip angle ≥ 20°) and flags a drift', () => {
  const car = createCar('gt');
  car.vx = 45;
  car.gear = 4;
  let best = 0;
  let flagged = false;
  run(car, (t) => ({ throttle: 1, steer: t > 0.3 ? 1 : 0, handbrake: t > 0.5 && t < 1.3 }), 4, null, (c) => { best = Math.max(best, Math.abs(c.slip)); if (c.drifting) flagged = true; });
  assert.ok(best > 0.35, `slip ${best}`);
  assert.ok(flagged);
});
test('drifting charges the boost meter; driving straight or in the grip limit does not', () => {
  const drift = createCar('gt');
  drift.vx = 45;
  drift.gear = 4;
  run(drift, (t) => ({ throttle: 1, steer: t > 0.3 ? 1 : 0, handbrake: t > 0.5 && t < 1.3 }), 4);
  assert.ok(drift.boost > 15, `boost ${drift.boost}`);
  const straight = createCar('gt');
  straight.vx = 45;
  straight.gear = 4;
  run(straight, { throttle: 1 }, 4);
  assert.equal(straight.boost, 0);
  const easy = createCar('gt');
  easy.vx = 30;
  easy.gear = 3;
  run(easy, { throttle: 0.6, steer: 0.3 }, 4);
  assert.equal(easy.boost, 0);
  assert.ok(drift.boost <= 100);
});
test('letting go of the steering straightens a drift by itself', () => {
  const car = createCar('gt');
  car.vx = 45;
  car.gear = 4;
  run(car, (t) => ({ throttle: 1, steer: t > 0.3 && t < 3 ? 1 : 0, handbrake: t > 0.5 && t < 1.3 }), 6);
  assert.ok(Math.abs(car.slip) < 0.08, `slip ${car.slip}`);
  assert.ok(car.speed > 35, `speed ${car.speed}`);
});
test('boost: needs charge, adds speed beyond the normal top speed, burns the meter down', () => {
  const dry = createCar('gt');
  run(dry, { throttle: 1, boost: true }, 10);
  assert.equal(dry.boosting, 0);
  const car = createCar('gt');
  run(car, { throttle: 1 }, 30);
  const top = car.speed;
  car.boost = 100;
  let peak = 0;
  run(car, { throttle: 1, boost: true }, 3, null, (c) => { peak = Math.max(peak, c.speed); });
  assert.ok(peak > top + 8, `boost peak ${peak} vs ${top}`);
  assert.ok(car.boost < 100 - 38 * 2.5);
  run(car, { throttle: 1, boost: true }, 5);
  assert.equal(car.boosting, 0);
  assert.equal(car.boost, 0);
});
test('going off the road slows the car down hard', () => {
  const t = trackFor(6);
  const f = frameAt(t, 30, {});
  const verge = createCar('gt');
  placeCar(verge, t, 30, f.width / 2 + 3, 50); // in the middle of the run-off strip
  let sawOff = false;
  run(verge, { throttle: 0 }, 0.8, t, (c) => { if (c.offroad > 0.9) sawOff = true; });
  const road = createCar('gt');
  placeCar(road, t, 30, 0, 50);
  run(road, { throttle: 0 }, 0.8, t);
  assert.ok(sawOff, 'never left the road');
  assert.ok(verge.speed < road.speed - 8, `${verge.speed} vs ${road.speed}`);
});
test('walls: ramming a wall head-on at full speed keeps the car inside and costs most of the speed', () => {
  const t = trackFor(6);
  const car = createCar('gt');
  placeCar(car, t, 60, 0, 70);
  const f = frameAt(t, 60, {});
  car.psi = f.heading + 0.5;
  car.vx = Math.cos(car.psi) * 70;
  car.vz = Math.sin(car.psi) * 70;
  let hit = 0;
  run(car, { throttle: 1 }, 3, t, (c) => {
    hit = Math.max(hit, c.hit);
    assert.ok(Math.abs(c.lateral) <= c.roadWidth / 2 + WALL_MARGIN + 0.05, `lateral ${c.lateral}`);
  });
  assert.ok(hit > 8, `impact ${hit}`);
});
test('walls: 60 s of seeded random driving on 6 tracks never leaves the walls and never produces NaN', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const t = trackFor(seed);
    const rnd = mulberry32(seed * 77);
    const car = createCar('gt');
    placeCar(car, t, 0, 0, 0);
    let steer = 0;
    let throttle = 1;
    let hb = false;
    let boostOn = false;
    for (let i = 0; i < 120 * 60; i++) {
      if (i % 30 === 0) { steer = rnd() * 2 - 1; throttle = rnd() < 0.8 ? 1 : 0; hb = rnd() < 0.2; boostOn = rnd() < 0.2; }
      stepCar(car, { steer, throttle, brake: rnd() < 0.05 ? 1 : 0, handbrake: hb, boost: boostOn }, t);
      assert.ok(Number.isFinite(car.x) && Number.isFinite(car.z) && Number.isFinite(car.psi) && Number.isFinite(car.speed), `NaN at ${i}`);
      assert.ok(Math.abs(car.lateral) <= car.roadWidth / 2 + WALL_MARGIN + 0.08, `seed ${seed} tick ${i}: lateral ${car.lateral}`);
      assert.ok(car.speed < 140);
    }
  }
});
test('determinism: the same inputs give the same state hash, different inputs a different one', () => {
  const t = trackFor(3);
  const play = (steerGain) => {
    const sim = createSim({ track: t, seed: 9, cars: [createCar('gt')] });
    placeCar(sim.cars[0], t, 0, 0, 0);
    for (let i = 0; i < 120 * 12; i++) sim.step([{ throttle: 1, steer: Math.sin(i * 0.02) * steerGain, handbrake: i % 400 > 350, boost: i > 900 }]);
    return stateHash(sim);
  };
  assert.equal(play(0.6), play(0.6));
  assert.notEqual(play(0.6), play(0.61));
});
test('timestep independence: any frame rate runs the same fixed steps and ends in the same state', () => {
  const t = trackFor(3);
  const inputs = [{ throttle: 1, steer: 0.2, boost: false }];
  const playAt = (frameDt) => {
    const sim = createSim({ track: t, seed: 1, cars: [createCar('gt')] });
    placeCar(sim.cars[0], t, 0, 0, 0);
    let elapsed = 0;
    const total = 8.0042;
    while (elapsed < total) {
      const d = Math.min(frameDt, total - elapsed);
      sim.update(d, inputs);
      elapsed += d;
    }
    return { hash: stateHash(sim), tick: sim.tick };
  };
  const ref = playAt(1 / 120);
  for (const fps of [30, 60, 75, 144, 240]) {
    const r = playAt(1 / fps);
    assert.equal(r.tick, ref.tick, `${fps} fps ran ${r.tick} steps vs ${ref.tick}`);
    assert.equal(r.hash, ref.hash, `${fps} fps diverged`);
  }
});
test('a long frame (tab was hidden) cannot run away: the backlog is dropped', () => {
  const sim = createSim({ track: null, cars: [createCar('gt')] });
  const steps = sim.update(5, [{ throttle: 1 }]);
  assert.ok(steps <= sim.maxSteps);
  assert.ok(sim.accum < 0.26);
});
test('car vs car: overlapping cars are pushed apart and momentum is conserved', () => {
  const a = createCar('gt');
  const b = createCar('gt');
  a.x = 0; a.vx = 30;
  b.x = 3.2; b.vx = 10;
  const before = a.vx * a.p.mass + b.vx * b.p.mass;
  const closing = collideCars(a, b);
  assert.ok(closing > 5, `closing ${closing}`);
  const after = a.vx * a.p.mass + b.vx * b.p.mass;
  assert.ok(Math.abs(after - before) < 1e-6);
  assert.ok(b.vx > 10 && a.vx < 30);
  for (let i = 0; i < 5 && collideCars(a, b); i++) { /* settle */ }
  const gap = Math.hypot(a.x - b.x, a.z - b.z);
  assert.ok(gap >= 2 * BODY.circleR * 0.98 || Math.abs(a.x - b.x) > 2.9, `gap ${gap}`);
  const far = createCar('gt');
  far.x = 50;
  assert.equal(collideCars(a, far), 0);
});
test('every car type reaches a sensible top speed and handles the same checks', () => {
  for (const type of ['hatch', 'gt', 'hyper']) {
    const car = createCar(type);
    run(car, { throttle: 1 }, 45);
    assert.ok(car.speed > 65 && car.speed < 100, `${type}: ${car.speed}`);
    assert.ok(maxYawRate(car, 40) > 0.2 && maxYawRate(car, 40) < 1.2);
  }
});

// ── autopilot ──────────────────────────────────────────────────────────────
console.log('autopilot');
test('the autopilot laps six different tracks without touching a wall, with sane lap times', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const t = trackFor(seed);
    const car = createCar('gt');
    placeCar(car, t, 0, 0, 0);
    const drive = createDriver(t, car);
    const inp = {};
    let laps = 0;
    let last = car.s;
    let lapStart = 0;
    let hits = 0;
    const times = [];
    for (let i = 0; i < 120 * 220 && laps < 2; i++) {
      drive(car, inp);
      stepCar(car, inp, t);
      if (car.hit > 1) hits++;
      if (car.s - last < -t.length / 2) { laps++; times.push(i * DT - lapStart); lapStart = i * DT; }
      last = car.s;
    }
    assert.equal(laps, 2, `seed ${seed}: only ${laps} laps`);
    assert.equal(hits, 0, `seed ${seed}: ${hits} wall hits`);
    for (const lt of times) {
      const avg = t.length / lt;
      assert.ok(avg > 28 && avg < 75, `seed ${seed}: average speed ${avg.toFixed(1)} m/s`);
    }
    assert.ok(Math.abs(times[1] - times[0]) < 6, `seed ${seed}: laps ${times}`);
  }
});

console.log(`${n} drift tests passed`);
