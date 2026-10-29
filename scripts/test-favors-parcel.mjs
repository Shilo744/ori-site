// "Ori, Can You...?" — the parcel run [experimental] (pure): where a parcel goes, how long it gets, how it is graded and paid.      node scripts/test-favors-parcel.mjs
import assert from 'node:assert/strict';
import { FROM, DESTS, MIN_METERS, NEAR, limitFor, starsFor, REWARD, GIVE_UP, pickRun, chipFor } from '../src/game3d/favors/parcel.js';
import { PLACES } from '../src/game3d/favors/content.js';
import { buildMap } from '../src/game3d/favors/map.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;
const map = buildMap({});
const pt = (id) => (id === 'park' && map.zones.park ? { x: (map.zones.park.x0 + map.zones.park.x1) / 2, z: (map.zones.park.z0 + map.zones.park.z1) / 2 } : map.places[id].door);
const dist = (a, b) => Math.hypot(pt(a).x - pt(b).x, pt(a).z - pt(b).z);

test('a parcel starts at the garage and goes to a door that exists, a proper way off', () => {
  assert.equal(FROM, 'workshop');
  assert.ok(DESTS.every((d) => PLACES[d] && map.places[d]), 'every destination is a place with a door');
  assert.ok(!DESTS.includes(FROM));
  for (let seed = 1; seed <= 40; seed++) {
    const r = pickRun({ seed, dist });
    assert.ok(DESTS.includes(r.to) && r.from === FROM, `${seed}: ${r.to}`);
    assert.ok(r.meters >= MIN_METERS && Math.abs(r.meters - dist(FROM, r.to)) < 1e-9);
    assert.equal(r.limit, limitFor(r.meters));
  }
  const seen = new Set(Array.from({ length: 60 }, (_, i) => pickRun({ seed: i + 1, dist }).to));
  assert.ok(seen.size >= 5, `${seen.size} different doors over 60 parcels`);
  assert.deepEqual(pickRun({ seed: 9, dist }), pickRun({ seed: 9, dist }), 'the same seed, the same parcel');
});

test('the clock is generous and grows with the way; a walker has time too', () => {
  assert.ok(limitFor(70) >= 35 && limitFor(400) > limitFor(100) && limitFor(1000) <= 200);
  for (let seed = 1; seed <= 30; seed++) { const r = pickRun({ seed, dist }); assert.ok(r.limit * 5 >= r.meters, `on foot at 5 m/s: ${r.meters} m in ${r.limit} s`); }
});

test('grades: three stars for half the time, two under four fifths, one in time, none when late', () => {
  assert.deepEqual([0, 40, 50, 51, 78, 79, 100, 101, 400].map((e) => starsFor(e, 100)), [3, 3, 3, 2, 2, 1, 1, 0, 0]);
  assert.equal(GIVE_UP, 2);
});

test('the pay climbs with the stars; being late still pays a thank-you, never nothing', () => {
  assert.equal(REWARD.length, 4);
  for (let i = 1; i < 4; i++) { assert.ok(REWARD[i].peaches > REWARD[i - 1].peaches && REWARD[i].love >= REWARD[i - 1].love); }
  assert.ok(REWARD[0].peaches >= 1 && REWARD[3].peaches <= 40 && REWARD[3].love <= 3);
});

test('the chip says what is left, kindly, and never "late"', () => {
  const run = { limit: 75 };
  assert.equal(chipFor(run, 0, 'The Cafe'), 'Parcel for The Cafe: 1:15');
  assert.equal(chipFor(run, 14.2, 'The Cafe'), 'Parcel for The Cafe: 1:01');
  assert.equal(chipFor(run, 75, 'The Cafe'), 'Parcel for The Cafe: take your time');
  assert.ok(!BANNED.test(chipFor(run, 200, 'Mum\'s Flat')));
  assert.ok(NEAR >= 4 && NEAR <= 10);
});

console.log(`${n} parcel tests passed`);
