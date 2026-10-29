// The frame rate keeper (pure): resolution goes down when the game stays slow AND that helps, comes back when there is room, never flaps, and leaves a game alone when lowering the
// resolution is not what it needs.      node scripts/test-game3d-adaptive.mjs
import assert from 'node:assert/strict';
import { createAdaptiveRes } from '../src/game3d/adaptive-res.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
/** A machine that is held back by its graphics: fewer pixels, more frames. */
const gpu = (k) => (r) => k / r;
/** Feeds `secs` seconds of fps (a number, or a function of the current ratio) in half-second samples; returns the ratios it changed to. */
const feed = (a, fps, secs) => { const out = []; for (let t = 0; t < secs; t += 0.5) { const r = a.sample(typeof fps === 'function' ? fps(a.ratio) : fps, 0.5); if (r != null) out.push(r); } return out; };
/** Seconds until the first change (or Infinity after `max`). */
const until = (a, fps, max = 80) => { for (let t = 0.5; t <= max; t += 0.5) if (a.sample(typeof fps === 'function' ? fps(a.ratio) : fps, 0.5) != null) return t; return Infinity; };

test('it starts at what the screen offers and stays there while the game is smooth', () => {
  const a = createAdaptiveRes({ max: 2 });
  assert.equal(a.ratio, 2);
  assert.deepEqual(feed(a, 60, 120), []);
  assert.equal(a.ratio, 2);
});

test('a few slow seconds in a row step it down; one hitch does not', () => {
  const a = createAdaptiveRes({ max: 2 });
  assert.deepEqual(feed(a, 20, 1.5), [], 'a second and a half of slowness is a hitch');
  feed(a, 60, 2);
  assert.deepEqual(feed(a, 20, 2), [], 'and the count starts again after a good moment');
  assert.deepEqual(feed(a, 20, 1), [1.6], 'the third second in a row: one step (2 x 0.8)');
  assert.equal(a.ratio, 1.6);
});

test('while it stays slow and every step helps, it goes on, with rests in between, down to a floor', () => {
  const a = createAdaptiveRes({ max: 2, min: 0.75 });
  assert.deepEqual(feed(a, gpu(16), 80), [1.6, 1.28, 1.02, 0.82, 0.75]);
  assert.equal(a.ratio, 0.75);
  assert.deepEqual(feed(a, gpu(16), 30), [], 'never below the floor');
});

test('after a change it holds still for a few seconds whatever the fps, and then checks that it helped before counting again', () => {
  const a = createAdaptiveRes({ max: 2, hold: 3, down: 2.5, probe: 1.5 });
  const t1 = until(a, gpu(16));
  assert.equal(a.ratio, 1.6);
  const t2 = until(a, gpu(16));
  assert.ok(Math.abs(t2 - (3 + 1.5 + 2.5)) <= 0.5, `the next step needs the rest (3 s), the check (1.5 s) and the slow stretch (2.5 s): ${t2} s after ${t1} s`);
});

test('with room to spare for long enough it steps back up, one step at a time, never above the top', () => {
  const a = createAdaptiveRes({ max: 2, up: 12, hold: 3, probe: 1.5 });
  while (a.ratio > 1.28) a.sample(gpu(16)(a.ratio), 0.5);
  assert.equal(a.ratio, 1.28);
  const t = until(a, 60);
  assert.ok(t >= 16 && t <= 17.5, `up after the rest (3), the check (1.5) and twelve calm seconds: ${t} s`);
  assert.equal(a.ratio, 1.6);
  const t2 = until(a, 60);
  assert.ok(t2 >= 14.5 && t2 <= 16.5, `and again ${t2} s`);
  assert.equal(a.ratio, 2);
  assert.deepEqual(feed(a, 60, 120), [], 'at the top it stays');
});

test('the middle ground (between "slow" and "room to spare") changes nothing and clears both counters', () => {
  const a = createAdaptiveRes({ max: 2 });
  for (let i = 0; i < 8; i++) { feed(a, 20, 2); feed(a, 50, 1); } // slow, slow, then an in-between moment: never three slow seconds in a row
  assert.equal(a.ratio, 2);
});

test('a step down that did NOT help (30-frame display, a slow processor) is taken back, and the game is left alone from then on', () => {
  const a = createAdaptiveRes({ max: 2 });
  const changes = feed(a, 28, 30); // the fps stays at 28 whatever the resolution
  assert.deepEqual(changes, [1.6, 2], 'down, a short check, back up');
  assert.equal(a.ratio, 2); assert.equal(a.locked, true);
  assert.deepEqual(feed(a, 28, 120), [], 'and no more steps down this game');
  assert.deepEqual(feed(a, 10, 60), [], 'however slow it gets');
});

test('a step that helped a little is enough; one that helped nothing is not (12 % better counts)', () => {
  const ok = createAdaptiveRes({ max: 2 });
  feed(ok, (r) => (r < 2 ? 25 : 20), 8.5); // the step (2.5 s), the rest (3 s), the check (1.5 s)
  assert.ok(ok.ratio === 1.6 && !ok.locked, '20 -> 25 fps is a quarter better: it checked and kept the step');
  const no = createAdaptiveRes({ max: 2 });
  feed(no, (r) => (r < 2 ? 21 : 20), 14);
  assert.equal(no.locked, true, '20 -> 21 fps is not enough');
  assert.equal(no.ratio, 2);
});

test('garbage measurements are ignored; reset goes back to the top (a new screen) and forgives', () => {
  const a = createAdaptiveRes({ max: 1 });
  assert.equal(a.sample(NaN), null); assert.equal(a.sample(undefined), null); assert.equal(a.sample(10, 0), null); assert.equal(a.sample(10, -1), null);
  feed(a, 10, 3);
  assert.equal(a.ratio, 0.8);
  assert.equal(a.reset(2), 2);
  assert.equal(a.ratio, 2); assert.equal(a.max, 2); assert.equal(a.locked, false);
  assert.equal(createAdaptiveRes({ max: 0.5, min: 0.75 }).ratio, 0.75, 'a floor above the top: the floor');
});

console.log(`${n} adaptive-resolution tests passed`);
