// "Ori, Can You...?" — the polish of the ring (pure): the numbers that float over a fighter who is hit, the speed bag drill, and the faces that react to a punch.
//      node scripts/test-favors-ring.mjs
import assert from 'node:assert/strict';
import { createBout, botInput } from '../src/game3d/favors/boxing.js';
import { LADDER } from '../src/game3d/favors/fight-content.js';
import { floatFor, floatWord, createFloatPool, floatLook, FLOAT_LIFE } from '../src/game3d/favors/fight-floats.js';
import { BAG, bpmAt, beatTimes, windows, multFor, isAccent, bestScore, starsFor, xpFor, createBagRun } from '../src/game3d/favors/training.js';
import { createFace, EXPRESSIONS, NEUTRAL } from '../src/game3d/favors/people/expressions.js';
import { mulberry32 } from '../src/game3d/rng.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const DT = 1 / 60;

/** All the events of some real bouts (scripted boxers of the right level against the neighbours). */
function bouts() {
  const evs = [];
  for (const [id, lv] of [['moti', 3], ['inspector', 5], ['dov', 5], ['coach', 6]]) {
    for (let seed = 1; seed <= 4; seed++) {
      const opp = LADDER.find((f) => f.id === id);
      const b = createBout({ level: lv, opp, seed });
      const rnd = mulberry32(seed * 977 + 3);
      for (let t = 0; t < 90 && !b.over; t += DT) { b.update(DT, botInput(b, rnd, { skill: 0.85, aggression: 1.4 })); evs.push(...b.drain()); }
    }
  }
  return evs;
}

// ── the floating numbers ──
test('a number floats over the fighter who is hit: white for a clean hit, gold for a counter and a perfect dodge, small grey for a blocked punch', () => {
  const evs = bouts();
  const fl = evs.map((e) => [e, floatFor(e)]).filter(([, f]) => f);
  const kinds = new Set(fl.map(([, f]) => f.kind));
  assert.ok(kinds.has('white') && kinds.has('gold') && kinds.has('grey'), `kinds seen: ${[...kinds]}`);
  for (const [e, f] of fl) {
    if (e.type === 'hit') {
      assert.equal(f.who, e.target, 'over the one who is hit');
      assert.equal(f.kind, e.counter ? 'gold' : 'white');
      assert.equal(f.text, String(Math.max(1, Math.round(e.dmg))));
    }
    if (e.type === 'block') { assert.equal(f.who, e.who, 'over the one who guarded'); assert.equal(f.kind, 'grey'); }
    if (e.type === 'perfect') { assert.equal(f.kind, 'gold'); assert.equal(f.text, 'PERFECT'); }
    assert.ok(['player', 'opp'].includes(f.who) && f.size > 0.5 && f.size < 1.6);
  }
  const size = (k, heavy) => floatFor({ type: 'hit', target: 'opp', dmg: 9, counter: k === 'gold', heavy }).size;
  assert.ok(size('gold', false) > size('white', true) && size('white', true) > size('white', false), 'counter > heavy > light');
  assert.ok(floatFor({ type: 'block', who: 'player', dmg: 1.2 }).size < 0.8, 'a blocked punch is small');
  assert.equal(floatFor({ type: 'swing', who: 'opp' }), null);
  assert.equal(floatFor({ type: 'hit', target: 'opp', dmg: 0.2 }).text, '1', 'never a "0"');
  assert.equal(floatWord('opp', 'GOOD', 'gold').text, 'GOOD');
});

