// "Ori, Can You...?" — the life of Ori without a phone (pure): the goals that guide him one at a time, how a hello is answered and what love it gives, the games on the
// office computer.      node scripts/test-favors-life.mjs
import assert from 'node:assert/strict';
import { GOALS, goalList, currentGoal, checkGoals } from '../src/game3d/favors/goals.js';
import { HELLOS, AGAIN, BY_CAST, replyFor, helloFor, loveFor } from '../src/game3d/favors/greet.js';
import { createCampaign, safeStorage } from '../src/game3d/favors/campaign.js';
import { CAST, PLACES } from '../src/game3d/favors/content.js';
import { createTetrisRun, createRun2048, peachesFor, GAMES } from '../src/game3d/favors/arcade.js';
import { LANDMARKS, CAR, PLACE_LINES, lineFor } from '../src/game3d/favors/places-guide.js';
import { ICON_NAMES } from '../src/game3d/favors/map2d.js';
import { BANNED } from './test-favors-persona.mjs';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const mem = () => { const d = {}; return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; }, removeItem: (k) => { delete d[k]; } }; };
const fresh = () => createCampaign({ storage: safeStorage(mem()), fresh: true });

test('the goals: one at a time, in order, each with a place that exists; the last one stays hidden until the champion has fallen', () => {
  const c = fresh();
  assert.equal(currentGoal(c).id, 'hello');
  for (const g of GOALS) { assert.ok(g.title.length < 60 && g.hint.length < 50, g.id); if (g.place) assert.ok(PLACES[g.place], `${g.id}: ${g.place}`); assert.ok(g.reward.peaches >= 0 && g.reward.xp >= 0); }
  assert.ok(!goalList(c).find((g) => g.id === 'secret').shown, 'nobody knows the last one');
  c.state.boxer.reveal = true;
  assert.ok(goalList(c).find((g) => g.id === 'secret').shown);
});

test('goals are done by doing things: hellos, the office, the computer, a win, love, the ladder; each pays once', () => {
  const c = fresh();
  assert.deepEqual(checkGoals(c), []);
  c.state.progress.hellos = 5;
  assert.deepEqual(checkGoals(c).map((g) => g.id), ['hello']);
  assert.deepEqual(checkGoals(c), [], 'never twice');
  assert.equal(currentGoal(c).id, 'ringfind', 'the ring comes right after the hellos: it is the heart of the game');
  c.state.progress.ringSeen = 1;
  assert.deepEqual(checkGoals(c).map((g) => g.id), ['ringfind']);
  assert.equal(currentGoal(c).id, 'office');
  c.state.progress.shiloHi = 1; c.state.progress.arcade = 1;
  assert.deepEqual(checkGoals(c).map((g) => g.id), ['office', 'arcade']);
  c.state.boxer.beaten.push('moti');
  assert.deepEqual(checkGoals(c).map((g) => g.id), ['ring1']);
  c.addLove(30);
  assert.deepEqual(checkGoals(c).map((g) => g.id), ['love25']);
  c.state.boxer.beaten.push('albert', 'inspector');
  assert.deepEqual(checkGoals(c).map((g) => g.id), ['ladder3']);
  c.state.boxer.beaten.push('dov', 'coach');
  c.state.boxer.reveal = true;
  assert.deepEqual(checkGoals(c).map((g) => g.id), ['champ']);
  assert.equal(currentGoal(c).id, 'secret');
  c.state.boxer.beaten.push('shilo');
  assert.deepEqual(checkGoals(c).map((g) => g.id), ['secret']);
  assert.equal(currentGoal(c), null, 'all done: free play');
});

