// "Ori's Life" — the tracks out of town and the field race [experimental] (pure): the geometry of a track, the grid, the obstacles, a race with a whole field of drivers (the place decides), the cups and what they pay.      node scripts/test-favors-tracks.mjs
import assert from 'node:assert/strict';
import { TRACKS, TRACK_IDS, buildTrack, minRadius, CP_EVERY, GRID_GAP, HAZARD_R } from '../src/game3d/favors/tracks.js';
import { OPEN, openRow, EVENTS, EVENT_IDS, eventBoard, eventResult, eventTemplates, eventIdOf, placeLine, levelOf } from '../src/game3d/favors/league.js';
import { createMission, specFor, ordinal } from '../src/game3d/favors/missions.js';
import { template } from '../src/game3d/favors/quests.js';
import { RACE } from '../src/game3d/favors/play-content.js';
import { PLACES } from '../src/game3d/favors/content.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;
const DT = 1 / 30;

test('four tracks out of town: a closed smooth line, long enough for a race, no turn a car cannot take, far from the city and from the rooms and from each other', () => {
  assert.deepEqual(TRACK_IDS, ['speedway', 'harbor', 'coast', 'ridge']);
  for (const id of TRACK_IDS) {
    const T = buildTrack(id);
    assert.ok(T.total > 900 && T.total < 1600, `${id}: ${T.total.toFixed(0)} m`);
    assert.ok(minRadius(T) >= 9, `${id}: the tightest turn is ${minRadius(T).toFixed(0)} m`);
    assert.ok(Math.hypot(T.path[0][0] - T.path[T.n - 1][0], T.path[0][1] - T.path[T.n - 1][1]) < T.seg * 1.5, 'the line closes');
    assert.ok(T.width >= 12 && T.laps >= 2 && T.name.length > 5 && /out of town/.test(T.far));
    for (const [x, z] of T.path) assert.ok(z > 1500 && Math.abs(x - T.origin.x) < 400, `${id}: far from the city (z ${z.toFixed(0)})`);
    const wrapped = T.at(T.total + 10); const plain = T.at(10);
    assert.ok(Math.hypot(wrapped.x - plain.x, wrapped.z - plain.z) < 1e-6, 'a distance wraps');
    // the road does not come back to touch itself: the line never passes closer than a road and its kerbs to a part of the lap far from it
    for (let i = 0; i < T.n; i += 3) for (let j = i + 1; j < T.n; j += 3) {
      const along = Math.min((j - i) * T.seg, T.total - (j - i) * T.seg);
      if (along > 80) assert.ok(Math.hypot(T.path[i][0] - T.path[j][0], T.path[i][1] - T.path[j][1]) > T.width + 14, `${id}: the road touches itself at ${i} and ${j}`);
    }
  }
  const xs = TRACK_IDS.map((id) => TRACKS[id].origin.x).sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 800, 'the tracks do not overlap');
  assert.ok(TRACK_IDS.some((id) => minRadius(buildTrack(id)) < 12) && TRACK_IDS.every((id) => minRadius(buildTrack(id)) >= 9), 'one of them has a real hairpin');
});

