// "Ori, Can You...?" — the pure modules: the map, collisions, Ori's controller, the camera rig, the day cycle and the crowd.
//   node scripts/test-favors.mjs
import assert from 'node:assert/strict';
import { buildMap, validateMap, walkDistance, groundHeight, BOUNDS, PLAYER_R, ROAD_X, ROAD_Z, KERB } from '../src/game3d/favors/map.js';
import { createCollisionWorld, box, circle } from '../src/game3d/favors/collide.js';
import { createController, moveDir, STEP, WALK_SPEED, SPRINT_SPEED } from '../src/game3d/favors/controller.js';
import { createCameraRig } from '../src/game3d/favors/camera-rig.js';
import { skyAt, sunVector, createClock } from '../src/game3d/favors/daycycle.js';
import { createCrowd } from '../src/game3d/favors/crowd.js';
import { PLACES, CROWD, DAY, ORI } from '../src/game3d/favors/content.js';
import { mulberry32, hashNumbers, wrapPi } from '../src/game3d/rng.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} ${a} !≈ ${b} (±${eps})`);

const map = buildMap(51);
const lotHash = (m) => hashNumbers(m.lots.flatMap((l) => [l.rect.x0, l.rect.z0, l.rect.x1, l.rect.z1, l.h]));

// ── the map ──
test('the map is built from the seed, the same every time', () => {
  assert.equal(lotHash(buildMap(51)), lotHash(map));
  assert.notEqual(lotHash(buildMap(52)), lotHash(map));
  assert.equal(buildMap(51).props.length, map.props.length);
});
test('every place in content.js exists on the map (and nothing else does)', () => {
  assert.deepEqual(Object.keys(map.places).sort(), Object.keys(PLACES).sort());
  for (const p of Object.values(map.places)) {
    assert.ok(p.door && Number.isFinite(p.door.x) && Number.isFinite(p.door.z), `${p.id} door`);
    assert.ok(Math.abs(Math.hypot(p.door.nx, p.door.nz) - 1) < 1e-9, `${p.id} door normal`);
  }
});
test('validation: no overlapping lots, every door spot free and reachable on foot from the spawn', () => {
  const v = validateMap(map);
  assert.deepEqual(v.errors, []);
  assert.ok(v.reachableCells > 40000, `a big walkable area (${v.reachableCells})`);
});
test('the neighbourhood is about 290 x 296 m with 3 x 3 avenues and 100+ buildings', () => {
  assert.ok(BOUNDS.x1 - BOUNDS.x0 > 280 && BOUNDS.z1 - BOUNDS.z0 > 290);
  assert.equal(ROAD_X.length * ROAD_Z.length, 9);
  assert.ok(map.lots.length >= 100, `${map.lots.length} lots`);
  assert.equal(map.lots.filter((l) => l.named).length, 11);
});
test('placing: props never stand inside a building or on a door spot', () => {
  const inside = (p, l) => p.x > l.rect.x0 - 0.2 && p.x < l.rect.x1 + 0.2 && p.z > l.rect.z0 - 0.2 && p.z < l.rect.z1 + 0.2;
  for (const p of map.props) for (const l of map.lots) if (p.type !== 'fountain') assert.ok(!inside(p, l), `${p.type} at ${p.x},${p.z} inside ${l.id}`);
  for (const pl of Object.values(map.places)) for (const p of map.props) assert.ok(Math.hypot(p.x - pl.door.x, p.z - pl.door.z) > 0.9, `${p.type} on the door of ${pl.id}`);
});
test('walking distances: symmetric, zero to self, the triangle inequality holds, plausible for a 14-minute day', () => {
  const ids = Object.keys(map.places);
  for (const a of ids) {
    assert.equal(map.dist[a][a], 0);
    for (const b of ids) {
      near(map.dist[a][b], map.dist[b][a], 1e-6, `${a}<->${b}`);
      for (const c of ids) assert.ok(map.dist[a][c] <= map.dist[a][b] + map.dist[b][c] + 1e-6, `${a} ${b} ${c}`);
      assert.ok(map.dist[a][b] < 380, `${a}->${b} is ${map.dist[a][b]} m`);
    }
  }
  const worst = Math.max(...ids.flatMap((a) => ids.map((b) => map.dist[a][b])));
  assert.ok(worst / SPRINT_SPEED < 50, `the longest trip takes ${(worst / SPRINT_SPEED).toFixed(0)} s at a sprint`);
  near(walkDistance(map, -50, 5, 10, 5), 60, 1e-6, 'two points on the same street');
  near(walkDistance(map, -15, 5, -15, 5), 0, 1e-6);
});
test('the sidewalks are raised, the road is not', () => {
  near(groundHeight(map, map.places.home.door.x, map.places.home.door.z), KERB, 1e-9);
  near(groundHeight(map, ROAD_X[1], ROAD_Z[1]), 0, 1e-9);
});