test('the pool is a fixed set of slots: a flurry reuses them, nothing grows, every number is gone after its life, and the look eases in and out', () => {
  const pool = createFloatPool(6);
  const slots0 = pool.slots.slice();
  for (let i = 0; i < 200; i++) {
    pool.spawn({ who: i % 2 ? 'player' : 'opp', text: String(i), kind: 'white', size: 1 }, i, 2, 0);
    assert.ok(pool.live <= 6);
    pool.update(0.02);
  }
  assert.equal(pool.slots.length, 6);
  assert.ok(pool.slots.every((s, i) => s === slots0[i]), 'the very same objects, for ever');
  // all busy: the oldest (the one nearest its end) is recycled, the fresh ones survive
  const p2 = createFloatPool(3);
  const a = p2.spawn({ who: 'opp', text: 'a', kind: 'white', size: 1 }, 0, 0, 0); p2.update(0.5);
  const b = p2.spawn({ who: 'opp', text: 'b', kind: 'white', size: 1 }, 0, 0, 0); p2.update(0.1);
  const c = p2.spawn({ who: 'opp', text: 'c', kind: 'white', size: 1 }, 0, 0, 0); p2.update(0.1);
  const d = p2.spawn({ who: 'opp', text: 'd', kind: 'gold', size: 1 }, 0, 0, 0);
  assert.equal(d, a, 'the oldest slot is taken over');
  assert.deepEqual([a, b, c].map((s) => s.text), ['d', 'b', 'c']);
  p2.update(FLOAT_LIFE + 0.1);
  assert.equal(p2.live, 0, 'they all fade away');
  pool.spawn({ who: 'opp', text: '9', kind: 'gold', size: 1 }, 0, 0, 0);
  pool.clear();
  assert.equal(pool.live, 0);
  const s = { t: 0, life: FLOAT_LIFE, size: 1 };
  const l0 = floatLook(s);
  s.t = 0.5; const l1 = floatLook(s);
  s.t = FLOAT_LIFE - 0.01; const l2 = floatLook(s);
  assert.ok(l0.rise < l1.rise && l1.rise < l2.rise, 'it rises');
  assert.ok(l0.scale > 1.4 && l1.scale === 1, 'it pops, then settles');
  assert.ok(l0.alpha === 1 && l2.alpha < 0.1, 'and it fades at the end');
});

// ── the speed bag ──
const DEFAULT_BEATS = beatTimes();
/** Plays a run with a scripted player: presses on the beat (± jitter seconds), with the given hands; `mash` presses at random 14 times a second. */
function drill({ jitter = 0, hands = 'alt', mash = false, idle = false, seed = 5, skip = 0 } = {}) {
  const run = createBagRun();
  const rnd = mulberry32(seed);
  const presses = [];
  if (mash) for (let t = 0.3; t < BAG.time; t += 1 / 14) presses.push({ t, hand: rnd() < 0.5 ? 'J' : 'K' });
  else if (!idle) run.beats.forEach((b, j) => { if (skip && rnd() < skip) return; presses.push({ t: b + jitter * (rnd() * 2 - 1), hand: hands === 'alt' ? (j % 2 ? 'K' : 'J') : 'J' }); });
  presses.sort((a, b) => a.t - b.t);
  const evs = [];
  let p = 0;
  for (let i = 0; i < 60 * 25 && !run.over; i++) {
    run.update(DT);
    while (p < presses.length && presses[p].t <= run.state.time) { run.punch(presses[p].hand); p++; }
    evs.push(...run.drain());
  }
  return { run, evs };
}