test('where a car is: how far along, how far off the line, on which side; the rings, the grid', () => {
  for (const id of TRACK_IDS) {
    const T = buildTrack(id);
    for (const d of [3, 120, 400, T.total - 20]) {
      const right = T.offsetAt(d, 4);
      const q = T.nearest(right.x, right.z);
      assert.ok(Math.abs(q.d - d) < 1.5 && Math.abs(q.dist - 4) < 0.6 && q.lat > 3, `${id} d=${d}: d ${q.d.toFixed(1)}, dist ${q.dist.toFixed(2)}, lat ${q.lat.toFixed(2)}`);
      const left = T.offsetAt(d, -5);
      assert.ok(T.nearest(left.x, left.z).lat < -4, 'the left side is negative');
    }
    assert.equal(T.cps.length, Math.floor((T.n - 1) / CP_EVERY) + 1, 'a ring every 25 m and the finish line');
    assert.ok(Math.abs(T.cps.at(-1).d - T.total) < 1e-6);
    for (let k = 0; k < 7; k++) { const s = T.slot(k); const q = T.nearest(s.x, s.z); assert.ok(q.dist <= 3.2, `${id}: slot ${k} is on the track`); assert.ok(q.d > T.total - GRID_GAP * (2 + Math.floor(k / 2)) - 2 && q.d < T.total - GRID_GAP * (1 + Math.floor(k / 2)) + 2, `${id}: slot ${k} is behind the line`); }
    const s0 = T.slot(0); const s1 = T.slot(1); const s2 = T.slot(2);
    assert.ok(Math.hypot(s0.x - s1.x, s0.z - s1.z) >= 5.5 && Math.hypot(s0.x - s2.x, s0.z - s2.z) >= GRID_GAP - 0.5, 'two abreast, a row apart');
  }
});

test('how tight a turn is: a driver carries a turn only as fast as his grip allows, and brakes BEFORE it', () => {
  const T = buildTrack('harbor');
  let at = 0; for (let i = 0; i < T.n; i++) if (T.radius[i] < T.radius[at]) at = i; // the tightest point
  const aLat = 30;
  const vTurn = T.speedAt((at + 0.5) * T.seg, aLat);
  assert.ok(Math.abs(vTurn - Math.sqrt(aLat * T.radius[at])) < 0.5, `in the turn: ${vTurn.toFixed(1)} m/s`);
  assert.ok(vTurn < 20, `a hairpin is slow (${vTurn.toFixed(1)} m/s)`);
  const before = T.speedAt((at + 0.5) * T.seg - 40, aLat);
  assert.ok(before > vTurn && before < 40, `${before.toFixed(1)} m/s 40 m before it: still slowing`);
  assert.ok(T.speedAt((at + 0.5) * T.seg - 90, aLat) > before, 'further back, faster');
  assert.ok(T.speedAt((at + 0.5) * T.seg, 36) > T.speedAt((at + 0.5) * T.seg, 24), 'more grip, more speed');
  const wide = buildTrack('speedway');
  assert.ok(Math.max(...Array.from({ length: wide.n }, (_, i) => wide.speedAt(i * wide.seg, 30))) > 25, 'the open bends of the Speedway ask for no braking');
});

test('the obstacles: cones, tyres, barrels and oil, spread over the lap, wholly on the road, never on the grid or just after the line', () => {
  const seen = new Set();
  for (const id of TRACK_IDS) {
    const T = buildTrack(id);
    const h = T.hazards;
    assert.ok(h.length >= 8 && h.length <= 80, `${id}: ${h.length} obstacles`);
    for (const o of h) {
      seen.add(o.kind);
      assert.ok(HAZARD_R[o.kind] === o.r, `${id}: a known kind`);
      assert.ok(Math.abs(o.lat) + o.r <= T.width / 2 - 1, `${id}: ${o.kind} at lat ${o.lat.toFixed(1)} is wholly on the road`);
      assert.ok(o.d >= 94 && o.d <= T.total - 66, `${id}: ${o.kind} at ${o.d.toFixed(0)} m is clear of the grid and of the start`);
      const q = T.nearest(o.x, o.z);
      assert.ok(q.dist < T.width / 2, `${id}: it stands on the road`);
    }
    const big = h.filter((o) => o.kind === 'tyres' || o.kind === 'barrel');
    for (let i = 1; i < big.length; i++) assert.ok(big[i].d - big[i - 1].d > 12, `${id}: a way through between two big ones`);
    assert.deepEqual(h.map((o) => o.i), h.map((_, i) => i), 'numbered in order');
  }
  assert.deepEqual([...seen].sort(), ['barrel', 'cone', 'oil', 'tyres']);
  assert.ok(buildTrack('harbor').hazards.length > buildTrack('speedway').hazards.length * 2, 'the harbour is busier than the Speedway');
});

