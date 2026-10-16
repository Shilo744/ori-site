// NEON DRIFT race logic (pure): laps / checkpoints / positions / deltas / resets / penalties, the AI on every track, the ghost
// recorder and the whole runner (grid, countdown, rolling start, results).  npm run test:race
import assert from 'node:assert/strict';
import { generateTrack, frameAt } from '../src/game3d/track.js';
import { createRace, CHECKPOINTS, RESET_COOLDOWN, RESET_PENALTY } from '../src/game3d/race.js';
import { createRecorder, encodeGhost, decodeGhost, createPlayback, GHOST_HZ } from '../src/game3d/ghost.js';
import { createRunner, DIFFICULTY, DIFFICULTY_IDS, RIVALS, gridSlot, GRID } from '../src/game3d/race-runner.js';
import { createCar, placeCar, stepCar, DT, stateHash } from '../src/game3d/physics.js';
import { createDriver, racingLine } from '../src/game3d/autodrive.js';
import { BIOMES } from '../src/game3d/biomes.js';
import { createRecords, medalFor, simulatePar, fmtTime, fmtDelta, MEDAL_FACTOR, parFor } from '../src/game3d/records.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const TRACKS = new Map();
const trackFor = (seed) => { if (!TRACKS.has(seed)) TRACKS.set(seed, generateTrack(seed)); return TRACKS.get(seed); };

// a tiny stand-in for the physics: every entry drives along the centre line at a constant speed
function drive(race, seconds, speeds, { dt = 1 / 120, headingErr = 0 } = {}) {
  const L = race.L;
  const pos = race.entries.map((e) => ((e.prevS % L) + L) % L);
  const steps = Math.round(seconds / dt);
  for (let k = 0; k < steps; k++) {
    const states = race.entries.map((e, i) => { pos[i] = (((pos[i] + speeds[i] * dt) % L) + L) % L; return { s: pos[i], speed: speeds[i], headingErr: typeof headingErr === 'function' ? headingErr(i, race.t) : headingErr }; });
    race.step(dt, states);
  }
  return pos;
}
const BEHIND = 0.5; // metres behind the line
const mk = (o = {}) => {
  const track = trackFor(7);
  const race = createRace({ track, laps: o.laps ?? 3, mode: o.mode ?? 'race', bestSplits: o.bestSplits ?? null, entries: o.entries ?? [{ id: 'p', name: 'You', player: true, s: track.length - 50 }, { id: 'a', name: 'A', s: track.length - 80 }] });
  return { track, race };
};
const events = (race, type) => race.events.filter((e) => e.type === type);