test('the beat: it starts at about 96 bpm, gets quicker to about 164, there are a few dozen beats in 20 seconds and every eighth is an accent', () => {
  assert.ok(Math.abs(bpmAt(0) - 96) < 1e-9 && Math.abs(bpmAt(BAG.time) - 164) < 1e-9 && bpmAt(10) > 100 && bpmAt(10) < 160);
  const b = DEFAULT_BEATS;
  assert.ok(b.length >= 36 && b.length <= 56, `${b.length} beats`);
  assert.ok(b[0] === BAG.lead && b.at(-1) <= BAG.time - 0.3);
  const gaps = b.slice(1).map((t, i) => t - b[i]);
  assert.ok(gaps.every((g, i) => i === 0 || g < gaps[i - 1] + 1e-9), 'every gap is shorter than the one before');
  assert.ok(gaps[0] > 0.55 && gaps.at(-1) > 0.34, `gaps ${gaps[0].toFixed(2)} .. ${gaps.at(-1).toFixed(2)} s: a human can keep up`);
  assert.deepEqual([...b.keys()].filter(isAccent), [7, 15, 23, 31, 39, 47].filter((i) => i < b.length));
  const w1 = windows(0.625); const w2 = windows(0.366);
  assert.ok(w2.perfect <= w1.perfect && w2.good <= w1.good && w2.ok <= w1.ok && w2.perfect >= 0.05, 'the windows tighten with the tempo, never below 50 ms');
  assert.ok(w1.perfect < w1.good && w1.good < w1.ok && w1.ok < 0.21);
  assert.ok(multFor(0) === 1 && multFor(2) === 1.25 && multFor(20) === 3.5 && multFor(99) === 3.5);
});

test('a player who keeps the beat and alternates his hands gets three stars; a sloppy one fewer; a masher, a one-hander and a bystander very few', () => {
  const perfect = drill();
  assert.ok(perfect.run.over && perfect.run.result.rating > 0.97 && perfect.run.result.stars === 3, JSON.stringify(perfect.run.result));
  assert.equal(perfect.run.result.perfect, perfect.run.result.beats);
  assert.equal(perfect.run.result.maxCombo, perfect.run.result.beats);
  assert.equal(perfect.run.result.score, perfect.run.best, 'flawless play is the best score');
  const good = drill({ jitter: 0.07 });
  assert.ok(good.run.result.stars >= 2 && good.run.result.rating < perfect.run.result.rating, `a good player: ${good.run.result.rating.toFixed(2)}`);
  const loose = drill({ jitter: 0.16, seed: 9 });
  assert.ok(loose.run.result.rating < good.run.result.rating && loose.run.result.rating > 0.1, `a loose player: ${loose.run.result.rating.toFixed(2)}`);
  const gaps = drill({ skip: 0.35, seed: 3 });
  assert.ok(gaps.run.result.rating < 0.5 && gaps.run.result.slack > 5, `skipping a third of the beats: ${gaps.run.result.rating.toFixed(2)}`);
  const mash = drill({ mash: true });
  assert.ok(mash.run.result.rating < 0.25 && mash.run.result.stars <= 1, `mashing: ${mash.run.result.rating.toFixed(2)}`);
  const one = drill({ hands: 'J' });
  assert.ok(one.run.result.rating < 0.35 && one.run.result.rating > 0.05, `one hand only: ${one.run.result.rating.toFixed(2)} (every hit after the first is just OK)`);
  const idle = drill({ idle: true });
  assert.ok(idle.run.over && idle.run.result.score === 0 && idle.run.result.stars === 0 && idle.run.result.slack === idle.run.result.beats);
});