test('the cups: who is in the field, what a place pays, when they open, in kind plain words', () => {
  assert.deepEqual(EVENT_IDS, ['speedway', 'harbor', 'coast', 'ridge']);
  for (const e of EVENTS) {
    assert.ok(TRACKS[e.track] && e.rivals.length >= 3 && e.prizes.length === e.rivals.length + 1 && e.xp.length === e.prizes.length && e.paces.length === e.rivals.length, e.id);
    for (let i = 1; i < e.prizes.length; i++) assert.ok(e.prizes[i] < e.prizes[i - 1] && e.xp[i] < e.xp[i - 1], `${e.id}: a better place pays more`);
    for (let i = 1; i < e.paces.length; i++) assert.ok(e.paces[i] > e.paces[i - 1], `${e.id}: the field gets quicker towards the front`);
    for (const t of [e.name, e.title, e.line]) assert.ok(!BANNED.test(t) && !/\p{Extended_Pictographic}/u.test(t), t);
  }
  assert.ok(EVENTS[0].paces[0] >= 18 && EVENTS.at(-1).paces.at(-1) <= 31, 'paces of a car that can really be matched (the car tops out at 27 m/s and more with the garage)');
  assert.ok(EVENTS.at(-1).paces[0] > EVENTS[0].paces[0] && EVENTS.at(-1).paces.at(-1) > EVENTS[0].paces.at(-1), 'the last cup is harder than the first');
  let b = eventBoard(0, {});
  assert.deepEqual(b.map((r) => r.n), [1, 2, 3, 4]);
  assert.deepEqual(b.map((r) => r.state), ['next', 'locked', 'locked', 'locked']);
  b = eventBoard(60, {});
  assert.deepEqual([b[0].state, b[1].state, b[1].why, b[2].why], ['next', 'locked', 'Beat Sababa Speedway first', 'Beat Sababa Speedway first']);
  b = eventBoard(400, { speedway: true });
  assert.deepEqual(b.map((r) => r.state), ['won', 'next', 'next', 'locked']);
  assert.equal(b[3].why, 'Beat Coast Road Cup first');
  assert.equal(eventBoard(0, { speedway: true })[1].why, 'Driver level 2');
  assert.equal(eventBoard(0, { speedway: true })[2].why, 'Driver level 3');
  assert.equal(eventBoard(400, { speedway: true, coast: true })[3].state, 'next');
  assert.equal(eventBoard(240, { speedway: true, coast: true })[3].why, 'Driver level 5');
  const r1 = eventResult(0, 'speedway', 1); const r3 = eventResult(0, 'speedway', 3); const r5 = eventResult(0, 'speedway', 5); const r9 = eventResult(0, 'speedway', 9);
  assert.deepEqual([r1.win, r1.prize, r1.xp, r3.win, r3.prize, r3.xp, r5.prize], [true, 150, 90, false, 55, 40, 15]);
  assert.ok(r9.prize > 0 && r9.xp > 0, 'nobody comes last for nothing');
  assert.equal(eventResult(0, 'nowhere', 1), null);
  assert.ok(levelOf(50).level === 2 && eventResult(40, 'speedway', 1).up, 'a win can step the level up');
  assert.equal(placeLine('Sababa Speedway', 1, 5), 'you won the Sababa Speedway!');
  assert.equal(placeLine('Coast Road Cup', 2, 6), '2nd of 6 at the Coast Road Cup.');
  assert.equal(ordinal(3), '3rd');
  const t = eventTemplates();
  assert.equal(t.length, 4);
  for (const [i, tpl] of t.entries()) {
    assert.deepEqual([tpl.mech, tpl.giver, tpl.optional, tpl.setpiece, eventIdOf(tpl.id)], ['race', 'uzi', true, true, EVENTS[i].id]);
    assert.ok(PLACES[tpl.at] && tpl.mp.rivals.length === EVENTS[i].rivals.length && tpl.mp.rivals.every((r) => r.who && r.speed > 15 && r.car && r.aLat > 15 && r.block >= 0 && r.error >= 0), tpl.id);
  }
  for (const bad of ['cup-', 'cup-nowhere', 'league-moti', null, 3]) assert.equal(eventIdOf(bad), null, String(bad));
});

