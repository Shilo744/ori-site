// The error boundary's policy (pure): what the "Something tripped" card offers.      node scripts/test-game3d-tripwire.mjs
import assert from 'node:assert/strict';
import { createTripwire, tripCard } from '../src/game3d/tripwire.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };

test('the first trip offers "carry on"', () => {
  let t = 0;
  const w = createTripwire({ now: () => t });
  assert.deepEqual(w.hit(), { carryOn: true, trips: 1 });
  assert.equal(w.trips, 1);
});

test('tripping again right after carrying on is final (it would only loop); after a calm spell it is offered again', () => {
  let t = 1000;
  const w = createTripwire({ now: () => t, calm: 2000 });
  w.hit();
  w.resumed();
  t += 600;
  assert.equal(w.hit().carryOn, false, '0.6 s after carrying on');
  w.resumed();
  t += 5000;
  assert.equal(w.hit().carryOn, false, 'three trips in all: final whatever the calm (max 3)');
  let u = 0;
  const v = createTripwire({ now: () => u, calm: 2000 });
  v.hit(); v.resumed(); u += 2500;
  assert.equal(v.hit().carryOn, true, '2.5 s of calm: offered again');
});

test('never more than `max` carry-ons per game', () => {
  let t = 0;
  const w = createTripwire({ now: () => t, calm: 100, max: 3 });
  const answers = [];
  for (let i = 0; i < 6; i++) { answers.push(w.hit().carryOn); w.resumed(); t += 1000; }
  assert.deepEqual(answers, [true, true, false, false, false, false]);
});

test('without a "carry on" before, the calm clock does not block the first offer (time starts at zero)', () => {
  const w = createTripwire({ now: () => 0, calm: 2000 });
  assert.equal(w.hit().carryOn, true);
});

test('the card is warm and says what to do: carry on / stop / startup', () => {
  const a = tripCard({ carryOn: true, who: 'Ori' });
  assert.equal(a.title, 'Something tripped'); assert.match(a.body, /^Ori stumbled over something/); assert.match(a.body, /carry on/); assert.match(a.body, /Esc/);
  const b = tripCard({ carryOn: false, who: 'Ori' });
  assert.equal(b.title, 'Something tripped again'); assert.ok(!/carry on/i.test(b.body)); assert.match(b.body, /Esc/);
  const c = tripCard({ carryOn: false, startup: true });
  assert.match(c.body, /^The game stumbled while starting up/); assert.match(c.body, /Esc/);
  const BAD = /\b(error|crash(ed)?|fail(ed|ure)?|exception|broken|bug|sorry|can'?t|cannot)\b/i;
  for (const x of [a, b, c, tripCard({ carryOn: true })]) assert.ok(!BAD.test(`${x.title} ${x.body}`) && x.body.length < 160, x.body);
});

console.log(`${n} tripwire tests passed`);
