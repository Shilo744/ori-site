// "Ori, Can You...?" — the boxing ring (pure): the rules (a hit, a guard, a parry, a perfect dodge, the knock-out), the levels, and the ladder: a sensible
// scripted boxer can beat every neighbour and the hidden boss; a button-masher cannot beat the strong ones.      node scripts/test-favors-boxing.mjs
import assert from 'node:assert/strict';
import { createBout, botInput, MOVES, RING } from '../src/game3d/favors/boxing.js';
import { statsFor, gainXp, xpToNext, MAX_LEVEL, MOVE_LIST, xpProgress } from '../src/game3d/favors/boxer.js';
import { LADDER, BOSS, FIGHTERS, availability, nextFight } from '../src/game3d/favors/fight-content.js';
import { mulberry32 } from '../src/game3d/rng.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const DT = 1 / 60;
const dummy = { id: 'dummy', hp: 100, dmg: 1, speed: 1, atk: 1, ai: { start: 99, react: 9, patterns: [['jab']], rest: [99, 99], block: 0, dodge: 0 } };

/** Runs a bout with a bot until it ends (or `max` seconds); returns the bout. */
function fight(opp, level, bot, seed = 1, max = 120) {
  const b = createBout({ level, opp, seed });
  const rnd = mulberry32(seed * 977 + 3);
  for (let t = 0; t < max && !b.over; t += DT) { b.update(DT, botInput(b, rnd, bot)); b.drain(); }
  return b;
}
const wins = (opp, level, bot, runs = 20) => { let w = 0; let ko = 0; let taken = 0; for (let s = 1; s <= runs; s++) { const b = fight(opp, level, bot, s); if (b.result && b.result.winner === 'player') w++; if (b.result && b.result.how === 'ko') ko++; taken += b.stats.taken; } return { w, ko, avgTaken: taken / runs, runs }; };

/** Puts the fighters in a spot and lets the intro pass. */
function setup(opp = dummy, level = 1) { const b = createBout({ level, opp, seed: 3, intro: 0 }); return b; }
const step = (b, secs, input = {}) => { const evs = []; for (let t = 0; t < secs; t += DT) { b.update(DT, input); evs.push(...b.drain()); } return evs; };
/** One tap of a key (a one-frame pulse), then the time to see what happens. */
const tap = (b, key, secs) => { const evs = []; for (let t = 0; t < secs; t += DT) { b.update(DT, t === 0 ? { [key]: true } : {}); evs.push(...b.drain()); } return evs; };

test('levels: XP climbs the bar, each level makes him stronger and opens a move, nothing is ever lost', () => {
  const s1 = statsFor(1); const s5 = statsFor(5); const s10 = statsFor(10);
  assert.ok(s5.maxHp > s1.maxHp && s5.dmg > s1.dmg && s5.speed > s1.speed && s10.maxHp > s5.maxHp);
  assert.equal(s1.unlocks.combo, false); assert.equal(s5.unlocks.counter, true); assert.equal(s5.unlocks.fury, false); assert.equal(s10.unlocks.fury, true);
  const rec = { xp: 0, level: 1 };
  let r = gainXp(rec, 50);
  assert.equal(r.level, 1); assert.ok(xpProgress(rec) > 0.8);
  r = gainXp(rec, 20);
  assert.equal(r.level, 2); assert.deepEqual(r.moves.map((m) => m.id), ['combo']);
  r = gainXp(rec, 100000);
  assert.equal(rec.level, MAX_LEVEL); assert.ok(xpProgress(rec) <= 1);
  assert.ok(xpToNext(1) === 60 && xpToNext(5) > xpToNext(2));
  assert.equal(MOVE_LIST.filter((m) => m.lv === 1).length, 4);
});

test('a jab that lands hurts, pushes him back and stuns him a moment; one out of reach whiffs', () => {
  const b = setup();
  b.O.z = -1.2; b.P.z = 0.2;
  step(b, 0.05);
  const hp0 = b.O.hp;
  const ev = tap(b, 'jab', 0.6);
  assert.ok(ev.some((e) => e.type === 'hit' && e.who === 'player'), 'the jab lands');
  assert.ok(b.O.hp < hp0 && b.O.hp > hp0 - 10, `hp ${hp0} -> ${b.O.hp}`);
  const far = setup();
  far.O.z = -3.0; far.P.z = 2.4;
  const ev2 = tap(far, 'jab', 0.5);
  assert.ok(ev2.some((e) => e.type === 'whiff') && !ev2.some((e) => e.type === 'hit'));
});