/** Drives a bot round a track: it sits on its grid place until "go", then follows the line at `speed` (metres per second). Returns the finished mission. */
function race(eventId, speed, { max = 400 } = {}) {
  const tpl = eventTemplates().find((t) => t.id === `cup-${eventId}`);
  const spec = specFor(tpl);
  const m = createMission(spec, { day: 3, seed: 7, places: PLACES });
  const T = buildTrack(spec.track);
  const nR = spec.rivals.length;
  const slot = T.slot(nR);
  let d = -GRID_GAP * (1 + Math.floor(nR / 2));
  let car = { x: slot.x, z: slot.z, speed: 0 };
  const events = [];
  let t = 0;
  while (!m.done && t < max) {
    t += DT;
    if (m.state.stage === 'go') { d += speed * DT; const p = T.at(d); car = { x: p.x, z: p.z, speed }; }
    m.update({ dt: DT, car, p: { x: car.x, z: car.z, speed: 0 }, perks: {} });
    events.push(...m.drain());
  }
  return { m, events, t };
}

test('a field race: line up, count down, go; the place at the line is how many finished before him; the quick win, the slow come last, the middle in between', () => {
  const fast = race('speedway', 27);
  assert.ok(fast.m.done && fast.m.result.place === 1 && fast.m.result.field === 5 && fast.m.result.tip === 150 && fast.m.result.special === 'race', JSON.stringify(fast.m.result));
  assert.ok(fast.events.some((e) => e.type === 'count' && e.n === 2) && fast.events.some((e) => e.type === 'count' && e.n === 0));
  assert.deepEqual(fast.events.filter((e) => e.type === 'lap').map((e) => [e.lap, e.of, e.final]), [[2, 2, true]], 'the lap counter says "lap 2 of 2, the last one" - not a ring per 25 m');
  assert.ok(!fast.events.some((e) => e.type === 'checkpoint'), 'no "checkpoint 12 of 80" toast on the road');
  assert.ok(fast.events.some((e) => e.type === 'stage' && e.id === 'win' && /You won Sababa Speedway/.test(e.say)));
  assert.match(fast.m.result.board, /^1st You · 2nd \w+ · 3rd \w+ · 4th \w+ · 5th \w+$/, 'the finish says who came where');
  const slow = race('speedway', 9);
  assert.equal(slow.m.result.place, 5, 'slower than everybody: last');
  assert.equal(slow.m.result.tip, 15);
  assert.ok(slow.events.some((e) => e.type === 'stage' && e.id === 'lose' && /5th of 5/.test(e.say) && !BANNED.test(e.say)));
  const casual = race('speedway', 15);
  assert.equal(casual.m.result.place, 5, 'a casual 15 m/s is last: the rivals are not slow any more');
  const mid = race('speedway', 21);
  assert.ok(mid.m.result.place >= 2 && mid.m.result.place <= 4, `in between: ${mid.m.result.place}`);
  const again = race('speedway', 21);
  assert.equal(again.m.result.place, mid.m.result.place, 'the same drive gives the same place');
  const coast = race('coast', 29);
  assert.ok(coast.m.result.place === 1 && coast.m.result.field === 6 && coast.m.result.tip === 320, JSON.stringify(coast.m.result));
  const hard = race('coast', 20);
  assert.ok(hard.m.result.place >= 5, `the coast is no walk: ${hard.m.result.place}`);
  const ridge = race('ridge', 29);
  assert.ok(ridge.m.result.place <= 2 && ridge.m.result.field === 7, `the ridge can be won with a quick car: ${ridge.m.result.place}`);
  const ridgeLow = race('ridge', 21);
  assert.ok(ridgeLow.m.result.place >= 6, `... and not with a slow one: ${ridgeLow.m.result.place}`);
});

