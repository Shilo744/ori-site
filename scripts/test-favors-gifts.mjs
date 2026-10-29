// "Ori, Can You...?" — gifts from the neighbours [experimental] (pure): one small gift for each of the twenty-one people, given after enough DAYS of hellos, once; kind words in their own voices.      node scripts/test-favors-gifts.mjs
import assert from 'node:assert/strict';
import { GIFTS, GIFT_IDS, LOVE, giftDue, noteHello, count, collection } from '../src/game3d/favors/gifts.js';
import { CAST } from '../src/game3d/favors/content.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;
const days = (id, k) => ({ gdays: { [id]: { n: k, d: k } } });

test('one gift for everybody Ori can meet (not for himself), each with its own name and its own voice', () => {
  assert.deepEqual([...GIFT_IDS].sort(), Object.keys(CAST).filter((id) => id !== 'self').sort());
  assert.equal(GIFT_IDS.length, 21);
  assert.equal(new Set(Object.values(GIFTS).map((g) => g.name)).size, 21, 'no two gifts are the same');
  assert.equal(new Set(Object.values(GIFTS).map((g) => g.line)).size, 21);
  for (const [id, g] of Object.entries(GIFTS)) {
    assert.ok(g.name.length >= 6 && g.name.length <= 30, `${id}: ${g.name}`);
    assert.ok(g.line.length >= 12 && g.line.length <= 60, `${id}: ${g.line}`);
    for (const t of [g.name, g.line]) assert.ok(!BANNED.test(t) && !/\p{Extended_Pictographic}/u.test(t), t);
    assert.ok(Number.isInteger(g.at) && g.at >= 2 && g.at <= 5, `${id}: ${g.at} days`);
  }
  assert.ok(LOVE > 0 && LOVE <= 1);
});

test('the family and the friends give first, the bosses and the inspector last', () => {
  for (const id of ['ima', 'auntie', 'cousin', 'moti', 'roee']) assert.equal(GIFTS[id].at, 2, id);
  for (const id of ['bossA', 'bossB', 'bossC', 'shilo']) assert.equal(GIFTS[id].at, 4, id);
  assert.equal(GIFTS.inspector.at, 5);
});

test('a gift is due after enough DAYS of hellos, once, and only from people who give them', () => {
  assert.equal(giftDue({}, 'moti'), null);
  assert.equal(giftDue(days('moti', 1), 'moti'), null);
  const g = giftDue(days('moti', 2), 'moti');
  assert.deepEqual([g.id, g.name, g.who], ['moti', 'A lucky coin', 'Moti']);
  assert.equal(giftDue({ ...days('moti', 9), gifts: { moti: true } }, 'moti'), null, 'only once');
  assert.ok(giftDue(days('inspector', 4), 'inspector') === null && giftDue(days('inspector', 5), 'inspector'));
  for (const bad of ['self', 'nope', '', null, undefined, 3, '__proto__', 'constructor', 'hasOwnProperty']) assert.equal(giftDue({ gdays: { self: { n: 99 }, nope: { n: 99 } } }, bad), null, String(bad));
  for (const bad of [null, undefined, 7, 'x', [], { gdays: 5 }, { gdays: { moti: 'lots' } }, { gdays: { moti: { n: NaN } } }, { gdays: { moti: { n: -4 } } }, { hi_moti: 99 }]) assert.equal(giftDue(bad, 'moti'), null, JSON.stringify(bad));
});

test('a hello counts as a new day only once a day: pressing H again, or every minute, is not a day', () => {
  const p = {};
  assert.equal(noteHello(p, 'moti', 1), true);
  assert.equal(noteHello(p, 'moti', 1), false);
  assert.equal(noteHello(p, 'moti', 1), false);
  assert.deepEqual(p.gdays.moti, { n: 1, d: 1 });
  assert.equal(noteHello(p, 'moti', 2), true);
  assert.equal(giftDue(p, 'moti').id, 'moti', 'the second day: the gift');
  assert.equal(noteHello(p, 'roee', 2), true, 'each person has their own count');
  assert.deepEqual(p.gdays.roee, { n: 1, d: 2 });
  for (const bad of ['self', 'nope', null, '__proto__']) assert.equal(noteHello(p, bad, 3), false, String(bad));
  assert.equal(noteHello(null, 'moti', 1), false);
});

test('the collection counts what he has and shows how far each one is', () => {
  assert.equal(count({}), 0);
  assert.equal(count({ gifts: { moti: true, roee: true, nope: true, ima: false } }), 2);
  assert.equal(count(null), 0);
  const c = collection({ gdays: { moti: { n: 1, d: 3 }, roee: { n: 9, d: 9 } }, gifts: { roee: true } });
  assert.equal(c.length, 21);
  const moti = c.find((x) => x.id === 'moti');
  assert.deepEqual([moti.have, moti.at, moti.got, moti.who], [1, 2, false, 'Moti']);
  const roee = c.find((x) => x.id === 'roee');
  assert.deepEqual([roee.have, roee.got], [2, true], 'progress never goes past the goal');
});

console.log(`${n} gifts tests passed`);