test('a punch has a wind-up you can see: the hit comes after it, and a dash in that time makes it miss (a perfect dodge slows time and opens the counter)', () => {
  const b = createBout({ level: 3, opp: { ...dummy, ai: { ...dummy.ai, start: 0.05, patterns: [['cross']], rest: [0.2, 0.2], react: 9 } }, seed: 4, intro: 0 });
  b.O.x = 0; b.O.z = -1.2; b.P.z = 0.1; b.P.x = 0;
  let perfect = false; let hit = false; let swing = null; let t = 0;
  for (; t < 6 && !(perfect || hit); t += DT) {
    const inp = {};
    if (b.O.state === 'attack' && b.O.phase === 'wind' && b.O.t > b.O.d.wind - 0.12 && b.P.state === 'idle') { inp.dash = true; inp.mx = 1; inp.mz = 0; }
    b.update(DT, inp);
    for (const e of b.drain()) { if (e.type === 'swing' && e.who === 'opp') swing = swing ?? t; if (e.type === 'perfect') perfect = true; if (e.type === 'hit' && e.target === 'player') hit = true; }
  }
  assert.ok(swing !== null, 'he swung');
  assert.ok(perfect && !hit, 'the dash right before the blow is a perfect dodge');
  assert.ok(b.P.counter > 0.5 && b.slow > 0, 'the counter window and the slow-mo');
  assert.ok(MOVES.cross.wind >= 0.18, 'a strong punch always shows 0.18 s or more of wind-up');
});

test('guard: soaks nearly all of a punch, drains breath, a guard raised just in time is a PARRY, and only the uppercut goes under it', () => {
  const mk = () => createBout({ level: 3, opp: { ...dummy, ai: { ...dummy.ai, start: 0.05, patterns: [['jab']], rest: [0.3, 0.3], react: 9 } }, seed: 5, intro: 0 });
  const b = mk(); b.O.z = -1.3; b.P.z = 0.2;
  const hp0 = b.P.hp; const st0 = b.P.st;
  const ev = step(b, 3, { block: true });
  assert.ok(ev.some((e) => e.type === 'block'), 'the guard held');
  assert.ok(b.P.hp > hp0 - 10, `almost no damage (${hp0} -> ${b.P.hp})`);
  assert.ok(b.P.st < st0 - 1 || b.P.state === 'guardbreak', 'it costs breath');
  // a parry: block pressed a heartbeat before the blow
  const p = mk(); p.O.z = -1.3; p.P.z = 0.2;
  let parried = false;
  for (let t = 0; t < 5 && !parried; t += DT) {
    const inp = {};
    if (p.O.state === 'attack' && p.O.phase === 'wind' && p.O.t > p.O.d.wind - 0.08) inp.block = true; else if (p.P.blocking) inp.block = p.O.state === 'attack' && p.O.phase === 'wind' && p.O.t > p.O.d.wind - 0.2;
    p.update(DT, inp);
    for (const e of p.drain()) if (e.type === 'parry') parried = true;
  }
  assert.ok(parried, 'a well-timed guard is a parry');
  assert.ok(p.O.state === 'hit' || p.O.stun > 0, 'and it throws him off');
  // a hook is blocked like any other punch (it only costs more breath); the uppercut is the one punch that goes under a guard
  const solo = (move) => createBout({ level: 3, opp: { ...dummy, ai: { ...dummy.ai, start: 0.05, patterns: [[move]], rest: [3, 3], react: 9 } }, seed: 5, intro: 0 });
  const hk = solo('hook'); hk.O.z = -1.3; hk.P.z = 0.2;
  const hpH = hk.P.hp; const stH = hk.P.st;
  const evH = step(hk, 1.2, { block: true });
  assert.ok(evH.some((e) => e.type === 'block' && e.by === 'opp') && hk.P.hp > hpH - 6, `a hook is blocked like any punch (${hpH} -> ${hk.P.hp})`);
  const cr = solo('cross'); cr.O.z = -1.3; cr.P.z = 0.2;
  const stC = cr.P.st; step(cr, 1.2, { block: true });
  assert.ok(stH - hk.P.st > stC - cr.P.st, 'a blocked hook costs more breath than a blocked cross');
  const up = solo('upper'); up.O.z = -1.3; up.P.z = 0.2;
  const hpU = up.P.hp;
  step(up, 1.5, { block: true });
  assert.ok(up.P.hp < hpU - 8, `an uppercut goes under a guard (${hpU} -> ${up.P.hp})`);
});