test('the field is on the road: every rival has a car, a name and a place on the grid; the cars HOLD until GO; the panel says the lap, the place and the time', () => {
  const tpl = eventTemplates()[0];
  const m = createMission(specFor(tpl), { day: 1, seed: 1, places: PLACES });
  const tg = m.targets();
  const rivals = tg.filter((t) => t.kind === 'rival');
  assert.equal(rivals.length, 4);
  assert.ok(rivals.every((r) => r.name && r.car && r.car.kind && Number.isFinite(r.x) && Number.isFinite(r.z)));
  assert.equal(new Set(rivals.map((r) => `${r.x.toFixed(1)},${r.z.toFixed(1)}`)).size, 4, 'each on his own place');
  assert.equal(tg.filter((t) => t.kind === 'checkpoint').length, 1, 'one ring, at his place on the grid');
  assert.match(m.view().label, /roll up to the grid/);
  assert.equal(m.view().race, null, 'no panel on the grid');
  assert.equal(m.locked, false);
  const T = buildTrack('speedway');
  const slot = T.slot(4);
  m.update({ dt: DT, car: { x: slot.x, z: slot.z, speed: 0 }, p: {}, perks: {} });
  assert.equal(m.state.stage, 'count');
  assert.equal(m.locked, true, 'the car is held while the numbers count down (no false start)');
  assert.equal(m.view().race.count, 3);
  const before = m.cars().map((c) => `${c.x.toFixed(2)},${c.z.toFixed(2)}`).join('|');
  for (let i = 0; i < 80; i++) m.update({ dt: DT, car: { x: slot.x, z: slot.z, speed: 0 }, p: {}, perks: {} });
  assert.equal(m.cars().map((c) => `${c.x.toFixed(2)},${c.z.toFixed(2)}`).join('|'), before, 'the rivals stand still too');
  assert.equal(m.locked, true);
  for (let i = 0; i < 30; i++) m.update({ dt: DT, car: { x: slot.x, z: slot.z, speed: 0 }, p: {}, perks: {} });
  assert.equal(m.state.stage, 'go');
  assert.equal(m.locked, false, 'GO: free');
  assert.deepEqual([m.view().race.lap, m.view().race.laps, m.view().race.rank, m.view().race.field, m.view().race.final], [1, 2, 5, 5, false]);
  assert.equal(m.targets().filter((t) => t.kind === 'checkpoint').length, 0, 'on the road there is no glowing ring: the road is the way');
  for (let i = 0; i < 90; i++) m.update({ dt: DT, car: { x: slot.x, z: slot.z, speed: 0 }, p: {}, perks: {} });
  assert.ok(m.view().race.clock > 2.9 && m.cars().every((c) => c.v > 8), 'the clock runs and the rivals are off');
  assert.ok(m.goal() && Number.isFinite(m.goal().x));
  assert.equal(RACE.countdown, 3);
});