console.log('race rules');
test('a car behind the line starts with negative distance; the first crossing starts lap 1 and is not a lap', () => {
  const { race } = mk();
  assert.ok(race.entries[0].dist < 0 && race.entries[0].dist > -60);
  race.go();
  drive(race, 3, [30, 30]);
  assert.equal(events(race, 'start-lap').length, 2);
  assert.equal(events(race, 'lap').length, 0);
  assert.equal(race.entries[0].lap, 0);
});
test('lap times are exact (L / v) to well under a millisecond, whatever the step size', () => {
  for (const dt of [1 / 120, 1 / 60, 1 / 33]) {
    const { track, race } = mk({ entries: [{ id: 'p', name: 'You', player: true, s: track7().length - BEHIND }] });
    race.go();
    drive(race, 3 * (track.length / 40) + 6, [40], { dt });
    const laps = events(race, 'lap');
    assert.equal(laps.length >= 1, true);
    assert.ok(Math.abs(laps[0].time - track.length / 40) < 1e-3, `dt ${dt}: ${laps[0].time} vs ${track.length / 40}`);
  }
});
test('every lap has 7 ordered checkpoints, and the race ends after the set number of laps', () => {
  const { track, race } = mk({ laps: 2, entries: [{ id: 'p', name: 'You', player: true, s: track7().length - 20 }] });
  race.go();
  drive(race, 2 * (track.length / 45) + 8, [45]);
  const cps = events(race, 'checkpoint');
  assert.equal(cps.length, 2 * (CHECKPOINTS - 1));
  assert.deepEqual(cps.slice(0, CHECKPOINTS - 1).map((c) => c.gate), [1, 2, 3, 4, 5, 6, 7]);
  for (let i = 1; i < CHECKPOINTS - 1; i++) assert.ok(cps[i].split > cps[i - 1].split);
  assert.equal(events(race, 'finish').length, 1);
  assert.equal(race.entries[0].lapTimes.length, 2);
  assert.equal(race.phase, 'finished');
});
function track7() { return trackFor(7); }
test('positions: by distance, finished cars first by their time, and they swap when somebody overtakes', () => {
  const { race } = mk({ entries: [{ id: 'p', name: 'You', player: true, s: 3000 }, { id: 'a', name: 'A', s: 3100 }, { id: 'b', name: 'B', s: 3050 }] });
  race.go();
  drive(race, 0.02, [30, 30, 30]);
  assert.deepEqual(race.standings().map((e) => e.id), ['a', 'b', 'p']);
  drive(race, 20, [45, 30, 30]);
  assert.equal(race.standings()[0].id, 'p');
  assert.equal(race.entries.find((e) => e.id === 'p').place, 1);
});
test('deltas: ahead of the best splits is negative, behind is positive, and the lap end compares the whole lap', () => {
  const { track } = mk();
  const L = track.length;
  const best = Array.from({ length: CHECKPOINTS }, (_, i) => ((i + 1) / CHECKPOINTS) * (L / 40));
  const run = (v) => {
    const { race } = mk({ bestSplits: best, entries: [{ id: 'p', name: 'You', player: true, s: L - BEHIND }] });
    race.go();
    drive(race, L / v * 1.1 + 2, [v]);
    return { split: events(race, 'checkpoint').find((e) => e.gate === 3), lap: events(race, 'lap')[0], player: race.entries[0] };
  };
  const fast = run(42);
  const slow = run(38);
  assert.ok(fast.split.delta < 0 && slow.split.delta > 0);
  assert.ok(fast.player.delta < 0 && slow.player.delta > 0);
  assert.ok(Math.abs(slow.player.delta - (L / 38 - L / 40)) < 0.01);
});
test('the second lap is timed against the first one when there is no older record, and the delta is against the best BEFORE the lap', () => {
  const { track } = mk();
  const L = track.length;
  const { race } = mk({ entries: [{ id: 'p', name: 'You', player: true, s: L - BEHIND }] });
  race.go();
  drive(race, 0.05, [40]);
  race.entries[0].bestSplits = null;
  const lap1 = L / 40;
  drive(race, lap1, [40]); // lap 1 at 40 m/s: a record, nothing to compare with
  assert.equal(race.entries[0].delta, null);
  assert.ok(race.entries[0].bestSplits && race.entries[0].bestSplits.length === CHECKPOINTS);
  drive(race, L / 44 + 0.2, [44]); // lap 2 faster: gates show a negative delta, the lap end too
  const cps = events(race, 'checkpoint').filter((e) => e.delta != null);
  assert.ok(cps.length >= 6 && cps.every((e) => e.delta < 0), 'every gate of the faster lap is ahead of the old best');
  assert.ok(race.entries[0].delta < 0 && Math.abs(race.entries[0].delta - (L / 44 - L / 40)) < 0.02);
});
test('a jump in distance (teleport / cut) is not counted, voids the lap and raises a cut event', () => {
  const { track, race } = mk({ entries: [{ id: 'p', name: 'You', player: true, s: 100 }] });
  race.go();
  race.step(1 / 120, [{ s: 105, speed: 30, headingErr: 0 }]);
  race.step(1 / 120, [{ s: 105 + 400, speed: 30, headingErr: 0 }]);
  assert.equal(events(race, 'cut').length, 1);
  assert.equal(race.entries[0].lapValid, false);
  assert.ok(race.entries[0].dist < 110, 'the jump must not count as distance');
});
test('an invalid lap is recorded but never becomes the best lap', () => {
  const { track, race } = mk({ entries: [{ id: 'p', name: 'You', player: true, s: track7().length - BEHIND }] });
  race.go();
  drive(race, 0.1, [40]); // over the line: lap 1 begins
  race.entries[0].lapValid = false;
  drive(race, track.length / 40, [40]);
  assert.equal(race.entries[0].lapTimes[0].valid, false);
  assert.equal(race.entries[0].bestLap, null);
  drive(race, track.length / 40 + 1, [40]);
  assert.ok(race.entries[0].bestLap > 0);
  assert.equal(events(race, 'best-lap').length, 1);
});
test('wrong way: facing the road at speed for ~1 s raises the flag, turning round clears it', () => {
  const { race } = mk({ entries: [{ id: 'p', name: 'You', player: true, s: 500 }] });
  race.go();
  drive(race, 0.5, [20], { headingErr: 3 });
  assert.equal(race.entries[0].wrongWay, false);
  drive(race, 0.6, [20], { headingErr: 3 });
  assert.equal(race.entries[0].wrongWay, true);
  drive(race, 1, [20], { headingErr: 0.1 });
  assert.equal(race.entries[0].wrongWay, false);
  assert.equal(events(race, 'wrong-way').length, 1);
  assert.equal(events(race, 'right-way').length, 1);
  drive(race, 3, [1], { headingErr: 3 }); // standing still is not "wrong way"
  assert.equal(race.entries[0].wrongWay, false);
});
test('reset: 2 s cooldown; a race adds a 3 s penalty to the final time, a trial voids the lap instead', () => {
  const { track, race } = mk({ entries: [{ id: 'p', name: 'You', player: true, s: 0.5 }] });
  race.go();
  assert.equal(race.requestReset(0).ok, true);
  const again = race.requestReset(0);
  assert.equal(again.ok, false);
  assert.ok(again.wait > 1.9 && again.wait <= RESET_COOLDOWN);
  drive(race, RESET_COOLDOWN + 0.1, [30]);
  assert.equal(race.requestReset(0).ok, true);
  assert.equal(race.entries[0].penalty, 2 * RESET_PENALTY);
  const t = mk({ mode: 'trial', entries: [{ id: 'p', name: 'You', player: true, s: 0.5 }] });
  t.race.go();
  t.race.requestReset(0);
  assert.equal(t.race.entries[0].lapValid, false);
  assert.equal(t.race.entries[0].penalty, 0);
  assert.equal(mk().race.requestReset(0).ok, false, 'no reset before the lights go out');
});
test('the penalty is part of the finish time; unfinished cars get a projected time in the results', () => {
  const { track, race } = mk({ laps: 1, entries: [{ id: 'p', name: 'You', player: true, s: track7().length - BEHIND }, { id: 'a', name: 'A', s: track7().length - 2 * BEHIND }] });
  race.go();
  race.entries[0].penalty = 3;
  drive(race, track.length / 40 + 2, [40, 20]);
  const res = race.results();
  assert.equal(res[0].id, 'p');
  assert.ok(Math.abs(res[0].time - (track.length / 40 + 3)) < 0.02);
  assert.equal(res[1].projected, true);
  assert.ok(res[1].time > res[0].time);
});