test('the rules of a punch: the grade comes from how near the beat it is, an accent pays double, a stray press drops the combo, nothing is ever taken away', () => {
  const B = DEFAULT_BEATS;
  const W = (j) => windows(j + 1 < B.length ? B[j + 1] - B[j] : B[j] - B[j - 1]);
  const run = createBagRun();
  const go = (t, hand) => { run.update(t - run.state.time); return run.punch(hand); };
  const g0 = go(B[0] - 0.01, 'J');
  const g1 = go(B[1] + (W(1).perfect + W(1).good) / 2, 'K');
  const g2 = go(B[2] + W(2).ok - 0.005, 'J');
  assert.deepEqual([g0, g1, g2].map((g) => g.grade), ['perfect', 'good', 'ok']);
  assert.deepEqual([g0.points, g1.points, g2.points], [100, 60, Math.round(25 * multFor(2))]);
  assert.equal(g2.combo, 3);
  // a press far from any beat is nothing
  const far = createBagRun(); far.update(B[0] - 0.3);
  assert.equal(far.punch('J').grade, 'off');
  assert.equal(far.state.score, 0);
  // the same hand twice in a row is only OK; alternating is what scores
  const same = createBagRun();
  same.update(B[0]); same.punch('J'); same.update(B[1] - same.state.time);
  assert.equal(same.punch('J').grade, 'ok', 'J, J: the second one is just OK even if it is dead on the beat');
  // a stray press drops the combo but never the score
  const run2 = createBagRun();
  for (let j = 0; j < 6; j++) { run2.update(B[j] - run2.state.time); run2.punch(j % 2 ? 'K' : 'J'); }
  const score = run2.state.score;
  assert.equal(run2.state.combo, 6);
  run2.update(B[6] - 0.3 - run2.state.time);
  assert.equal(run2.punch('K').grade, 'off');
  assert.equal(run2.state.combo, 0, 'a stray press starts the combo again');
  assert.equal(run2.state.score, score, 'but the points are kept');
  assert.equal(run2.state.lost, 1);
  // the accent (every eighth beat) pays double
  const acc = createBagRun();
  for (let j = 0; j <= 7; j++) { acc.update(B[j] - acc.state.time); acc.punch(j % 2 ? 'K' : 'J'); }
  const ev = acc.drain().filter((e) => e.type === 'hit');
  assert.ok(ev[7].accent && ev[7].points === 100 * 2 * multFor(7) && !ev[6].accent);
  // a beat nobody hits goes by quietly: the next one still counts
  const quiet = createBagRun(); quiet.update(B[0] + W(0).ok + 0.01);
  assert.equal(quiet.state.slack, 1);
  quiet.update(B[1] - quiet.state.time);
  assert.equal(quiet.punch('J').grade, 'perfect');
  assert.equal(quiet.state.combo, 1);
});

test('a run ends at 20 seconds exactly once with a result; nothing counts afterwards; the view feeds the HUD and the bag', () => {
  const { run, evs } = drill({ jitter: 0.05 });
  assert.equal(evs.filter((e) => e.type === 'over').length, 1);
  assert.equal(evs.filter((e) => e.type === 'beat').length, run.result.beats, 'a beat event for every beat');
  assert.equal(run.state.time, BAG.time);
  assert.equal(run.punch('J'), null);
  const s0 = run.state.score; run.update(5); assert.equal(run.state.score, s0);
  assert.equal(run.result.hits + run.result.slack, run.result.beats, 'every beat was either hit or let go by');
  const r2 = createBagRun();
  const v0 = r2.view();
  assert.ok(v0.left === BAG.time && v0.nextHand === 'J' && v0.upcoming.length >= 1 && v0.upcoming[0].index === 0 && v0.swing <= 1 && v0.swing >= -1);
  for (let t = 0; t < 12; t += DT) {
    r2.update(DT);
    const v = r2.view();
    assert.ok(v.phase >= 0 && v.phase <= 1 && Math.abs(v.swing) <= 1.0001, `phase ${v.phase}`);
    assert.ok(v.upcoming.every((u) => u.dt > -0.26 && u.dt < 2.21));
  }
  // the bag is at the fist (swing +1) on a beat and furthest in between
  const r3 = createBagRun(); r3.update(DEFAULT_BEATS[4] + 1e-6);
  assert.ok(r3.view().swing > 0.99);
  r3.update((DEFAULT_BEATS[5] - DEFAULT_BEATS[4]) / 2);
  assert.ok(r3.view().swing < -0.95);
  // deterministic: the same play gives the same score
  assert.equal(drill({ jitter: 0.05 }).run.result.score, drill({ jitter: 0.05 }).run.result.score);
});

