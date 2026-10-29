// "Ori, Can You...?" — food for the next fight [experimental] (pure): five foods in five places, each a small, kind help for ONE fight; the numbers change by 10-35 % and never go down; the props that give them are really in the rooms.      node scripts/test-favors-buffs.mjs
import assert from 'node:assert/strict';
import { FOODS, FOOD_IDS, MAX_BOOST, foodOfUse, applyBuff, fedFor, fedLine } from '../src/game3d/favors/buffs.js';
import { statsFor, MAX_LEVEL } from '../src/game3d/favors/boxer.js';
import { createBout } from '../src/game3d/favors/boxing.js';
import { fighter } from '../src/game3d/favors/fight-content.js';
import { PLACES } from '../src/game3d/favors/content.js';
import { ROOMS } from '../src/game3d/favors/interiors.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;
const STATS = ['maxHp', 'maxSt', 'dmg', 'speed', 'atk', 'regen'];

test('five foods, five places that have something to eat, each in kind plain words', () => {
  assert.deepEqual(FOOD_IDS.sort(), ['espresso', 'gum', 'snack', 'soup', 'tea']);
  assert.equal(new Set(Object.values(FOODS).map((f) => f.place)).size, 5, 'one food per place');
  for (const f of Object.values(FOODS)) {
    assert.ok(PLACES[f.place] && ROOMS[f.place], `${f.id}: a room you can go into`);
    for (const t of [f.name, f.line, f.tag]) { assert.ok(t.length >= 6 && t.length <= 48, t); assert.ok(!BANNED.test(t) && !/\p{Extended_Pictographic}/u.test(t), t); }
  }
});

test('a bite is a small thing: every number grows by 8-35 %, nothing is lowered, only the boxer\'s own stats are touched', () => {
  for (const f of Object.values(FOODS)) {
    for (const [k, m] of Object.entries(f.effect)) { assert.ok(STATS.includes(k), `${f.id}: ${k} is a boxer stat`); assert.ok(m >= 1.08 && m <= MAX_BOOST, `${f.id}.${k} x${m}`); }
    for (const lv of [1, 5, MAX_LEVEL]) {
      const base = statsFor(lv);
      const fed = applyBuff(base, f);
      for (const k of STATS) assert.ok(fed[k] >= base[k], `${f.id} lv${lv}: ${k} not lowered`);
      assert.ok(STATS.some((k) => fed[k] > base[k]), `${f.id} lv${lv}: something grows`);
      assert.equal(fed.level, base.level);
      assert.ok(fed !== base && base.maxHp === statsFor(lv).maxHp, 'a new object, the base untouched');
    }
  }
  assert.equal(applyBuff(statsFor(1), FOODS.soup).maxHp, 225, '180 x 1.25');
  assert.deepEqual(applyBuff(statsFor(3), null), statsFor(3), 'no food, no change');
  assert.deepEqual(applyBuff(statsFor(3), { effect: { maxHp: 9, nope: 2, dmg: 0.5 } }).dmg, statsFor(3).dmg, 'a decrease is ignored');
  assert.equal(applyBuff(statsFor(1), { effect: { maxHp: 9 } }).maxHp, Math.round(180 * MAX_BOOST), 'and a huge number is capped');
});

test('which prop gives which food, and the rooms really have them', () => {
  assert.equal(foodOfUse('food:soup'), 'soup');
  assert.equal(foodOfUse('coffee'), 'espresso');
  assert.equal(foodOfUse('snack'), 'snack');
  for (const bad of ['food:pizza', 'food:', 'food', 'food:constructor', 'sit', 'coffeejob', 'arcade', '', null, undefined, 4]) assert.equal(foodOfUse(bad), null, String(bad));
  for (const f of Object.values(FOODS)) assert.ok(ROOMS[f.place].items.some((it) => it.use === f.use), `${f.place} has a prop with use "${f.use}"`);
});

test('the food of today is carried into the next fight; yesterday\'s is gone; nonsense is nothing', () => {
  assert.equal(fedFor({ id: 'soup', day: 3 }, 3), FOODS.soup);
  assert.equal(fedFor({ id: 'soup', day: 3 }, 4), null);
  for (const bad of [null, undefined, {}, { id: 'pizza', day: 3 }, { id: 'constructor', day: 3 }, { id: 'soup' }, 'soup', 7]) assert.equal(fedFor(bad, 3), null, JSON.stringify(bad));
  assert.equal(fedLine(FOODS.tea), "Auntie's lemon tea: the breath comes back faster");
  assert.equal(fedLine(null), '');
});

test('in a real bout: the fed boxer starts with the bigger body; an unfed one is as before; the same seed plays the same', () => {
  const opp = fighter('moti');
  const plain = createBout({ level: 1, opp, seed: 4 });
  const fed = createBout({ level: 1, opp, seed: 4, buff: FOODS.soup });
  assert.equal(plain.P.maxHp, 180);
  assert.equal(fed.P.maxHp, 225);
  assert.equal(fed.P.hp, 225, 'he starts full');
  assert.equal(fed.O.maxHp, plain.O.maxHp, 'the other man is not helped');
  const tea = createBout({ level: 1, opp, seed: 4, buff: FOODS.tea });
  assert.ok(tea.P.regen > plain.P.regen && tea.P.maxHp === plain.P.maxHp);
  const none = createBout({ level: 1, opp, seed: 4, buff: null });
  assert.equal(none.P.maxHp, 180);
});

console.log(`${n} buffs tests passed`);