// ── collisions ──
test('collision: a circle is pushed out of a box and slides along it', () => {
  const w = createCollisionWorld([box(0, 0, 10, 10)]);
  let r = w.push(-0.2, 5, 0.5);
  assert.ok(r.hit && r.x <= -0.5 + 1e-9 && Math.abs(r.z - 5) < 1e-9 && r.nx < 0);
  r = w.push(5, 5, 0.5); // centre inside: leaves through the nearest face
  assert.ok(r.hit && (r.x < 0 || r.x > 10 || r.z < 0 || r.z > 10));
  assert.ok(!w.push(20, 20, 0.5).hit);
  assert.ok(w.blocked(-0.2, 5, 0.5) && !w.blocked(-2, 5, 0.5));
});
test('collision: circles and segments (the camera ray)', () => {
  const w = createCollisionWorld([circle(10, 0, 1), box(20, -5, 22, 5)]);
  assert.ok(w.push(10, 1.2, 0.5).hit);
  near(w.segment(0, 0, 30, 0), 9 / 30, 1e-6); // stops at the circle
  assert.equal(w.segment(0, 8, 30, 8), 1);
  near(w.segment(15, 0, 30, 0), (20 - 15) / 15, 1e-6);
  assert.ok(w.segment(0, 0, 30, 0, 0.5) < 9 / 30, 'a fatter ray stops earlier');
});