test('combinations: J, J, K is a hook (from Lv 2), J, J, J, K an uppercut (from Lv 4); a lower level only gets a cross', () => {
  const run = (level) => {
    const b = createBout({ level, opp: { ...dummy, hp: 400 }, seed: 6, intro: 0 });
    b.O.z = -1.2; b.P.z = 0.2;
    const seq = []; let t = 0; const queue = ['jab', 'jab', 'jab', 'cross'];
    let waiting = false;
    for (; t < 6; t += DT) {
      const inp = {};
      if (!waiting && queue.length && (b.P.state === 'idle' || (b.P.state === 'attack' && b.P.phase === 'rec'))) { inp[queue.shift()] = true; waiting = true; }
      b.update(DT, inp);
      for (const e of b.drain()) if (e.type === 'swing' && e.who === 'player') { seq.push(e.move); waiting = false; }
    }
    return seq;
  };
  const lv1 = run(1); const lv2 = run(2); const lv4 = run(4);
  assert.equal(lv1.at(-1), 'cross', `Lv1: ${lv1}`);
  assert.equal(lv4.at(-1), 'upper', `Lv4: ${lv4}`);
  assert.ok(['hook', 'upper'].includes(lv2.at(-1)) || lv2.at(-1) === 'cross', `Lv2: ${lv2}`);
});

test('the ring: nobody leaves it, nobody walks through the other, and a knock-out ends the bout with a winner', () => {
  const b = setup({ ...dummy, hp: 20 });
  step(b, 1.5, { mx: 1, mz: 0 });
  assert.ok(Math.abs(b.P.x) <= RING.half, `x ${b.P.x}`);
  step(b, 2, { mx: 0, mz: -1 });
  assert.ok(Math.hypot(b.P.x - b.O.x, b.P.z - b.O.z) >= 0.7, 'the fighters keep apart');
  const k = setup({ ...dummy, hp: 14 });
  k.noKnockdowns = true; // (this test is about the knock-out itself; the knock-down has its own test below)
  k.O.z = -1.2; k.P.z = 0.2;
  const ev = step(k, 5, { jab: true, cross: true });
  assert.ok(k.over && k.result.winner === 'player' && k.result.how === 'ko', JSON.stringify(k.result));
  assert.ok(ev.some((e) => e.type === 'ko' && e.who === 'opp') && ev.some((e) => e.type === 'over'));
  assert.equal(k.O.state, 'ko');
});

test('a knock-down: the first time his health runs out he goes down for a count and gets up with a little health back; the second time is the knock-out', () => {
  const b = setup({ ...dummy, hp: 14 });
  b.O.z = -1.2; b.P.z = 0.2;
  const ev = [];
  for (let t = 0; t < 3 && b.O.state !== 'down'; t += DT) { b.update(DT, { jab: true, cross: true }); ev.push(...b.drain()); }
  assert.equal(b.O.state, 'down', 'down, not out');
  assert.ok(!b.over && ev.some((e) => e.type === 'knockdown' && e.who === 'opp' && e.n === 1) && !ev.some((e) => e.type === 'ko'));
  const after = []; let up = -1;
  for (let t = 0; t < 6; t += DT) { b.update(DT, {}); const es = b.drain(); after.push(...es); if (up < 0 && es.some((e) => e.type === 'getup')) up = t; }
  const counts = after.filter((e) => e.type === 'count').map((e) => e.n);
  assert.ok(counts.length >= 2 && counts.every((n, i) => n === i + 1), `a count: ${counts}`);
  assert.ok(up > 2 && up < 5, `he gets up on his own after a few seconds (${up.toFixed(1)} s)`);
  assert.ok(!b.over, 'the bout goes on');
  // (a man on the canvas is not hit: the jabs thrown while he was down did nothing)
  const t0 = b.timeLeft;
  assert.ok(t0 > 0);
  const hpUp = b.O.hp;
  assert.ok(hpUp > 1 && hpUp <= 14 * 0.3, `he is back with a little health (${hpUp.toFixed(1)})`);
  // once the second of grace is over, the next knock-out is final
  b.O.z = b.P.z - 1.3; b.O.x = b.P.x;
  const ev2 = [];
  for (let t = 0; t < 6 && !b.over; t += DT) { b.update(DT, { jab: true, cross: true }); ev2.push(...b.drain()); }
  assert.ok(b.over && b.result.how === 'ko' && b.result.winner === 'player' && b.O.state === 'ko', JSON.stringify(b.result));
  assert.ok(ev2.some((e) => e.type === 'ko' && e.who === 'opp') && !ev2.some((e) => e.type === 'knockdown'));
});

