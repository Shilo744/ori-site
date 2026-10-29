// "Ori, Can You...?" — hello variety (pure): the people Ori meets most answer by the time of day, and warmer when they like him a lot; everything stays short and kind.      node scripts/test-favors-hello.mjs
import assert from 'node:assert/strict';
import { replyFor, BY_CAST, BY_TIME, FOND, AGAIN, bandOf } from '../src/game3d/favors/greet.js';
import { CAST } from '../src/game3d/favors/content.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;
const EMOJI = /[\u{1F300}-\u{1FAFF}☀-➿]/u;
const BANDS = ['morning', 'noon', 'evening', 'night'];
const share = (id, o, line, seeds = 400) => { let c = 0; for (let s = 1; s <= seeds; s++) if (replyFor(id, { ...o, seed: s * 7 + 3 }) === line) c++; return c / seeds; };

test('the parts of the day: morning until 10, noon until 15, evening until 20, then night', () => {
  const at = (h) => bandOf(h);
  assert.deepEqual([0, 5, 9.9, 10, 14.9, 15, 19.9, 20, 23.5].map(at), ['morning', 'morning', 'morning', 'noon', 'noon', 'evening', 'evening', 'night', 'night']);
});

test('every line is short, kind and free of emoji: the time-of-day ones and the fond ones', () => {
  const lines = [...Object.values(BY_TIME).flatMap((o) => Object.values(o)), ...Object.values(FOND).flat()];
  assert.ok(lines.length > 60, `${lines.length} lines`);
  for (const l of lines) { assert.ok(l.length <= 60, `too long: ${l}`); assert.ok(!BANNED.test(l), `cold word: ${l}`); assert.ok(!EMOJI.test(l), `emoji: ${l}`); }
  for (const [id, o] of Object.entries(BY_TIME)) { assert.ok(BY_CAST[id], `${id} is a cast member`); assert.deepEqual(Object.keys(o), BANDS, `${id} has all four parts of the day`); assert.equal(new Set(Object.values(o)).size, 4, `${id}: four different lines`); }
});

test('everybody in the cast has something warm to say when they like him a lot', () => {
  for (const id of Object.keys(CAST)) if (id !== 'self') assert.ok(FOND[id] && FOND[id].length >= 2, `${id} has fond lines`);
});

test('by the time of day: the right part of the day, sometimes, and never another one', () => {
  for (const [id, o] of Object.entries(BY_TIME)) {
    for (const [band, hour] of [['morning', 8], ['noon', 12], ['evening', 17], ['night', 22]]) {
      const mine = share(id, { hour }, o[band]);
      assert.ok(mine > 0.25 && mine < 0.55, `${id} at ${band}: ${mine}`);
      for (const other of BANDS.filter((b) => b !== band)) assert.equal(share(id, { hour }, o[other], 120), 0, `${id}: the ${other} line at ${band}`);
    }
  }
});

test('when they like him a lot (their circle\'s hearts, or the whole neighbourhood\'s love) the fond lines come, sometimes; when not, never', () => {
  for (const id of Object.keys(FOND)) {
    const fondLines = FOND[id];
    const count = (o) => { let c = 0; for (let s = 1; s <= 400; s++) if (fondLines.includes(replyFor(id, { hour: 12, seed: s * 5 + 1, ...o }))) c++; return c / 400; };
    const a = count({ rel: 85 }); const b = count({ love: 60 });
    assert.ok(a > 0.15 && a < 0.45, `${id} with high hearts: ${a}`);
    assert.ok(b > 0.15 && b < 0.45, `${id} with high love: ${b}`);
    assert.equal(count({ rel: 50, love: 20 }), 0, `${id}: not when it is just normal`);
    assert.equal(count({}), 0, `${id}: the defaults are normal`);
  }
});

test('what did not change: a repeat is a joke, a stranger is a stranger, an unknown person still gets a line, nothing ever throws', () => {
  assert.ok(AGAIN.includes(replyFor('ima', { first: false, seed: 4, rel: 99, love: 99 })));
  const s1 = replyFor('stranger:3', { hour: 8, seed: 2 }); const s2 = replyFor('stranger:3', { hour: 8, seed: 2, rel: 99, love: 99 });
  assert.equal(s1, s2, 'strangers do not care about hearts');
  assert.ok(replyFor('nobody-we-know', { seed: 1 }).length > 3);
  for (let i = 0; i < 500; i++) { const r = replyFor(Object.keys(BY_CAST)[i % Object.keys(BY_CAST).length], { hour: (i % 50) - 5, seed: i * 31 - 200, first: i % 7 !== 0, rel: (i % 140) - 20, love: (i % 130) - 10 }); assert.ok(typeof r === 'string' && r.length > 3, `run ${i}`); }
  const variety = new Set(); for (let s = 1; s <= 300; s++) variety.add(replyFor('ima', { hour: 8, seed: s, rel: 85 }));
  assert.ok(variety.size >= 5, `${variety.size} different answers from Mum`);
});

console.log(`${n} hello tests passed`);
