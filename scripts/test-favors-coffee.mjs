// "Ori, Can You...?" — the cafe job "Coffee Rush" [experimental] (pure): the orders, the keys, the patience, the clock, the pay.      node scripts/test-favors-coffee.mjs
import assert from 'node:assert/strict';
import { DRINKS, SECONDS, createCoffeeRun, sizeFor, patienceFor, pointsFor, peachesFor } from '../src/game3d/favors/coffee.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const keyOf = (id) => DRINKS.find((d) => d.id === id).key;
/** A perfect barista: always presses the right key, one every `gap` seconds. Returns the run. */
function barista(seed, gap = 0.35, secs = 600) {
  const r = createCoffeeRun({ seed });
  for (let t = 0; t < secs && !r.state.over; t += gap) { const o = r.view().order; r.press(keyOf(o.items[o.i])); r.update(gap); }
  return r;
}

test('three drinks on three keys (J K L), each with a name and a colour', () => {
  assert.deepEqual(DRINKS.map((d) => d.key), ['J', 'K', 'L']);
  assert.deepEqual(DRINKS.map((d) => d.code), ['KeyJ', 'KeyK', 'KeyL']);
  assert.equal(new Set(DRINKS.map((d) => d.color)).size, 3);
  assert.equal(SECONDS, 45);
});

test('the same seed gives the same customers; other seeds other ones; an order is one to three drinks that exist', () => {
  const a = createCoffeeRun({ seed: 5 }).view().order.items; const b = createCoffeeRun({ seed: 5 }).view().order.items;
  assert.deepEqual(a, b);
  assert.ok(Array.from({ length: 10 }, (_, i) => createCoffeeRun({ seed: i + 1 }).view().order.items.join()).some((x) => x !== a.join()));
  for (let seed = 1; seed <= 20; seed++) for (const id of createCoffeeRun({ seed }).view().order.items) assert.ok(DRINKS.some((d) => d.id === id));
});

test('the rush builds: one drink at first, two from the fourth customer, three from the ninth; they get a little less patient', () => {
  assert.deepEqual([0, 2, 3, 7, 8, 30].map(sizeFor), [1, 1, 2, 2, 3, 3]);
  assert.ok(patienceFor(2, 0) > patienceFor(1, 0) && patienceFor(3, 0) > patienceFor(2, 0), 'bigger orders wait longer');
  assert.ok(patienceFor(1, 20) < patienceFor(1, 0) && patienceFor(1, 999) >= 2.2, 'later ones wait less, never less than 2.2 s');
  assert.ok(pointsFor(1, 0) === 10 && pointsFor(3, 0) === 30 && pointsFor(1, 3) === 25 && pointsFor(1, 99) === 35, 'points: size, then a capped streak bonus');
});

test('the right keys serve an order (ok, ok, done); a wrong key starts it again and breaks the streak', () => {
  const r = createCoffeeRun({ seed: 3 });
  const first = r.view().order.items[0];
  assert.equal(r.press(keyOf(first)), 'done', 'the first customer wants one drink');
  assert.equal(r.state.served, 1); assert.equal(r.state.streak, 1); assert.equal(r.state.score, 10);
  // go on to a two-drink customer
  while (r.view().order.items.length < 2) { const o = r.view().order; r.press(keyOf(o.items[0])); }
  const o = r.view().order;
  assert.equal(r.press(keyOf(o.items[0])), 'ok');
  const wrong = DRINKS.find((d) => d.id !== o.items[1]).key;
  assert.equal(r.press(wrong), 'wrong');
  assert.equal(r.view().order.i, 0, 'from the top');
  assert.equal(r.state.streak, 0); assert.equal(r.state.wrong, 1);
  assert.equal(r.press(keyOf(o.items[0])), 'ok'); assert.equal(r.press(keyOf(o.items[1])), 'done');
  assert.equal(r.press('x'), null, 'not a drink key'); assert.equal(r.press(undefined), null);
  assert.equal(r.press('j') !== null, true, 'lower case is fine');
});

test('a customer who waits too long leaves: the streak is gone and the clock loses a moment', () => {
  const r = createCoffeeRun({ seed: 2 });
  const t0 = r.state.time;
  r.state.streak = 4;
  r.update(r.state.maxWait + 0.1);
  assert.equal(r.state.left, 1); assert.equal(r.state.streak, 0);
  assert.ok(r.state.time < t0 - 1.5, `${r.state.time} < ${t0 - 1.5}`);
  assert.ok(r.view().patience > 0.9, 'and the next customer is fresh');
});

test('the clock: 45 seconds, a happy streak adds a little, never more than a minute in all; the run ends at zero and nothing counts after', () => {
  const idle = createCoffeeRun({ seed: 4 });
  for (let t = 0; t < 60; t += 0.5) idle.update(0.5);
  assert.ok(idle.state.over && idle.state.time === 0 && idle.state.served === 0 && idle.state.left >= 5);
  const score = idle.state.score; idle.press('J'); idle.update(1);
  assert.equal(idle.state.score, score, 'nothing after the end');
  const r = createCoffeeRun({ seed: 6 });
  r.state.time = 59.9; const o = r.view().order; for (const id of o.items) r.press(keyOf(id));
  assert.ok(r.state.time <= 60, `${r.state.time}`);
});

test('a perfect barista serves a lot and scores well; a masher on one key serves little; the pay climbs with the score and the lunch rush pays more', () => {
  const pro = barista(1);
  assert.ok(pro.state.over && pro.state.served >= 20 && pro.state.score > 400 && pro.state.left === 0, `served ${pro.state.served}, score ${pro.state.score}`);
  const human = barista(1, 0.7); // (a good human: 1.4 keys a second)
  assert.ok(human.state.over && human.state.served >= 8 && human.state.served < pro.state.served, `a good human serves ${human.state.served}, the machine ${pro.state.served}`);
  const masher = createCoffeeRun({ seed: 1 });
  for (let t = 0; t < 120 && !masher.state.over; t += 0.2) { masher.press('J'); masher.update(0.2); }
  assert.ok(masher.state.served < pro.state.served / 2, `masher ${masher.state.served} vs ${pro.state.served}`);
  assert.ok(peachesFor(0) === 2 && peachesFor(300) === 25 && peachesFor(99999) === 40);
  assert.ok(peachesFor(300, true) > peachesFor(300) && peachesFor(99999, true) === 40);
  assert.ok(peachesFor(600) > peachesFor(300));
});

console.log(`${n} coffee tests passed`);
