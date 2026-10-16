// The banner rate limiter (pure).  node scripts/test-notify-limiter.mjs
import assert from 'node:assert/strict';
import { createLimiter, STYLES, STYLE_IDS } from '../src/core/notify-limiter.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const S = 1000;

test('Quiet: nothing in the first 6 s after entering, then one banner', () => {
  const l = createLimiter('quiet');
  l.entered(0);
  assert.equal(l.decide({}, 1 * S), false);
  assert.equal(l.decide({}, 5.9 * S), false);
  assert.equal(l.decide({}, 6 * S), true);
  assert.equal(l.shown, 1);
});
test('Quiet: at least 25 s between two banners', () => {
  const l = createLimiter('quiet');
  l.entered(0);
  assert.equal(l.decide({}, 10 * S), true);
  assert.equal(l.decide({}, 20 * S), false);
  assert.equal(l.decide({}, 34.9 * S), false);
  assert.equal(l.decide({}, 35 * S), true);
});
test('Quiet: at most 3 banners per visit; a new visit starts the count again', () => {
  const l = createLimiter('quiet');
  l.entered(0);
  let t = 10 * S;
  const got = [];
  for (let i = 0; i < 8; i++, t += 30 * S) got.push(l.decide({}, t));
  assert.deepEqual(got, [true, true, true, false, false, false, false, false]);
  assert.equal(l.held, 5);
  l.entered(t);
  assert.equal(l.decide({}, t + 2 * S), false, 'the quiet window applies again');
  assert.equal(l.decide({}, t + 7 * S), true);
  assert.equal(l.shown, 1);
});
test('one banner at a time: while one is on screen the next is held back (in every style that limits)', () => {
  for (const style of ['quiet', 'normal']) {
    const l = createLimiter(style);
    l.entered(0);
    l.setVisible(1);
    assert.equal(l.decide({}, 100 * S), false, style);
    l.setVisible(0);
    assert.equal(l.decide({}, 100 * S), true, style);
  }
});
test("level 'quiet' (common achievements) is never a banner, 'urgent' skips the gap but not the rest", () => {
  const l = createLimiter('quiet');
  l.entered(0);
  assert.equal(l.decide({ level: 'quiet' }, 100 * S), false);
  assert.equal(l.decide({}, 100 * S), true);
  assert.equal(l.decide({ level: 'urgent' }, 101 * S), true, 'urgent ignores the 25 s gap');
  l.setVisible(1);
  assert.equal(l.decide({ level: 'urgent' }, 102 * S), false, 'but not the one-at-a-time rule');
  l.setVisible(0);
  assert.equal(l.decide({ level: 'urgent' }, 103 * S), true);
  assert.equal(l.decide({ level: 'urgent' }, 104 * S), false, 'and the per-visit cap holds (3)');
});
test('Off: never a banner, even urgent ones', () => {
  const l = createLimiter('off');
  l.entered(0);
  for (let t = 0; t < 600 * S; t += 7 * S) assert.equal(l.decide({ level: 'urgent' }, t), false);
  assert.equal(l.shown, 0);
});
test('Normal is looser than Quiet: 3 s quiet window, 7 s gap, up to 8 per visit', () => {
  const l = createLimiter('normal');
  l.entered(0);
  assert.equal(l.decide({}, 2 * S), false);
  assert.equal(l.decide({}, 3 * S), true);
  assert.equal(l.decide({}, 9 * S), false);
  assert.equal(l.decide({}, 10 * S), true);
  let t = 20 * S;
  let count = 2;
  for (let i = 0; i < 10; i++, t += 8 * S) if (l.decide({}, t)) count++;
  assert.equal(count, STYLES.normal.maxPerEntry);
});
test('a fresh profile that is flooded sees at most 1 banner in its first 30 s on Quiet', () => {
  const l = createLimiter('quiet');
  l.entered(0);
  let banners = 0;
  for (let t = 0; t < 30 * S; t += 500) if (l.decide({ title: 'x' }, t)) banners++; // a notification every half second
  assert.equal(banners, 1);
});
test('style can be switched on the fly and the ids are the three the settings offer', () => {
  const l = createLimiter();
  assert.equal(l.style, 'quiet');
  l.setStyle('normal');
  assert.equal(l.style, 'normal');
  l.setStyle('nonsense');
  assert.equal(l.style, 'quiet');
  assert.deepEqual(STYLE_IDS, ['quiet', 'normal', 'off']);
});

test('resetHistory forgets old timestamps (the clock was swapped), scale shrinks every wait', () => {
  const l = createLimiter('quiet');
  l.entered(1e6);
  assert.equal(l.decide({}, 1e6 + 7 * S), true);
  l.resetHistory();
  assert.equal(l.decide({}, 100), true, 'no quiet window, no gap after a reset');
  const f = createLimiter('quiet');
  f.setScale(0.1);
  f.entered(0);
  assert.equal(f.decide({}, 0.5 * S), false);
  assert.equal(f.decide({}, 0.7 * S), true);
  assert.equal(f.decide({}, 3.3 * S), true, 'the 25 s gap became 2.5 s');
  assert.equal(f.decide({}, 4 * S), false);
});

console.log(`${n} notify limiter tests passed`);