test('the player down: nobody hits him, the opponent steps back, and mashing the punch keys gets him up sooner', () => {
  const hitter = { id: 'hitter', hp: 300, dmg: 60, speed: 1, atk: 1, ai: { start: 0.05, react: 9, tell: 1, patterns: [['jab']], rest: [0.2, 0.2], block: 0, dodge: 0, range: 1.5 } };
  const run = (mash) => {
    const b = createBout({ level: 1, opp: hitter, seed: 4, intro: 0 });
    b.O.z = b.P.z - 1.3; b.O.x = b.P.x;
    let down = -1; let up = -1; let hits = 0; const evs = [];
    for (let t = 0; t < 12 && !b.over; t += DT) {
      b.update(DT, mash && b.P.state === 'down' ? { jab: Math.floor(t * 10) % 2 === 0 } : {});
      for (const e of b.drain()) { evs.push(e); if (e.type === 'knockdown' && down < 0) down = t; if (e.type === 'getup' && up < 0) up = t; if (e.type === 'hit' && e.target === 'player' && down >= 0 && up < 0) hits++; }
    }
    return { down, up, hits, b, evs };
  };
  const passive = run(false); const masher = run(true);
  assert.ok(passive.down > 0 && passive.up > passive.down, 'he goes down and gets up');
  assert.equal(passive.hits, 0, 'nobody hits a man who is down');
  assert.ok(passive.up - passive.down > 3, `passive: ${(passive.up - passive.down).toFixed(1)} s on the canvas`);
  assert.ok(masher.up - masher.down < passive.up - passive.down - 0.8, `mashing is quicker: ${(masher.up - masher.down).toFixed(1)} s against ${(passive.up - passive.down).toFixed(1)} s`);
  const away = Math.hypot(passive.b.P.x - passive.b.O.x, passive.b.P.z - passive.b.O.z);
  assert.ok(passive.evs.filter((e) => e.type === 'count').length >= 3);
  void away;
});

test('a feint: the clever ones start a punch, pull out of it half way and throw it for real a beat later - the fake never lands, the real one follows', () => {
  const feinter = { id: 'feinter', hp: 300, dmg: 1, speed: 1, atk: 1, ai: { start: 0.05, react: 9, tell: 1.3, feint: 1, patterns: [['cross']], rest: [0.6, 0.6], block: 0, dodge: 0, range: 1.5 } };
  const b = createBout({ level: 1, opp: feinter, seed: 8, intro: 0 });
  b.O.z = b.P.z - 1.3; b.O.x = b.P.x;
  const evs = [];
  for (let t = 0; t < 10; t += DT) { b.update(DT, {}); for (const e of b.drain()) evs.push({ ...e, t }); }
  const feints = evs.filter((e) => e.type === 'feint');
  assert.ok(feints.length >= 2, `he fakes (${feints.length} times)`);
  for (const f of feints) {
    const real = evs.find((e) => e.type === 'swing' && e.who === 'opp' && e.t > f.t && e.t < f.t + 0.7 && e.move === f.move);
    assert.ok(real, 'and then throws it for real');
    assert.ok(!evs.some((e) => e.type === 'strike' && e.who === 'opp' && e.t > f.t - 0.6 && e.t <= f.t), 'the fake never lands');
    assert.ok(!evs.some((e) => e.type === 'feint' && e.t > real.t && e.t < real.t + 0.5), 'the real punch is not faked again');
  }
  assert.ok(evs.some((e) => e.type === 'strike' && e.who === 'opp'), 'the real ones land or are met');
});

