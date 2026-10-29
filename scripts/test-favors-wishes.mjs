// "Ori, Can You...?" — the daily wishes [experimental] (pure): the pool, the draw (one of each tier, the same day the same three, never yesterday's), the rows, what is done, the bonus.      node scripts/test-favors-wishes.mjs
import assert from 'node:assert/strict';
import { METRICS, readMetrics, POOL, REWARD, BONUS, LOG_DAYS, wishOf, wordsOf, pickWishes, emptyState, newDay, rows, settle, stickers, closeDay } from '../src/game3d/favors/wishes.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;
const metrics0 = Object.fromEntries(METRICS.map((m) => [m, 0]));

test('the pool: every tier has choices, the numbers make sense, every wish says what it is in kind, plain words', () => {
  assert.equal(new Set(POOL.map((w) => w.id)).size, POOL.length, 'unique ids');
  for (const tier of [1, 2, 3]) assert.ok(POOL.filter((w) => w.tier === tier).length >= 3, `tier ${tier} has choices`);
  for (const w of POOL) {
    const [lo, hi, step] = w.n;
    assert.ok(lo >= 1 && hi >= lo && step >= 1, w.id);
    assert.ok(w.metric === 'places' || METRICS.includes(w.metric), `${w.id}: a metric the game counts`);
    for (let k = lo; k <= hi; k += step) { const text = w.words(k); assert.ok(text.length > 8 && text.length < 70, text); assert.ok(!BANNED.test(text) && !/\p{Extended_Pictographic}/u.test(text), text); }
  }
  assert.deepEqual(REWARD, { 1: 6, 2: 12, 3: 20 });
  assert.ok(BONUS.peaches > REWARD[3] && BONUS.love >= 1);
});

test('three wishes a day: one of each tier, the same seed and day give the same three, a new day gives others', () => {
  const a = pickWishes({ seed: 7, day: 3 });
  assert.equal(a.length, 3);
  assert.deepEqual(a.map((c) => wishOf(c).tier), [1, 2, 3]);
  assert.deepEqual(a, pickWishes({ seed: 7, day: 3 }));
  const days = new Set(Array.from({ length: 30 }, (_, d) => pickWishes({ seed: 7, day: d + 1 }).join()));
  assert.ok(days.size >= 12, `${days.size} different days out of 30`);
  const seeds = new Set(Array.from({ length: 20 }, (_, s) => pickWishes({ seed: s + 1, day: 1 }).join()));
  assert.ok(seeds.size >= 6, 'another game, other wishes');
  for (let d = 1; d <= 40; d++) for (const c of pickWishes({ seed: 3, day: d })) { const w = wishOf(c); assert.ok(w && w.n >= w.n && c === `${w.id}:${w.n}`); }
});

test('yesterday\'s wishes are not drawn again (when the tier has another)', () => {
  for (let d = 2; d <= 40; d++) {
    const yest = pickWishes({ seed: 5, day: d - 1 }).map((c) => wishOf(c).id);
    const today = pickWishes({ seed: 5, day: d, avoid: yest }).map((c) => wishOf(c).id);
    assert.ok(today.every((id) => !yest.includes(id)), `${d}: ${yest} then ${today}`);
  }
  const fresh = newDay({ seed: 5, day: 4, metrics: metrics0, prev: newDay({ seed: 5, day: 3, metrics: metrics0 }) });
  assert.equal(fresh.day, 4);
  assert.deepEqual(fresh.done, {});
  assert.equal(fresh.bonus, false);
});

test('a wish code is read back with its number; anything else is ignored', () => {
  assert.equal(wishOf('drive:600').n, 600);
  assert.equal(wordsOf(wishOf('hello:4')), 'Say hello to 4 people');
  assert.equal(wordsOf(wishOf('hello-am:3')), 'Say hello to 3 people before noon');
  for (const bad of ['', 'nope:3', 'hello', 'hello:', 'hello:x', 'hello:123456', null, undefined, 'drive:-4']) assert.equal(wishOf(bad), null, String(bad));
});

test('the numbers the game counts are read off the progress and the boxer', () => {
  assert.deepEqual(readMetrics({}), metrics0);
  const m = readMetrics({ p: { hellos: 7, driven: 512.9, arcade: 2, cafeRuns: 1, parcels: 3, evCount: 4, kos: 5, perfect: 6 }, b: { wins: 8, fights: 9 } });
  assert.deepEqual(m, { hellos: 7, wins: 8, fights: 9, driven: 512, arcade: 2, cafeRuns: 1, parcels: 3, evCount: 4, kos: 5, perfect: 6 });
});