console.log('ghost');
test('the recorder keeps 30 samples per second, and a ghost survives encode → decode', () => {
  const rec = createRecorder();
  rec.begin(10);
  for (let t = 10; t < 20; t += 1 / 120) rec.push(t, Math.sin(t) * 100, Math.cos(t) * 100, t * 0.3, Math.sin(t * 2));
  assert.ok(Math.abs(rec.length - 10 * GHOST_HZ) <= 2, `${rec.length} samples`);
  const g = rec.finish(10);
  const str = encodeGhost(g);
  assert.ok(typeof str === 'string' && str.length < 8000, `${str.length} chars for 10 s`);
  const back = decodeGhost(str);
  assert.equal(back.x.length, g.x.length);
  assert.ok(Math.abs(back.time - 10) < 1e-5);
  for (let i = 0; i < g.x.length; i += 7) {
    assert.ok(Math.abs(back.x[i] - g.x[i]) < 1e-3 && Math.abs(back.z[i] - g.z[i]) < 1e-3);
    assert.equal(back.psi[i], g.psi[i]);
    assert.equal(back.steer[i], g.steer[i]);
  }
});
test('playback interpolates position and wraps the heading the short way', () => {
  const rec = createRecorder();
  rec.begin(0);
  for (let i = 0; i < 60; i++) rec.push(i / GHOST_HZ, i, -i, 3.1 + i * 0.01, 0);
  const pb = createPlayback(decodeGhost(encodeGhost(rec.finish(2))));
  const p = pb.poseAt(0.5 / GHOST_HZ + 10 / GHOST_HZ, {});
  assert.ok(Math.abs(p.x - 10.5) < 1e-3 && Math.abs(p.z + 10.5) < 1e-3);
  const q = pb.poseAt(30 / GHOST_HZ, {});
  assert.ok(q.psi > -Math.PI - 1e-9 && q.psi <= Math.PI + 1e-9);
  assert.ok(Math.abs(pb.poseAt(99, {}).x - 59) < 1e-3, 'clamped at the end');
  let worst = 0;
  let prev = pb.poseAt(0, {}).psi;
  for (let t = 0.01; t < 1.9; t += 0.01) { const a = pb.poseAt(t, {}).psi; worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(a - prev), Math.cos(a - prev)))); prev = a; }
  assert.ok(worst < 0.05, `heading never jumps (${worst})`);
});
test('anything that is not a ghost decodes to null', () => {
  for (const bad of ['', 'abc', 'AAAA', btoa('not a ghost at all, just text'), null, undefined]) assert.equal(decodeGhost(bad), null);
});

