// "Ori, Can You...?" — the stamp book [experimental] (pure): every place has a stamp, the rooms at the door, the open places when he walks up to them; the old `seen` rooms count; a full book is counted.      node scripts/test-favors-stamps.mjs
import assert from 'node:assert/strict';
import { STAMPS, ROOM_STAMPS, OPEN_STAMPS, NEAR, REWARD, got, count, isFull, book, newOpenStamps } from '../src/game3d/favors/stamps.js';
import { PLACES } from '../src/game3d/favors/content.js';
import { ROOMS } from '../src/game3d/favors/interiors.js';
import { buildMap } from '../src/game3d/favors/map.js';
import { TROPHIES, evaluate } from '../src/game3d/favors/trophies.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const map = buildMap({});

test('every place has one stamp: the rooms he can go into, and the three open places', () => {
  assert.deepEqual([...STAMPS].sort(), Object.keys(PLACES).sort());
  assert.deepEqual([...ROOM_STAMPS].sort(), Object.keys(ROOMS).sort(), 'the room stamps are exactly the rooms');
  assert.deepEqual(OPEN_STAMPS, ['busstop', 'park', 'court']);
  assert.equal(STAMPS.length, 14);
  assert.ok(REWARD.peaches > 0 && REWARD.love >= 1);
});

test('the stamps of a save: its flags, and the rooms the old "seen" remembers (the open ones are never "seen")', () => {
  assert.deepEqual(got({}), {});
  assert.deepEqual(got({ stamps: { cafe: true, park: true } }), { cafe: true, park: true });
  assert.deepEqual(got({ seen: { mum: true, kiosk: true, busstop: true, nope: true } }), { mum: true, kiosk: true }, 'a room entered before the book counts; an open place is not a room; a stranger is dropped');
  assert.deepEqual(got({ stamps: { cafe: true, nope: true, home: false }, seen: { cafe: true } }), { cafe: true });
  assert.equal(count({ stamps: { cafe: true }, seen: { mum: true } }), 2);
  assert.equal(isFull({ stamps: Object.fromEntries(STAMPS.map((id) => [id, true])) }), true);
  assert.equal(isFull({ stamps: Object.fromEntries(ROOM_STAMPS.map((id) => [id, true])) }), false, 'eleven rooms are not the whole book');
  assert.equal(isFull({ seen: Object.fromEntries(ROOM_STAMPS.map((id) => [id, true])), stamps: { busstop: true, park: true, court: true } }), true, 'old rooms + the three open ones');
});

test('the book for the journal: every place with its name, colour and sign, and whether it is stamped', () => {
  const b = book({ stamps: { cafe: true } });
  assert.equal(b.length, 14);
  assert.deepEqual(b.filter((s) => s.got).map((s) => s.id), ['cafe']);
  assert.ok(b.every((s) => s.name && /^#[0-9a-f]{6}$/i.test(s.tone) && s.sign), 'name, colour, sign');
  assert.equal(b.find((s) => s.id === 'park').open, true);
  assert.equal(b.find((s) => s.id === 'home').open, false);
});

test('open places: stamped when he is at the bus stop or the ring, or in the park; once; not from far away', () => {
  const points = { busstop: map.places.busstop.door, court: map.places.court.door };
  const park = map.zones.park;
  assert.ok(park && points.busstop && points.court);
  const at = (p, d = 0) => ({ x: p.x + d, z: p.z, points, park });
  assert.deepEqual(newOpenStamps({ x: 9999, z: 9999, points, park }, {}), [], 'far from all three: none');
  assert.deepEqual(newOpenStamps(at(points.busstop, NEAR - 0.5), {}).filter((id) => id === 'busstop'), ['busstop']);
  assert.ok(!newOpenStamps(at(points.busstop, NEAR + 3), {}).includes('busstop'));
  assert.ok(newOpenStamps(at(points.court, 2), {}).includes('court'));
  assert.ok(!newOpenStamps(at(points.court, 2), { court: true }).includes('court'), 'already stamped');
  const mid = { x: (park.x0 + park.x1) / 2, z: (park.z0 + park.z1) / 2, points, park };
  assert.ok(newOpenStamps(mid, {}).includes('park'));
  assert.ok(newOpenStamps({ ...mid, x: park.x0 - 1.5 }, {}).includes('park'), 'two metres of the edge count');
  assert.ok(!newOpenStamps({ ...mid, x: park.x0 - 5 }, {}).includes('park'), 'further out does not');
  assert.deepEqual(newOpenStamps({ x: 0, z: 0, points: {}, park: null }, {}), [], 'a map without them stamps nothing');
});

test('the achievements follow the book: Explorer at ten stamps, a full book at fourteen (the old "twelve places" could never be earned: there are eleven rooms)', () => {
  const ctx = (stamps) => ({ p: { stamps }, b: { level: 1, beaten: [] }, love: 0, day: 1, golden: 0, lifetime: 0 });
  const flags = (ids) => Object.fromEntries(ids.map((id) => [id, true]));
  const done = (c) => evaluate(c).filter((t) => t.done).map((t) => t.id);
  assert.ok(!done(ctx(flags(STAMPS.slice(0, 9)))).includes('explorer'));
  assert.ok(done(ctx(flags(STAMPS.slice(0, 10)))).includes('explorer'));
  assert.ok(!done(ctx(flags(STAMPS.slice(0, 13)))).includes('stampbook'));
  assert.ok(done(ctx(flags(STAMPS))).includes('stampbook'));
  assert.ok(TROPHIES.find((t) => t.id === 'explorer').need <= ROOM_STAMPS.length + OPEN_STAMPS.length);
});

console.log(`${n} stamps tests passed`);