test('rivals are drivers: they accelerate, brake for turns, keep to their grip, slip now and then, and go round the obstacles', () => {
  const tpl = eventTemplates().find((t) => t.id === 'cup-harbor');
  const spec = specFor(tpl);
  const m = createMission(spec, { day: 3, seed: 7, places: PLACES });
  const T = buildTrack('harbor');
  const slot = T.slot(4);
  const still = { x: slot.x, z: slot.z, speed: 0 };
  const lo = {}; const hi = {}; let worstSolid = 99; let worstOver = 0; let t = 0;
  while (!m.done && t < 130) {
    t += DT;
    m.update({ dt: DT, car: still, p: {}, perks: {} });
    if (m.state.stage !== 'go') continue;
    const clock = m.state.clock;
    for (const r of m.field) {
      if (r.finish != null) continue;
      hi[r.who] = Math.max(hi[r.who] || 0, r.v);
      if (clock > 15) lo[r.who] = Math.min(lo[r.who] ?? 99, r.v);
      worstOver = Math.max(worstOver, r.v - r.speed * 1.12);
      worstOver = Math.max(worstOver, r.v - T.speedAt(r.d, r.aLat) - 0.8);
      for (const o of T.hazards) if (o.kind === 'tyres' || o.kind === 'barrel') { const dm = Math.hypot(o.x - r.x, o.z - r.z); if (dm < worstSolid) worstSolid = dm; }
    }
  }
  assert.ok(worstOver <= 0.01, `nobody goes faster than his pace (+12 %) or than his grip allows in the turn ahead (over by ${worstOver.toFixed(2)})`);
  for (const r of m.field) {
    assert.ok(hi[r.who] > 15, `${r.who} got up to speed (${hi[r.who] && hi[r.who].toFixed(1)})`);
    assert.ok(lo[r.who] < hi[r.who] * 0.82, `${r.who} slows for the hairpins: ${lo[r.who] && lo[r.who].toFixed(1)} against ${hi[r.who].toFixed(1)}`);
  }
  assert.ok(worstSolid > 0.9, `they go round the tyres and the barrels (closest ${worstSolid.toFixed(2)} m)`);
  const grip = Object.fromEntries(m.field.map((r) => [r.who, r.aLat]));
  assert.ok(grip.Maya > grip.Albert, 'the better drivers have more grip');
});

test('a bump: the rival loses speed when the player hits him from the front, and is pushed on when hit from behind; he is shoved sideways; the cars list tells where they are', () => {
  const tpl = eventTemplates()[0];
  const m = createMission(specFor(tpl), { day: 1, seed: 1, places: PLACES });
  const T = buildTrack('speedway');
  const slot = T.slot(4);
  const idle = { x: slot.x, z: slot.z, speed: 0 };
  for (let i = 0; i < 4 * 30 + 90; i++) m.update({ dt: DT, car: idle, p: {}, perks: {} });
  assert.equal(m.state.stage, 'go');
  const c0 = m.cars()[0];
  assert.ok(c0.v > 5 && Number.isFinite(c0.h));
  const lat0 = m.field[0].lat; const v0 = m.field[0].v;
  const lx = Math.cos(c0.h); const lz = -Math.sin(c0.h);
  m.shove(0, lx, lz, 0.6, 8, true); // the player is on his right (n points at the player) and hit him from behind
  assert.ok(m.field[0].lat < lat0, 'pushed to the left, away from the player');
  assert.ok(m.field[0].v > v0, 'a hit from behind pushes him on');
  const v1 = m.field[1].v;
  m.shove(1, -lx, -lz, 0.5, 8, false);
  assert.ok(m.field[1].v < v1, 'a hit from the front costs him speed');
  m.shove(99, 1, 0, 1, 1, true); // nobody there: nothing happens
  m.shove(2, 0, 1, 0, 0, false);
});

test('the Sababa Open: a row on the board after the cups, open when three fighters can be faced, a purse and a trophy', () => {
  const a = openRow(true); const b = openRow(false);
  assert.deepEqual([a.n, a.ring, a.state, a.open, b.state, b.open], [5, true, 'next', true, 'locked', false]);
  assert.ok(OPEN.heal > 0 && OPEN.heal < 1 && OPEN.purse.peaches > 0 && OPEN.labels.length === 3);
  for (const t of [OPEN.name, OPEN.title, OPEN.line, a.pay, b.why, ...OPEN.labels]) assert.ok(!BANNED.test(t) && !/\p{Extended_Pictographic}/u.test(t), t);
});

void template;
console.log(`${n} track tests passed`);