console.log('drivers + runner');
test('the racing line stays on the road and moves wide-in / tight-at-the-apex around corners', () => {
  for (const seed of [7, 8, 27]) {
    const t = trackFor(seed);
    const line = racingLine(t);
    let crossed = 0;
    for (let i = 0; i < t.n; i++) {
      assert.ok(Math.abs(line[i]) <= t.width[i] / 2 - 2.5 + 1e-6);
      if (Math.abs(t.kappaS[i]) > 0.012 && Math.sign(line[i]) === Math.sign(t.kappaS[i]) && Math.abs(line[i]) > 0.5) crossed++; // the apex is on the inside of the corner
    }
    assert.ok(crossed > 20, `seed ${seed}: apex offsets ${crossed}`);
  }
});
test('the grid: slots are behind the line, distinct, 2 wide, and the player starts mid-pack', () => {
  const seen = new Set();
  for (let k = 0; k < 6; k++) { const s = gridSlot(k); assert.ok(s.s < -GRID.front + 1e-9 && s.s > -80); seen.add(`${s.s}|${s.lateral}`); }
  assert.equal(seen.size, 6);
  const r = createRunner({ track: trackFor(7), seed: 3 });
  assert.equal(r.entries.length, 6);
  assert.equal(r.playerIndex, 3);
  assert.equal(RIVALS.length, 5);
  assert.ok(r.entries.every((e) => e.car.s > trackFor(7).length - 90 && e.car.s < trackFor(7).length - 40));
});
test('countdown: 3 s of rolling pace, then GO at ~14 m/s with nobody over the line', () => {
  const track = trackFor(7);
  const r = createRunner({ track, seed: 3 });
  for (let i = 0; i < 120; i++) r.step({});
  assert.equal(r.phase, 'grid');
  assert.ok(r.entries.every((e) => e.car.speed < 0.01), 'the grid holds still until the lights start');
  r.start();
  let steps = 0;
  while (r.phase === 'countdown') { r.step({}); steps++; assert.ok(steps < 120 * 5); }
  assert.ok(Math.abs(steps / 120 - 3) < 0.05, `countdown ${steps / 120} s`);
  for (const e of r.entries) { assert.ok(Math.abs(e.car.speed - 14) < 2.5, `${e.name} at ${e.car.speed}`); }
  assert.ok(r.race.entries.every((e) => e.dist < 0), 'still behind the line at GO');
  assert.equal(r.phase, 'racing');
});
test('the whole race is deterministic: the same seed and the same player give the same state', () => {
  const play = () => {
    const track = trackFor(7);
    const r = createRunner({ track, seed: 5, laps: 1 });
    const bot = createDriver(track, r.player.car, { skill: 0.9 });
    const inp = {};
    r.start();
    for (let i = 0; i < 120 * 40; i++) { if (r.phase === 'racing') bot(r.player.car, inp); r.step(inp); }
    return stateHash(r.sim);
  };
  assert.equal(play(), play());
});
function fullRace(seed, difficulty, botSkill, laps = 3) {
  const track = trackFor(seed);
  const r = createRunner({ track, mode: 'race', laps, difficulty, seed: 1 });
  const bot = createDriver(track, r.player.car, { skill: botSkill });
  const inp = {};
  r.start();
  let guard = 0;
  while (r.phase !== 'finished' && guard++ < 120 * 600) {
    if (r.phase === 'racing') bot(r.player.car, inp, { others: r.entries.filter((e) => e.kind !== 'player').map((e) => e.car) });
    r.step(inp);
  }
  assert.equal(r.phase, 'finished', 'the race must end');
  return r;
}
test('every rival finishes 3 laps on every biome track with a sane time, none touches a wall hard or gets stuck (Normal)', () => {
  for (const b of Object.values(BIOMES)) {
    const track = trackFor(b.seed);
    const r = fullRace(b.seed, 'normal', 0.9);
    const res = r.race.results();
    assert.equal(res.length, 6);
    for (const x of res) {
      assert.ok(x.time > 2.5 * (track.length / 75) && x.time < 3.4 * (track.length / 35), `${b.id} ${x.name}: ${x.time}`);
    }
    for (const e of r.entries.filter((q) => q.kind === 'rival')) assert.equal(e.resets, 0, `${b.id}: ${e.name} was put back on the road`);
    assert.ok(r.race.entries.filter((e) => e.kind !== 'player').every((e) => !e.cut));
    // a proper field: nobody is more than 20 % behind the leader
    const lead = res[0].time;
    assert.ok(res.every((x) => x.time < lead * 1.2), `${b.id}: the field is strung out`);
  }
});
test('difficulty is ordered: the Easy rivals are slower than Normal, Normal slower than Hard (same track, same bot)', () => {
  const lap = (d) => {
    const r = fullRace(7, d, 0.95, 2);
    const rivals = r.race.entries.filter((e) => !e.player && e.bestLap);
    return rivals.reduce((a, e) => a + e.bestLap, 0) / rivals.length;
  };
  const [easy, normal, hard] = DIFFICULTY_IDS.map(lap);
  assert.ok(easy > normal && normal > hard, `${easy.toFixed(1)} > ${normal.toFixed(1)} > ${hard.toFixed(1)}`);
  assert.ok(easy / hard > 1.06 && easy / hard < 1.3);
});
test('the race is winnable and close: a good bot (0.95) wins Normal, loses to Hard; a weak bot (0.7) is beaten on Normal but stays in touch', () => {
  assert.equal(fullRace(8, 'normal', 0.95).race.player().place, 1);
  assert.ok(fullRace(8, 'hard', 0.95).race.player().place > 1);
  const weak = fullRace(8, 'normal', 0.7);
  const res = weak.race.results();
  const me = res.find((x) => x.player);
  assert.ok(me.place >= 5);
  assert.ok(me.time - res[0].time < 0.2 * res[0].time, `the weak bot is ${(me.time - res[0].time).toFixed(1)} s behind`);
});
test('cars bump and jostle in a pack but the race never deadlocks: rivals and the player end with sane speeds', () => {
  const r = fullRace(27, 'normal', 0.86);
  for (const e of r.entries) assert.ok(Number.isFinite(e.car.x) && Number.isFinite(e.car.speed));
  assert.ok(r.entries.some((e) => e.car.bump >= 0));
  assert.ok(r.race.entries.every((e) => e.finished || e.dist > 0.8 * r.laps * r.track.length || r.race.player().finished));
});
test('a rival that is thrown backwards onto the road is put back and finishes the lap', () => {
  const track = trackFor(8);
  const r = createRunner({ track, mode: 'race', laps: 1, difficulty: 'normal', seed: 2 });
  const bot = createDriver(track, r.player.car, { skill: 0.7 });
  const inp = {};
  r.start();
  const victim = r.entries[0];
  let hit = false;
  let guard = 0;
  while (r.phase !== 'finished' && guard++ < 120 * 400) {
    if (r.phase === 'racing') bot(r.player.car, inp);
    if (!hit && r.race.t > 20) { hit = true; const f = frameAt(track, victim.car.s, {}); placeCar(victim.car, track, victim.car.s, 4, 0); victim.car.psi = f.heading + Math.PI; victim.car.vx = victim.car.vz = 0; }
    r.step(inp);
  }
  assert.ok(victim.resets >= 1, 'the rival was put back on the road');
  assert.ok(r.race.entries[0].finished || r.race.entries[0].dist > 0.9 * track.length);
});
test('trial mode: one car, no rivals; the ghost of the best lap is produced, a reset voids the lap', () => {
  const track = trackFor(7);
  const r = createRunner({ track, mode: 'trial', laps: 2, seed: 1 });
  assert.equal(r.entries.length, 1);
  const bot = createDriver(track, r.player.car, { skill: 0.95 });
  const inp = {};
  r.start();
  let g = 0;
  while (r.phase !== 'finished' && g++ < 120 * 400) { if (r.phase === 'racing') bot(r.player.car, inp); r.step(inp); }
  assert.ok(r.ghost && r.ghost.time > 55 && r.ghost.time < 90, `ghost lap ${r.ghost && r.ghost.time}`);
  assert.ok(Math.abs(r.ghost.x.length - r.ghost.time * GHOST_HZ) < 4);
  const back = createPlayback(decodeGhost(encodeGhost(r.ghost)));
  const p = back.poseAt(r.ghost.time / 2, {});
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
  const evs = r.events.filter((e) => e.type === 'ghost');
  assert.ok(evs.length >= 1);
  const r2 = createRunner({ track, mode: 'trial', laps: 2, seed: 1 });
  r2.start();
  while (r2.phase === 'countdown') r2.step({});
  for (let i = 0; i < 360; i++) r2.step({});
  assert.equal(r2.resetPlayer().ok, true);
  assert.equal(r2.race.player().lapValid, false);
});