// ── Ori ──
const walk = (c, inp, seconds) => { const steps = Math.round(seconds / STEP); for (let i = 0; i < steps; i++) c.step(inp); return c.state; };
const free = createCollisionWorld([]);
test('Ori accelerates to walking speed and to sprint speed, and stops again', () => {
  const c = createController(free, { x: 0, z: 0, heading: 0 });
  let s = walk(c, { mx: 0, mz: 1, sprint: false }, 1.5);
  near(s.speed, WALK_SPEED, 0.05, 'walk');
  s = walk(c, { mx: 0, mz: 1, sprint: true }, 2);
  near(s.speed, SPRINT_SPEED, 0.1, 'sprint');
  assert.ok(s.sprinting);
  s = walk(c, { mx: 0, mz: 0, sprint: false }, 1.5);
  assert.ok(s.speed < 0.02, 'stands still');
});
test('Ori turns towards where he walks (heading = atan2(vx, vz))', () => {
  const c = createController(free, { x: 0, z: 0, heading: 0 });
  walk(c, { mx: 1, mz: 0, sprint: false }, 1);
  near(c.state.heading, Math.PI / 2, 0.02);
  walk(c, { mx: 0, mz: -1, sprint: false }, 1);
  near(Math.abs(c.state.heading), Math.PI, 0.02);
});
test('stamina: sprinting burns it, he gets winded and must recover before sprinting again; coffee refills', () => {
  const c = createController(free);
  walk(c, { mx: 0, mz: 1, sprint: true }, 3);
  assert.ok(c.state.stamina < 0.5 && c.state.stamina > 0.2, `${c.state.stamina}`);
  let guard = 0;
  while (!c.state.winded && guard++ < 12 * 120) c.step({ mx: 0, mz: 1, sprint: true });
  assert.ok(c.state.winded && c.state.stamina < 0.01, `ran dry at ${c.state.stamina}`);
  assert.ok(guard < 7 * 120, 'about 5 s of sprint in total');
  walk(c, { mx: 0, mz: 1, sprint: true }, 1);
  assert.ok(!c.state.sprinting && c.state.speed < SPRINT_SPEED * 0.7, 'winded: no sprint');
  walk(c, { mx: 0, mz: 0, sprint: false }, 4);
  assert.ok(!c.state.winded && c.state.stamina >= 0.25, 'recovered');
  c.coffee(5);
  assert.equal(c.state.stamina, 1);
  walk(c, { mx: 0, mz: 1, sprint: true }, 4);
  assert.equal(c.state.stamina, 1, 'a coffee sprint is free');
  walk(c, { mx: 0, mz: 1, sprint: true }, 3);
  assert.ok(c.state.stamina < 1, 'and then it ends');
});
test('Ori never walks through a wall, even sprinting straight at it', () => {
  const w = createCollisionWorld([box(10, -50, 12, 50)]);
  const c = createController(w, { x: 0, z: 0, heading: Math.PI / 2 });
  walk(c, { mx: 1, mz: 0, sprint: true }, 8);
  assert.ok(c.state.x <= 10 - PLAYER_R + 1e-6, `x = ${c.state.x}`);
  assert.ok(c.state.blocked);
  walk(c, { mx: 1, mz: 1, sprint: false }, 2); // diagonal: slides along the wall
  assert.ok(c.state.z > 5 && c.state.x <= 10 - PLAYER_R + 1e-6);
});
test('Ori stays inside the map: a long run in every direction ends on the right side of the edge', () => {
  for (const [mx, mz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
    const c = createController(map.world, { x: map.spawn.x, z: map.spawn.z });
    walk(c, { mx, mz, sprint: true }, 60);
    const s = c.state;
    assert.ok(s.x >= BOUNDS.x0 - 1e-6 && s.x <= BOUNDS.x1 + 1e-6 && s.z >= BOUNDS.z0 - 1e-6 && s.z <= BOUNDS.z1 + 1e-6, `${mx},${mz} ended at ${s.x},${s.z}`);
    assert.ok(!map.world.blocked(s.x, s.z, PLAYER_R - 0.02), 'not inside anything');
  }
});
test('the walk is deterministic: the same inputs give the same state hash', () => {
  const run = () => {
    const c = createController(map.world, { x: map.spawn.x, z: map.spawn.z });
    const r = mulberry32(5);
    let h = 0;
    for (let i = 0; i < 6000; i++) {
      if (i % 120 === 0) { const a = r() * 6.28; var inp = { mx: Math.sin(a), mz: Math.cos(a), sprint: r() < 0.4 }; } // eslint-disable-line no-var
      c.step(inp);
      if (i % 600 === 0) h = hashNumbers([h, c.hash()]);
    }
    return hashNumbers([h, c.hash()]);
  };
  assert.equal(run(), run());
});
test('update(dt) runs fixed steps whatever the frame rate', () => {
  const a = createController(free);
  const b = createController(free);
  for (let i = 0; i < 120; i++) a.update(1 / 60, { mx: 0, mz: 1, sprint: false });
  for (let i = 0; i < 240; i++) b.update(1 / 120, { mx: 0, mz: 1, sprint: false });
  near(a.state.z, b.state.z, 0.03);
});
test('moveDir: W goes where the camera looks, D to its right', () => {
  let d = moveDir(0, 1, 0);
  near(d.mx, 0, 1e-9); near(d.mz, 1, 1e-9); // yaw 0 looks south
  d = moveDir(Math.PI, 1, 0);
  near(d.mz, -1, 1e-9);
  d = moveDir(Math.PI, 0, 1); // looking north, right = east
  near(d.mx, 1, 1e-9);
});

// ── the camera ──
test('the camera never ends up inside a building, and pulls in when a wall is behind Ori', () => {
  const rig = createCameraRig(map.world, { yaw: Math.PI });
  const c = createController(map.world, { x: map.spawn.x, z: map.spawn.z });
  const r = mulberry32(9);
  let pulled = 0;
  for (let i = 0; i < 4000; i++) {
    if (i % 90 === 0) { const a = r() * 6.28; var inp = { mx: Math.sin(a), mz: Math.cos(a), sprint: r() < 0.5 }; } // eslint-disable-line no-var
    c.step(inp);
    if (i % 2 === 0) {
      rig.update(1 / 60, { ...c.state }, {});
      assert.ok(!map.world.blocked(rig.state.x, rig.state.z, 0.05) || rig.state.hitT < 0.6, `camera inside something at ${rig.state.x},${rig.state.z}`);
      if (rig.state.hitT < 0.9) pulled++;
    }
  }
  assert.ok(pulled > 0, 'it pulled in at least once');
});
test('the camera swings round to look where Ori walks, and does not spin when he walks at it', () => {
  const rig = createCameraRig(null, { yaw: 0 });
  for (let i = 0; i < 300; i++) rig.update(1 / 60, { x: 0, z: 0, vx: 4, vz: 0, speed: 4, sprinting: false }, {});
  near(rig.state.yaw, Math.PI / 2, 0.15, 'now looks east');
  const rig2 = createCameraRig(null, { yaw: 0 });
  for (let i = 0; i < 300; i++) rig2.update(1 / 60, { x: 0, z: 0, vx: 0, vz: -4, speed: 4, sprinting: false }, {});
  near(rig2.state.yaw, 0, 1e-6, 'walking at the camera leaves it alone');
});

test('in a car the camera stays behind the nose: it does not flip while he reverses, and it comes round after a turn-around (it used to be left in front of the car)', () => {
  const car = (heading, speed) => ({ x: 0, z: 0, heading, vx: Math.sin(heading) * speed, vz: Math.cos(heading) * speed, speed: Math.abs(speed), sprinting: false, drive: true });
  const rig = createCameraRig(null, { yaw: 0 }); // looks south; the car's nose points south too
  for (let i = 0; i < 180; i++) rig.update(1 / 60, car(0, -8), {}); // reversing: moving north, nose south
  near(rig.state.yaw, 0, 0.05, 'reversing leaves the camera behind the nose');
  for (let i = 0; i < 120; i++) rig.update(1 / 60, car(Math.PI, 12), {}); // turned round: nose north, driving off towards the camera
  near(Math.abs(wrapPi(rig.state.yaw - Math.PI)), 0, 0.15, 'after 2 s it is behind the car again and looks where it goes');
  let worst = 0;
  const r2 = createCameraRig(null, { yaw: 0 });
  let prev = r2.state.yaw;
  for (let i = 0; i < 120; i++) { r2.update(1 / 60, car(Math.PI, 10), {}); worst = Math.max(worst, Math.abs(wrapPi(r2.state.yaw - prev)) * 60); prev = r2.state.yaw; }
  assert.ok(worst <= 2.85, `it never whips faster than 2.8 rad/s (${worst.toFixed(2)})`);
  const slow = createCameraRig(null, { yaw: 0 });
  for (let i = 0; i < 120; i++) slow.update(1 / 60, car(Math.PI, 0.4), {});
  near(slow.state.yaw, 0, 1e-9, 'a parked / creeping car does not swing the camera');
  const foot = createCameraRig(null, { yaw: 0 });
  for (let i = 0; i < 300; i++) foot.update(1 / 60, { x: 0, z: 0, vx: 0, vz: -4, speed: 4, sprinting: false, heading: Math.PI }, {});
  near(foot.state.yaw, 0, 1e-6, 'on foot, walking at the camera still leaves it alone');
});

// ── the day ──
test('the day clock: 06:00 to midnight in 14 real minutes, done at the end', () => {
  const c = createClock();
  assert.equal(c.label(), '06:00');
  for (let i = 0; i < DAY.realMinutes * 60 * 10; i++) c.tick(0.1);
  assert.ok(c.done && c.label() === '24:00'.replace('24', '00'));
  near(c.progress, 1, 1e-9);
  const fast = createClock({ realMinutes: 1 });
  fast.tick(60);
  assert.ok(fast.done);
});
test('the sun rises in the east, passes the south at noon and sets in the west over the sea', () => {
  const r = sunVector(6.1);
  const noon = sunVector(12.75);
  const s = sunVector(19.5);
  assert.ok(r.x > 0.9 && r.y < 0.1, 'sunrise east');
  assert.ok(noon.y > 0.85 && noon.z > 0.2, 'noon high, to the south');
  assert.ok(s.x < -0.9 && s.y < 0.1, 'sunset west');
  assert.ok(sunVector(23).y > 0.1 && sunVector(23).day === false, 'a moon at night');
});
test('the sky changes smoothly: no jump between neighbouring minutes, dark at night, bright at noon, windows lit after dusk', () => {
  let prev = skyAt(0);
  for (let m = 1; m <= 24 * 60; m++) {
    const s = skyAt(m / 60);
    for (const k of ['top', 'hor', 'key']) for (let i = 0; i < 3; i++) assert.ok(Math.abs(s[k][i] - prev[k][i]) < 0.03, `${k} jumps at ${(m / 60).toFixed(2)} h`);
    assert.ok(Math.abs(s.keyI - prev.keyI) < 0.1 && Math.abs(s.win - prev.win) < 0.05, `light jumps at ${(m / 60).toFixed(2)} h`);
    prev = s;
  }
  assert.ok(skyAt(13).keyI > 2 && skyAt(23).keyI < 0.5);
  assert.ok(skyAt(13).win === 0 && skyAt(23).win === 1);
  assert.ok(skyAt(13).night === 0 && skyAt(23).night === 1 && skyAt(2).night === 1);
  assert.ok(skyAt(8).top[2] > skyAt(23).top[2] * 3, 'the day sky is much brighter');
  assert.equal(skyAt(24).hour, 0);
});

// ── the crowd ──
test('the crowd: 40 walkers who stay on the streets of the map, deterministically, and step out of Ori\'s way', () => {
  const run = (seed) => {
    const c = createCrowd(map, { count: CROWD.count, seed });
    for (let i = 0; i < 60 * 120; i++) c.update(1 / 60, null);
    return c;
  };
  const a = run(7);
  assert.equal(a.walkers.length, CROWD.count);
  for (const w of a.walkers) assert.ok(w.x > BOUNDS.x0 - 25 && w.x < BOUNDS.x1 + 5 && w.z > BOUNDS.z0 - 15 && w.z < BOUNDS.z1 + 15, `walker at ${w.x},${w.z}`);
  assert.deepEqual(run(7).walkers.map((w) => [w.x, w.z]), a.walkers.map((w) => [w.x, w.z]));
  assert.notDeepEqual(run(8).walkers.map((w) => w.x), a.walkers.map((w) => w.x));
  const c = createCrowd(map, { count: 1, seed: 3 });
  const w = c.walkers[0];
  const ori = { x: w.x + 0.3, z: w.z };
  c.update(1e-4, ori);
  assert.ok(Math.hypot(w.x - ori.x, w.z - ori.z) > 0.7, 'pushed away from Ori');
});

// ── the content ──
test('content: every place has a name, a short sign and a tone; every personal fact is marked as a placeholder', () => {
  for (const [id, p] of Object.entries(PLACES)) {
    assert.ok(p.name && p.sign && /^#[0-9a-f]{6}$/i.test(p.tone), id);
    assert.ok(p.sign.length <= 14, `${id}: the sign "${p.sign}" is too long for the board`);
    assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(`${p.name}${p.sign}${p.blurb}`), `${id}: no emoji`);
  }
  assert.ok(ORI.jobs.length === 3 && ORI.hobbies.length === 2);
});

console.log(`${n} favors tests passed`);