test('hello: everybody in the cast answers in their own way; Ori\'s own words are warm; a repeat is a joke, not love', () => {
  for (const id of Object.keys(CAST)) if (id !== 'self') assert.ok(BY_CAST[id] && BY_CAST[id].length >= 2, `${id} has lines`);
  for (const l of [...HELLOS, ...AGAIN]) { assert.ok(!BANNED.test(l), l); assert.ok(l.length <= 40, l); }
  for (const [id, lines] of Object.entries(BY_CAST)) for (const l of lines) assert.ok(l.length <= 60 && !/[\u{1F300}-\u{1FAFF}]/u.test(l), `${id}: ${l}`);
  const seen = new Set();
  for (let s = 1; s < 40; s++) seen.add(replyFor('moti', { seed: s }));
  assert.ok(seen.size >= 2, 'not always the same line');
  assert.ok(AGAIN.includes(replyFor('moti', { first: false, seed: 3 })));
  assert.ok(replyFor('stranger:4', { hour: 8, seed: 1 }).length > 3);
  assert.ok(helloFor(1).length > 1);
  assert.ok(loveFor('moti', true) > loveFor('stranger:3', true) && loveFor('stranger:3', true) > 0);
  assert.equal(loveFor('moti', false), 0);
});

test('the games on the office computer: blocks fall and lock, lines clear, the run ends with a score that pays; 2048 slides and merges', () => {
  const t = createTetrisRun({ seed: 7 });
  let drops = 0;
  while (!t.state.over && drops < 400) { t.move(drops % 3 - 1); t.rotate(1); t.hardDrop(); drops++; }
  assert.ok(t.state.over, 'a run always ends');
  assert.ok(t.state.score > 0 && drops > 5);
  const v = t.view();
  assert.equal(v.rows.length, 20); assert.equal(v.rows[0].length, 10);
  const calm = createTetrisRun({ seed: 3 });
  const y0 = calm.state.piece.y;
  calm.update(5);
  assert.ok(calm.state.piece.y > y0 || calm.state.board.some((r) => r.some(Boolean)), 'gravity pulls the piece down');
  const q = createRun2048({ seed: 5 });
  assert.equal(q.view().values.filter(Boolean).length, 2);
  let moved = 0;
  for (let i = 0; i < 200 && !q.state.over; i++) if (q.move(['left', 'down', 'right', 'up'][i % 4])) moved++;
  assert.ok(moved > 20 && q.state.score > 0, `${moved} moves, ${q.state.score} points`);
  assert.equal(GAMES.length, 2);
  assert.ok(peachesFor('tetris', 0) >= 2 && peachesFor('tetris', 5000) > peachesFor('tetris', 500) && peachesFor('2048', 1e9) <= 60);
});

test('the guide: the stars of the map are real places with a known icon, his car too, every place has one short warm line, and the ring is one of the stars', () => {
  for (const l of LANDMARKS) { assert.ok(PLACES[l.place], l.place); assert.ok(ICON_NAMES.includes(l.icon), l.icon); assert.ok(l.what.length <= 64 && l.short.length <= 7 && /^#[0-9a-f]{6}$/i.test(l.color), l.place); assert.ok(!BANNED.test(l.what), l.what); }
  assert.ok(ICON_NAMES.includes(CAR.icon) && CAR.short.length <= 7 && !BANNED.test(CAR.what));
  assert.deepEqual(Object.keys(PLACE_LINES).sort(), Object.keys(PLACES).sort(), 'a line for every place, and none for a place that is not there');
  for (const [id, line] of Object.entries(PLACE_LINES)) { assert.ok(line.length > 8 && line.length <= 64, id); assert.ok(!BANNED.test(line), line); }
  assert.equal(lineFor('court'), PLACE_LINES.court);
  assert.equal(lineFor('nowhere'), '');
  assert.ok(LANDMARKS[0].place === 'court' && PLACES.court.name === 'The Ring', 'the ring comes first, and the court is called by its name');
  assert.ok(GOALS.find((g) => g.id === 'ringfind') && GOALS.findIndex((g) => g.id === 'ringfind') === 1, 'finding the ring is the second goal');
});

console.log(`${n} life tests passed`);