test('it pays a little XP, never peaches, a bit less each time on the same day; a fight is always worth more', () => {
  assert.deepEqual([0, 1, 2, 3].map((s) => starsFor([0, 0.3, 0.6, 0.9][s])), [0, 1, 2, 3]);
  const r = (stars) => ({ stars });
  assert.deepEqual([0, 1, 2, 3].map((s) => xpFor(r(s))), [2, 5, 8, 12]);
  assert.deepEqual([0, 1, 2, 3, 4, 9].map((t) => xpFor(r(3), { today: t })), [12, 8, 5, 3, 3, 3]);
  assert.ok(xpFor(r(0), { today: 9 }) >= 1, 'always at least 1');
  const day = [0, 1, 2, 3, 4, 5].reduce((s, t) => s + xpFor(r(3), { today: t }), 0);
  assert.ok(day <= 40, `a whole day of perfect drills is ${day} XP`);
  const moti = LADDER.find((f) => f.id === 'moti');
  assert.ok(xpFor(r(3)) <= moti.reward.xp / 3, 'a perfect drill is a fraction of a first win over Moti');
  assert.ok(bestScore(DEFAULT_BEATS) > 5000, `best ${bestScore(DEFAULT_BEATS)}`);
});

// ── the faces ──
test('a face can flinch for a moment (the 0.3 s of a hit) and then goes back to what it was; there is still no angry face', () => {
  assert.ok(EXPRESSIONS.wince, 'a wince for the hit');
  const eyes = (c) => c.lidUp;
  const f = createFace(7);
  f.set('determined');
  for (let i = 0; i < 90; i++) f.update(DT, { calm: true });
  const before = { ...f.cur };
  f.react('wince', 0.3);
  const seen = [];
  for (let i = 0; i < 12; i++) { f.update(DT, { calm: true }); seen.push(f.cur.lidUp); }
  assert.ok(f.cur.lidUp > before.lidUp + 0.2, `the eyes squeeze shut (${before.lidUp.toFixed(2)} -> ${f.cur.lidUp.toFixed(2)})`);
  assert.ok(f.cur.open > before.open + 0.1, 'the mouth opens a little: "oof"');
  for (let i = 0; i < 60; i++) f.update(DT, { calm: true });
  assert.ok(Math.abs(f.cur.lidUp - before.lidUp) < 0.05 && Math.abs(f.cur.open - before.open) < 0.03, 'then the face is what it was');
  assert.equal(f.name, 'determined', 'the reaction never replaces the mood');
  f.react('nonsense', 0.3);
  f.update(DT, { calm: true });
  assert.ok(seen.length === 12 && eyes(f.cur) > 0);
  // a wince is warm: the smile is not turned upside down and the brows are not lowered into a scowl
  const w = EXPRESSIONS.wince;
  assert.ok((w.smile ?? NEUTRAL.smile) >= 0 && (w.browInL ?? 0) >= 0 && (w.browInR ?? 0) >= 0, 'no scowl');
  // a short reaction (the guard, refreshed every frame) never cuts a longer one (the flinch) off, but takes over when it is nearly done
  const h = createFace(5);
  h.set('smile');
  h.react('wince', 0.3);
  const lids = [];
  for (let i = 0; i < 30; i++) { h.react('determined', 0.15); h.update(DT, { calm: true }); lids.push(h.cur.lidUp); }
  assert.ok(Math.max(...lids.slice(0, 10)) > 0.9, 'the flinch lasts its 0.3 s even while the guard keeps asking for its face');
  assert.ok(h.cur.lidUp < 0.5, 'and then the guard face (determined) takes over');
  // the same reaction twice, or one that is cut short by another, does not get stuck
  const g = createFace(3);
  g.react('wince', 0.3); g.react('determined', 0.2);
  for (let i = 0; i < 40; i++) g.update(DT, { calm: true });
  assert.ok(Math.abs(g.cur.lidUp - NEUTRAL.lidUp) < 0.06, 'back to neutral');
});

console.log(`${n} ring-polish tests passed`);
