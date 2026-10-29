// "Ori, Can You...?" — the first steps and "what now?" [experimental] (pure): what a new player learns first, how it ticks itself off, and the words of the help panel.      node scripts/test-favors-guide.mjs
import assert from 'node:assert/strict';
import { KEYS, TOUR, tourSteps, tourDone, whatNow } from '../src/game3d/favors/guide.js';
import { createCampaign, safeStorage } from '../src/game3d/favors/campaign.js';
import { goalList, currentGoal } from '../src/game3d/favors/goals.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;
const EMOJI = /[\u{1F300}-\u{1FAFF}☀-➿]/u;
const mem = () => { const d = {}; return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } }; };

test('three first steps: walk, say hello, open the map - each with its keys and a kind word', () => {
  assert.deepEqual(TOUR.map((t) => t.id), ['walk', 'hello', 'map']);
  for (const t of TOUR) {
    assert.ok(t.text.length >= 6 && t.text.length <= 30 && t.extra.length >= 8 && t.extra.length <= 70 && t.keys.length >= 1, t.id);
    for (const s of [t.text, t.extra]) { assert.ok(!BANNED.test(s) && !EMOJI.test(s), s); }
  }
  assert.deepEqual(TOUR[0].keys, ['W', 'A', 'S', 'D']); assert.deepEqual(TOUR[1].keys, ['H']); assert.deepEqual(TOUR[2].keys, ['M']);
});

test('they tick themselves off: four metres on foot, one hello, the map once', () => {
  const none = tourSteps({});
  assert.deepEqual(none.map((s) => s.done), [false, false, false]);
  assert.equal(tourDone(none), false);
  assert.deepEqual(tourSteps({ moved: 3.9 }).map((s) => s.done), [false, false, false]);
  assert.deepEqual(tourSteps({ moved: 4 }).map((s) => s.done), [true, false, false]);
  assert.deepEqual(tourSteps({ hellos: 1 }).map((s) => s.done), [false, true, false]);
  assert.deepEqual(tourSteps({ mapOpened: true }).map((s) => s.done), [false, false, true]);
  const all = tourSteps({ moved: 40, hellos: 3, mapOpened: true });
  assert.ok(tourDone(all) && all.every((s) => s.done));
  assert.equal(tourDone([]), false, 'no steps is not "done"');
  assert.deepEqual(tourSteps(null === undefined ? {} : undefined).length, 3, 'no state at all is a fresh start');
});

test('"what now?": the goal, where it is, how far along; a goal with a place can be followed, one without cannot', () => {
  const idle = whatNow({});
  assert.ok(idle.title.length > 10 && idle.hint.length > 20 && !idle.canTrack && idle.progress === '');
  const hello = whatNow({ goal: { title: 'Say hello to 5 people', hint: 'Walk up to someone and press H', have: 3, need: 5, place: null }, placeName: null, tracked: null });
  assert.deepEqual({ title: hello.title, progress: hello.progress, where: hello.where, canTrack: hello.canTrack }, { title: 'Say hello to 5 people', progress: '3 / 5', where: 'You can do it anywhere.', canTrack: false });
  const ring = whatNow({ goal: { title: 'Find The Ring', hint: 'Follow the beam, or press M for the map', have: 0, need: 1, place: 'court' }, placeName: 'The Ring', tracked: null });
  assert.deepEqual({ progress: ring.progress, where: ring.where, canTrack: ring.canTrack, tracking: ring.tracking }, { progress: '', where: 'It is at The Ring.', canTrack: true, tracking: false });
  assert.equal(whatNow({ goal: { title: 'x', have: 0, need: 1, place: 'court' }, placeName: 'The Ring', tracked: 'court' }).tracking, true);
  assert.equal(whatNow({ goal: { title: 'x', have: 9, need: 5 } }).progress, '5 / 5', 'never more than the goal needs');
  assert.equal(whatNow({ goal: { title: 'x', have: -2, need: 5 } }).progress, '0 / 5');
});

test('every real goal of the game gives the panel something to say, on a fresh game and on the way', () => {
  const c = createCampaign({ storage: safeStorage(mem()), fresh: true });
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    const g = currentGoal(c);
    if (!g) break;
    const d = whatNow({ goal: g, placeName: g.place ? 'Somewhere' : null, tracked: null });
    assert.ok(d.title.length > 5 && d.hint.length > 5 && d.where.length > 5, g.id);
    for (const s of [d.title, d.hint, d.where]) assert.ok(!BANNED.test(s) && !EMOJI.test(s), s);
    seen.add(g.id);
    c.state.progress.goalsDone.push(g.id); // (done, on to the next)
  }
  assert.ok(seen.size >= 6, `${seen.size} goals walked through`);
  assert.equal(goalList(c).length >= 6, true);
});

test('the keys list: short, no repeats, and it has the ones the game is played with', () => {
  assert.ok(KEYS.length >= 8 && KEYS.length <= 12);
  assert.equal(new Set(KEYS.map(([k]) => k)).size, KEYS.length);
  const keys = KEYS.map(([k]) => k).join(' ');
  for (const k of ['W A S D', 'Shift', 'H', 'Space', 'M', 'Tab', 'Esc', '?']) assert.ok(keys.includes(k), k);
  for (const [k, v] of KEYS) { assert.ok(k.length <= 8 && v.length >= 3 && v.length <= 22, `${k} ${v}`); assert.ok(!BANNED.test(v), v); }
});

test('the first steps are remembered on the save (a counter), so they come once', () => {
  const st = mem();
  const c = createCampaign({ storage: safeStorage(st), fresh: true });
  assert.ok(!c.state.progress.tour);
  c.state.progress.tour = 1; c.save();
  assert.equal(createCampaign({ storage: safeStorage(st) }).state.progress.tour, 1);
});

console.log(`${n} guide tests passed`);