test('rows: progress since the morning, clamped; the places are counted for today only', () => {
  const st = { day: 1, list: ['hello:4', 'drive:600', 'win:1'], base: { ...metrics0, hellos: 10, driven: 100 }, done: {}, places: {}, bonus: false };
  let r = rows(st, { ...metrics0, hellos: 12, driven: 400 }, 9);
  assert.deepEqual(r.map((x) => [x.id, x.have, x.n, x.done]), [['hello', 2, 4, false], ['drive', 300, 600, false], ['win', 0, 1, false]]);
  assert.deepEqual(r.map((x) => x.pct), [50, 50, 0]);
  r = rows(st, { ...metrics0, hellos: 30, driven: 9999, wins: 3 }, 9);
  assert.deepEqual(r.map((x) => [x.have, x.done]), [[4, true], [600, true], [1, true]], 'clamped at the wish (the third counts from a base of 0 here)');
  r = rows({ ...st, base: { ...st.base, wins: 3 } }, { ...metrics0, wins: 3 }, 9);
  assert.deepEqual([r[2].have, r[2].done], [0, false], 'a fight won before the morning does not count');
  r = rows({ ...st, list: ['places:2'], places: { cafe: true } }, metrics0, 9);
  assert.deepEqual([r[0].have, r[0].done], [1, false]);
  r = rows({ ...st, list: ['places:2'], places: { cafe: true, home: true } }, metrics0, 9);
  assert.equal(r[0].done, true);
  assert.deepEqual(rows({ ...st, list: ['nope:3', 'win:1'] }, metrics0, 9).map((x) => x.id), ['win'], 'an unknown wish is dropped');
});

test('a wish with a time says "maybe tomorrow" after it, and a wish already done stays done', () => {
  const st = { day: 1, list: ['hello-am:3'], base: { ...metrics0 }, done: {}, places: {}, bonus: false };
  assert.equal(rows(st, { ...metrics0, hellos: 1 }, 11.9)[0].late, false);
  assert.equal(rows(st, { ...metrics0, hellos: 1 }, 12)[0].late, true);
  assert.deepEqual([rows(st, { ...metrics0, hellos: 3 }, 11.5)[0].done, rows(st, { ...metrics0, hellos: 3 }, 11.5)[0].late], [true, false], 'done in time');
  assert.deepEqual([rows(st, { ...metrics0, hellos: 3 }, 15)[0].done, rows(st, { ...metrics0, hellos: 3 }, 15)[0].late], [false, true], 'the numbers reached after noon do not count: maybe tomorrow');
  const marked = { ...st, done: { 'hello-am': true } };
  assert.deepEqual([rows(marked, metrics0, 20)[0].done, rows(marked, metrics0, 20)[0].late], [true, false], 'marked in time stays done, never late');
});

test('settle: a wish is paid once; the bonus comes once, with the third', () => {
  const st = { day: 1, list: ['hello:3', 'coffee:1', 'win:1'], base: { ...metrics0 }, done: {}, places: {}, bonus: false };
  let s = settle(st, { ...metrics0, hellos: 3 }, 9);
  assert.deepEqual(s.newly.map((r) => r.id), ['hello']);
  assert.equal(s.full, false);
  st.done.hello = true;
  assert.deepEqual(settle(st, { ...metrics0, hellos: 3 }, 9).newly, [], 'not paid twice');
  s = settle(st, { ...metrics0, hellos: 3, cafeRuns: 1, wins: 1 }, 14);
  assert.deepEqual(s.newly.map((r) => r.id), ['coffee', 'win']);
  assert.equal(s.full, true);
  st.done.coffee = true; st.done.win = true; st.bonus = true;
  assert.equal(settle(st, { ...metrics0, hellos: 3, cafeRuns: 1, wins: 1 }, 14).full, false, 'the bonus is paid once');
});

test('the stickers: today\'s, and the days before (the last two weeks)', () => {
  assert.deepEqual(stickers({ done: { a: true, b: true } }, [3, 1]), { today: 2, days: [3, 1] });
  assert.equal(stickers(emptyState(), Array.from({ length: 30 }, () => 2)).days.length, LOG_DAYS);
  assert.equal(closeDay({ done: { a: true, b: true, c: true, d: true } }), 3);
  assert.equal(closeDay(null), 0);
  assert.deepEqual(emptyState(), { day: 0, list: [], base: {}, done: {}, places: {}, bonus: false });
});

console.log(`${n} wishes tests passed`);
