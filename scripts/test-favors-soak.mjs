// "Ori, Can You...?" — the ring's soak (pure): hundreds of bouts with every kind of player (careful, masher, pure random button noise) against every opponent at every level.
// Whatever happens, every frame must hold: numbers finite, nobody outside the ropes, health and breath inside their bars, only known states and events, and every bout ends in time
// with a winner who makes sense. The same seed must play out the same way.      node scripts/test-favors-soak.mjs [--bouts=240]
import assert from 'node:assert/strict';
import { createBout, botInput, RING } from '../src/game3d/favors/boxing.js';
import { OPPONENTS } from './lib/balance.mjs';
import { mulberry32 } from '../src/game3d/rng.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const DT = 1 / 60;
const STATES = new Set(['idle', 'attack', 'dash', 'hit', 'guardbreak', 'down', 'ko', 'win', 'fury']);
const EVENTS = new Set(['blink', 'block', 'count', 'dash', 'dodged', 'feint', 'fury', 'getup', 'guardbreak', 'hit', 'knockdown', 'ko', 'lag', 'over', 'parry', 'perfect', 'strike', 'swing', 'tired', 'whiff']);
const KEYS = ['jab', 'cross', 'fury', 'dash', 'block'];
const LIMIT = RING.half + 1e-6;
const bouts = Number((process.argv.find((a) => a.startsWith('--bouts=')) || '').split('=')[1]) || 240;

/** Plays one bout with a player of the given kind; checks every frame; returns { b, frames, events }. */
function play(opp, level, seed, kind) {
  const b = createBout({ level, opp, seed });
  const rnd = mulberry32(seed * 7919 + 11);
  const bot = kind === 'careful' ? { skill: 0.75, aggression: 0.6 } : kind === 'masher' ? { mash: true, aggression: 1.4 } : null;
  let held = {};
  const seen = {};
  let frames = 0;
  for (let t = 0; t < 90 && !b.over; t += DT, frames++) {
    let inp;
    if (bot) inp = botInput(b, rnd, bot);
    else { // noise: every key flips now and then, the stick wanders, sometimes everything at once
      if (rnd() < 0.12) for (const k of KEYS) if (rnd() < 0.3) held[k] = !held[k];
      inp = { mx: Math.sin(t * 1.7 + seed) * (rnd() < 0.9 ? 1 : 0), mz: Math.cos(t * 1.3) * 0.8, ...Object.fromEntries(KEYS.map((k) => [k, rnd() < 0.05 ? true : !!held[k]])) };
    }
    b.update(DT, inp);
    for (const e of b.drain()) { assert.ok(EVENTS.has(e.type), `unknown event ${e.type}`); seen[e.type] = (seen[e.type] || 0) + 1; }
    for (const f of [b.P, b.O]) {
      const where = `${opp.id} Lv${level} seed ${seed} ${kind} t=${t.toFixed(2)} ${f.id}`;
      for (const k of ['x', 'z', 'vx', 'vz', 'hp', 'st']) assert.ok(Number.isFinite(f[k]), `${where}: ${k} = ${f[k]}`);
      assert.ok(Math.abs(f.x) <= LIMIT && Math.abs(f.z) <= LIMIT, `${where}: out of the ring (${f.x.toFixed(2)}, ${f.z.toFixed(2)})`);
      assert.ok(f.hp >= -1e-6 && f.hp <= f.maxHp + 1e-6, `${where}: hp ${f.hp}`);
      assert.ok(f.st >= -1e-6 && f.st <= f.maxSt + 1e-6, `${where}: breath ${f.st}`);
      assert.ok(STATES.has(f.state), `${where}: state ${f.state}`);
    }
  }
  return { b, frames, seen };
}

test(`${bouts} bouts, every kind of player against every opponent at every level: nothing ever breaks the rules of the ring`, () => {
  const kinds = ['careful', 'masher', 'noise'];
  let ended = 0; let kos = 0; let downs = 0; let feints = 0;
  for (let i = 0; i < bouts; i++) {
    const opp = OPPONENTS[i % OPPONENTS.length];
    const level = 1 + ((i * 7) % 10);
    const kind = kinds[i % kinds.length];
    const { b, seen } = play(opp, level, 1000 + i, kind);
    assert.ok(b.over && b.result, `bout ${i} (${opp.id} Lv${level} ${kind}) did not end in 90 s`);
    assert.ok(['player', 'opp', 'draw'].includes(b.result.winner), `winner ${b.result.winner}`);
    if (b.result.how === 'ko') { kos++; assert.ok((b.P.state === 'ko') !== (b.O.state === 'ko'), 'a knock-out has exactly one loser on the canvas'); assert.notEqual(b.result.winner, 'draw'); }
    else assert.equal(b.result.how, 'time');
    ended++; downs += (seen.knockdown || 0); feints += (seen.feint || 0);
  }
  assert.equal(ended, bouts);
  assert.ok(kos > bouts * 0.2, `plenty of knock-outs (${kos})`);
  assert.ok(downs > 20, `knock-downs happen (${downs})`);
  assert.ok(feints > 5, `the clever ones feint (${feints})`);
});

test('the same seed plays out the same way (a bout is a pure function of its seed and the inputs)', () => {
  for (const [opp, lv, kind] of [[OPPONENTS[0], 1, 'careful'], [OPPONENTS[3], 4, 'masher'], [OPPONENTS[5], 8, 'noise'], [OPPONENTS[4], 10, 'careful']]) {
    const a = play(opp, lv, 77, kind); const c = play(opp, lv, 77, kind);
    assert.deepEqual(a.b.result, c.b.result, `${opp.id} ${kind}`);
    assert.equal(a.frames, c.frames);
    assert.deepEqual(a.seen, c.seen);
  }
});

test('time passes only as fast as the clock: a bout of 75 s never takes more than 77 s of frames, and an idle player does not hang it', () => {
  const idle = createBout({ level: 1, opp: OPPONENTS[0], seed: 3 });
  let t = 0;
  for (; t < 100 && !idle.over; t += DT) { idle.update(DT, {}); idle.drain(); }
  assert.ok(idle.over && t < 78, `ended after ${t.toFixed(1)} s`);
});

console.log(`${n} soak tests passed`);