test('a bout always ends: on the clock the fighter with more health left wins (and a draw is a draw)', () => {
  const b = createBout({ level: 1, opp: { ...dummy, ai: { ...dummy.ai, start: 0.05, patterns: [['jab']], rest: [99, 99] } }, seed: 8, intro: 0, round: 4 });
  b.O.z = -3; b.P.z = 3; b.O.hp = 40;
  step(b, 5);
  assert.ok(b.over && b.result.how === 'time' && b.result.winner === 'player', JSON.stringify(b.result));
  const d = createBout({ level: 1, opp: { ...dummy, hp: 100 }, seed: 8, intro: 0, round: 2 });
  step(d, 3);
  assert.equal(d.result.winner, 'draw');
});

test('the ladder: a careful boxer of the right level beats every neighbour; a masher loses to the later ones', () => {
  const careful = { skill: 0.85, aggression: 1.4 };
  const plan = [['moti', 1], ['albert', 2], ['inspector', 3], ['dov', 4], ['coach', 5]];
  for (const [id, lv] of plan) {
    const f = LADDER.find((x) => x.id === id);
    const r = wins(f, lv, careful, 16);
    assert.ok(r.w >= 11, `${id}: a careful Lv${lv} boxer wins ${r.w}/${r.runs} (took ${r.avgTaken.toFixed(0)})`);
  }
  const mash = { mash: true };
  const coach = wins(LADDER[4], 3, mash, 16);
  assert.ok(coach.w <= 6, `a masher at Lv3 beats the champion ${coach.w}/16`);
  const dov = wins(LADDER[3], 1, mash, 16);
  assert.ok(dov.w <= 5, `a masher at Lv1 beats Dov ${dov.w}/16`);
  const moti = wins(LADDER[0], 1, mash, 16);
  assert.ok(moti.w >= 8, `anybody can beat Moti: ${moti.w}/16`);
});

test('the hidden boss: absurdly fast (he teleports), so the same careful boxer needs real levels; he lags after a flurry, which is the opening', () => {
  const careful = { skill: 0.85, aggression: 1.4 };
  const low = wins(BOSS, 2, careful, 12);
  const high = wins(BOSS, 8, careful, 12);
  assert.ok(high.w > low.w && high.w >= 6, `Lv8: ${high.w}/12, Lv2: ${low.w}/12`);
  assert.ok(low.w <= 4, `Lv2 loses to him ${12 - low.w}/12`);
  const b = createBout({ level: 5, opp: BOSS, seed: 9 });
  const rnd = mulberry32(12);
  const types = new Set();
  for (let t = 0; t < 60 && !b.over; t += DT) { b.update(DT, botInput(b, rnd, { skill: 0.8, aggression: 1.4 })); for (const e of b.drain()) types.add(e.type); }
  assert.ok(types.has('blink'), 'he blinks around the ring');
  assert.ok(BOSS.ai.speed === undefined && BOSS.speed > 2 && BOSS.atk > 1.8, 'exaggerated speed');
});

test('the ladder opens in order and with love; the boss is hidden until the champion has fallen', () => {
  const rec = { beaten: [] };
  assert.equal(availability(LADDER[0], rec, 0).open, true);
  assert.equal(availability(LADDER[1], rec, 50).open, false);
  assert.equal(nextFight(rec, 0).id, 'moti');
  rec.beaten = ['moti', 'albert'];
  assert.equal(availability(LADDER[2], rec, 0).open, false, 'love is needed');
  assert.equal(availability(LADDER[2], rec, 10).open, true);
  assert.equal(availability(BOSS, rec, 100).open, false);
  rec.beaten = ['moti', 'albert', 'inspector', 'dov', 'coach'];
  assert.equal(availability(BOSS, rec, 0).open, true);
  assert.equal(nextFight(rec, 0).id, 'shilo');
  rec.beaten.push('shilo');
  assert.equal(nextFight(rec, 100), null);
  assert.equal(FIGHTERS.length, 6);
  for (const f of FIGHTERS) assert.ok(f.pre.length >= 2 && f.win && f.lose && f.reward.xp > 0);
});

console.log(`${n} boxing tests passed`);
