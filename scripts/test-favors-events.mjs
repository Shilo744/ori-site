// "Ori, Can You...?" — the city's little events by the hour [experimental] (pure): the schedule, how loud the band is, and the tracker that announces and pays them once a day.      node scripts/test-favors-events.mjs
import assert from 'node:assert/strict';
import { EVENTS, byId, activeAt, bandLevel, createEventTracker, NEAR } from '../src/game3d/favors/events.js';
import { PLACES } from '../src/game3d/favors/content.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;
const EMOJI = /[\u{1F300}-\u{1FAFF}☀-➿]/u;
const at = (id) => (place) => (place === id ? 3 : 200);

test('four events: a place that exists, an hour of the day that is its own, a short warm line, a small reward', () => {
  assert.deepEqual(EVENTS.map((e) => e.id), ['bakery', 'lunch', 'band', 'pizza']);
  for (const e of EVENTS) {
    assert.ok(PLACES[e.place], `${e.id}: ${e.place} is a place`);
    assert.ok(e.from >= 0 && e.to <= 24 && e.to - e.from >= 1.5 && e.to - e.from <= 3, `${e.id}: ${e.from}-${e.to}`);
    assert.ok(e.stay >= 4 && e.stay <= 20 && e.reward.peaches >= 1 && e.reward.peaches <= 10 && e.reward.love >= 0 && e.reward.love <= 4, e.id);
    assert.ok(/^#[0-9a-f]{6}$/i.test(e.color) && e.short.length <= 7 && e.sign.length <= 14, e.id);
    for (const t of [e.name, e.toast, e.enjoyed, e.sign]) { assert.ok(t.length >= 4 && t.length <= 70, t); assert.ok(!BANNED.test(t) && !EMOJI.test(t), t); }
  }
  const sorted = [...EVENTS].sort((a, b) => a.from - b.from);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].from >= sorted[i - 1].to, `${sorted[i].id} does not overlap ${sorted[i - 1].id}`);
  assert.equal(byId('band').music, true); assert.equal(byId('nope'), null);
});

test('what is on at which hour', () => {
  const ids = (h) => activeAt(h).map((e) => e.id);
  assert.deepEqual([6.9, 7, 8.99, 9, 11, 12, 13.99, 14, 17.49, 17.5, 19.24, 19.25, 20, 21.99, 22, 3].map(ids), [[], ['bakery'], ['bakery'], [], [], ['lunch'], ['lunch'], [], [], ['band'], ['band'], [], ['pizza'], ['pizza'], [], []]);
});

test('the band: full close by, quieter and quieter down the street, nothing far away or when it makes no sense', () => {
  assert.equal(bandLevel(0), 1); assert.equal(bandLevel(8), 1);
  assert.ok(Math.abs(bandLevel(28) - 0.25) < 1e-9);
  assert.equal(bandLevel(48), 0); assert.equal(bandLevel(500), 0); assert.equal(bandLevel(NaN), 0); assert.equal(bandLevel(Infinity), 0);
  let prev = 2;
  for (let d = 0; d <= 60; d += 1) { const l = bandLevel(d); assert.ok(l <= prev && l >= 0 && l <= 1, `${d}: ${l}`); prev = l; }
});

test('an event is announced once when it comes on, and only if it is still waiting for him', () => {
  const t = createEventTracker();
  const far = () => 500;
  assert.deepEqual(t.update(0.6, { day: 1, hour: 6, dist: far }), []);
  assert.deepEqual(t.update(0.6, { day: 1, hour: 7.1, dist: far }).map((m) => `${m.type}:${m.ev.id}`), ['start:bakery']);
  assert.deepEqual(t.update(0.6, { day: 1, hour: 7.2, dist: far }), [], 'only once');
  assert.deepEqual(t.open(7.5).map((e) => e.id), ['bakery']);
  assert.deepEqual(t.open(10), []);
  assert.deepEqual(t.update(0.6, { day: 1, hour: 12.5, dist: far }).map((m) => m.ev.id), ['lunch']);
});

test('he enjoys it by staying near for a few seconds: paid once, a step away only costs half the time, a new day starts over', () => {
  const t = createEventTracker();
  const run = (secs, dist, hour = 18, day = 1) => { const out = []; for (let s = 0; s < secs; s += 0.6) out.push(...t.update(0.6, { day, hour, dist })); return out; };
  run(0.6, () => 500); // announced
  const near = run(10, at('park'));
  assert.deepEqual(near, [], 'ten seconds are not twelve');
  const away = run(6, () => 500);
  assert.deepEqual(away, []);
  const back = run(12, at('park'));
  assert.deepEqual(back.map((m) => `${m.type}:${m.ev.id}`), ['reward:band'], 'paid after the time that is left (a step away does not start it over)');
  assert.deepEqual(run(30, at('park')), [], 'once a day');
  assert.equal(t.has('band'), true);
  assert.deepEqual(t.open(18), []);
  assert.deepEqual(t.snapshot(), { day: 1, done: ['band'] });
  const next = run(14, at('park'), 18, 2);
  assert.deepEqual(next.map((m) => `${m.type}:${m.ev.id}`), ['start:band', 'reward:band'], 'the next day it is on again');
});

test('the wrong place or the wrong hour pays nothing', () => {
  const t = createEventTracker();
  let out = [];
  for (let s = 0; s < 60; s += 0.6) out.push(...t.update(0.6, { day: 1, hour: 18, dist: at('cafe') }));
  assert.deepEqual(out.filter((m) => m.type === 'reward'), [], 'at the cafe during the band');
  out = [];
  for (let s = 0; s < 60; s += 0.6) out.push(...t.update(0.6, { day: 1, hour: 15, dist: at('park') }));
  assert.deepEqual(out, [], 'at the park at three: nothing is on');
});

test('what was enjoyed today is remembered on the save: a game reloaded the same day does not pay it again, a day later it does', () => {
  const t = createEventTracker();
  for (let s = 0; s < 20; s += 0.6) t.update(0.6, { day: 3, hour: 12.5, dist: at('cafe') });
  const snap = t.snapshot();
  assert.deepEqual(snap, { day: 3, done: ['lunch'] });
  const t2 = createEventTracker(snap);
  const same = []; for (let s = 0; s < 20; s += 0.6) same.push(...t2.update(0.6, { day: 3, hour: 12.5, dist: at('cafe') }));
  assert.deepEqual(same, [], 'the same day: nothing (not even the announcement)');
  const later = []; for (let s = 0; s < 20; s += 0.6) later.push(...t2.update(0.6, { day: 4, hour: 12.5, dist: at('cafe') }));
  assert.deepEqual(later.map((m) => m.type), ['start', 'reward']);
  assert.deepEqual(createEventTracker({ day: 'x', done: 'nope' }).snapshot(), { day: 0, done: [] }, 'a broken save is a fresh start');
});

console.log(`${n} event tests passed`);