console.log('records');
const memStore = () => { const m = new Map(); return { get: (k, d = null) => (m.has(k) ? JSON.parse(m.get(k)) : d), set: (k, v) => { m.set(k, JSON.stringify(v)); return true; }, m }; };
test('medals: gold beats the par lap, silver 8 % and bronze 18 % slower, anything else none', () => {
  const par = 70;
  assert.equal(medalFor(69.9, par), 3);
  assert.equal(medalFor(70, par), 3);
  assert.equal(medalFor(70.1, par), 2);
  assert.equal(medalFor(par * MEDAL_FACTOR.silver, par), 2);
  assert.equal(medalFor(par * 1.1, par), 1);
  assert.equal(medalFor(par * MEDAL_FACTOR.bronze, par), 1);
  assert.equal(medalFor(par * 1.19, par), 0);
  assert.equal(medalFor(0, par), 0);
  assert.equal(medalFor(NaN, par), 0);
});
test('the par lap is a flying lap of the Hard rival: a believable time on every track and car, faster than a slower driver', () => {
  for (const b of Object.values(BIOMES)) {
    const track = trackFor(b.seed);
    for (const car of ['hatch', 'gt', 'hyper']) {
      const par = simulatePar(track, car);
      assert.ok(par > track.length / 75 && par < track.length / 30, `${b.id}/${car}: ${par}`);
    }
    const t = createCar('gt');
    placeCar(t, track, track.length - 0.5, 0, 50);
    const slow = createDriver(track, t, { skill: 0.8 });
    const inp = {};
    let last = t.s; let time = 0; let crossings = 0; let start = 0; let lap = 0;
    for (let i = 0; i < 120 * 300 && !lap; i++) { slow(t, inp); stepCar(t, inp, track); time += DT; if (t.s - last < -track.length / 2) { crossings++; if (crossings === 1) start = time; else lap = time - start; } last = t.s; }
    assert.ok(lap > simulatePar(track, 'gt') * 1.04, `${b.id}: a 0.8 driver (${lap.toFixed(1)}) is slower than par (${simulatePar(track, 'gt').toFixed(1)})`);
  }
});
test('records: best lap, medal upgrades (new-medal flag), race results, drift chain and prefs survive in the store', () => {
  const store = memStore();
  const r = createRecords(store);
  assert.equal(r.track('city').bestLap, null);
  assert.equal(r.prefs().biome, 'city');
  let x = r.recordLap('city', 90, { car: 'gt', par: 70, splits: [1, 2, 3, 4, 5, 6, 7, 90] });
  assert.deepEqual([x.isBest, x.medal, x.newMedal], [true, 0, false]);
  x = r.recordLap('city', 78, { car: 'gt', par: 70 });
  assert.deepEqual([x.isBest, x.medal, x.newMedal], [true, 1, true]);
  x = r.recordLap('city', 79, { car: 'gt', par: 70 });
  assert.deepEqual([x.isBest, x.best], [false, 78]);
  x = r.recordLap('city', 69, { car: 'hyper', par: 70 });
  assert.deepEqual([x.isBest, x.medal, x.newMedal], [true, 3, true]);
  assert.equal(r.track('city').bestCar, 'hyper');
  assert.equal(r.goldCount(), 1);
  r.recordLap('coast', 70, { par: 70 });
  assert.equal(r.goldCount(), 2);
  assert.equal(r.recordRace('city', { place: 3, time: 220, difficulty: 'normal' }).isBest, true);
  assert.equal(r.recordRace('city', { place: 1, time: 215, difficulty: 'hard' }).wins, 1);
  assert.equal(r.recordRace('city', { place: 2, time: 210, difficulty: 'easy' }).isBest, false);
  assert.equal(r.track('city').bestRace.place, 1);
  r.recordDrift(4.5, 1200);
  r.recordDrift(11, 800);
  assert.deepEqual(r.drift(), { best: 11, total: 2000 });
  r.setPrefs({ biome: 'coast', car: 'hyper' });
  const r2 = createRecords(store); // a new object on the same store: persisted
  assert.equal(r2.prefs().biome, 'coast');
  assert.equal(r2.prefs().difficulty, 'normal');
  assert.equal(r2.track('city').bestLap, 69);
  assert.equal(r2.ghost('city'), null);
  r2.setGhost('city', 'abc');
  assert.equal(r2.ghost('city'), 'abc');
});
test('par laps are cached in the store and a version bump forgets them', () => {
  const store = memStore();
  const r = createRecords(store);
  const b = BIOMES.city;
  const p = parFor(r, b, 'gt');
  assert.ok(p > 50);
  assert.equal(r.cachedPar('city', 'gt'), p);
  assert.equal(parFor(r, b, 'gt'), p);
  const raw = JSON.parse(store.m.get('drift:par'));
  raw.v = 0;
  store.m.set('drift:par', JSON.stringify(raw));
  assert.equal(r.cachedPar('city', 'gt'), null);
});
test('time formatting: m:ss.cc and signed deltas', () => {
  assert.equal(fmtTime(72.346), '1:12.35');
  assert.equal(fmtTime(9.5), '0:09.50');
  assert.equal(fmtTime(NaN), '—');
  assert.equal(fmtTime(65.123, 3), '1:05.123');
  assert.equal(fmtDelta(-0.42), '−0.42');
  assert.equal(fmtDelta(1.005), '+1.00');
  assert.equal(fmtDelta(null), '');
});

console.log(`${n} race tests passed`);
