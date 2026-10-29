// "Ori, Can You...?" — the Sababa Cup, a car racing league [experimental] (pure): seven rivals up a ladder, driver XP and levels, what a win, a rematch and a loss give, the board, the quest templates.      node scripts/test-favors-league.mjs
import assert from 'node:assert/strict';
import { RIVALS, RIVAL_IDS, LEVEL_XP, MAX_LEVEL, TOP_PER_LEVEL, LOSS_XP, LOSS_PRIZE, REMATCH, levelOf, topBonus, board, result, templateOf, leagueTemplates, leagueIdOf } from '../src/game3d/favors/league.js';
import { CAST, TEMPLATES } from '../src/game3d/favors/content.js';
import { RACE } from '../src/game3d/favors/play-content.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;

test('seven rivals, people Ori knows, each faster and richer than the one before, in kind plain words', () => {
  assert.equal(RIVALS.length, 7);
  assert.equal(new Set(RIVAL_IDS).size, 7);
  for (const r of RIVALS) {
    assert.ok(CAST[r.id], `${r.id} is somebody in the cast`);
    assert.equal(r.rel, CAST[r.id].rel, `${r.id}: the race counts for the friends / work / hobbies he belongs to`);
    assert.ok(/^#[0-9a-f]{6}$/i.test(r.color));
    assert.ok(['hatch', 'van', 'sedan', 'ori'].includes(r.car.kind) && Number.isInteger(r.car.color) && r.car.color >= 0 && r.car.color <= 0xffffff, `${r.id} drives a car the garage can build`);
    for (const t of [r.name, r.title, r.line]) { assert.ok(t.length >= 3 && t.length <= 60, t); assert.ok(!BANNED.test(t) && !/\p{Extended_Pictographic}/u.test(t), t); }
  }
  for (let i = 1; i < RIVALS.length; i++) { const a = RIVALS[i - 1]; const b = RIVALS[i]; assert.ok(b.speed > a.speed && b.prize > a.prize && b.xp > a.xp && b.need >= a.need, `${b.id} is a step up from ${a.id}`); }
  assert.ok(RIVALS[0].speed < RACE.rival[0], 'the first rival is slower than the first story race');
  assert.ok(RIVALS[6].speed >= 21 && RIVALS[6].speed <= 23);
  assert.equal(RIVALS[6].car.kind, 'ori', 'the Beast is a cousin of Ori\'s own car');
});

test('driver XP and levels: seven levels, the thresholds climb, the bar says how far', () => {
  assert.equal(MAX_LEVEL, 7);
  assert.deepEqual(LEVEL_XP.slice(0, 3), [0, 50, 130]);
  for (let i = 1; i < LEVEL_XP.length; i++) assert.ok(LEVEL_XP[i] > LEVEL_XP[i - 1]);
  assert.deepEqual([levelOf(0).level, levelOf(49).level, levelOf(50).level, levelOf(779).level, levelOf(780).level, levelOf(99999).level], [1, 1, 2, 6, 7, 7]);
  assert.deepEqual(levelOf(90), { level: 2, xp: 90, from: 50, to: 130, pct: 50 });
  assert.equal(levelOf(1000).pct, 100);
  for (const bad of [NaN, -5, null, undefined, 'x']) assert.equal(levelOf(bad).level, 1, String(bad));
  assert.equal(topBonus(0), 1);
  assert.ok(Math.abs(topBonus(780) - (1 + TOP_PER_LEVEL * 6)) < 1e-9);
  assert.ok(topBonus(780) <= 1.1, 'a driver is a little better, never a different car');
});

test('the board: the next rival, the beaten ones with a star, the locked ones say why, the stakes are on every row', () => {
  let b = board(0, {});
  assert.deepEqual(b.map((r) => r.state), ['next', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
  assert.equal(b[1].why, 'Beat Moti first');
  assert.deepEqual(b[0].win, { prize: 40, xp: 30 });
  b = board(0, { moti: true });
  assert.deepEqual(b.slice(0, 3).map((r) => r.state), ['won', 'next', 'locked']);
  assert.equal(b[2].why, 'Beat Albert first');
  assert.deepEqual(b[0].win, { prize: 20, xp: 15 }, 'a rematch pays half');
  b = board(60, { moti: true, albert: true });
  assert.deepEqual([b[2].state, b[2].open], ['next', true], 'level 2 opens Roee once Albert is beaten');
  b = board(0, { moti: true, albert: true });
  assert.deepEqual([b[2].state, b[2].why], ['locked', 'Driver level 2'], 'beaten the one before, but not yet good enough');
  assert.equal(board(0, Object.fromEntries(RIVAL_IDS.map((id) => [id, true]))).every((r) => r.beaten), true);
});

test('a win pays the prize and the XP; a rematch half; a loss a little XP and a few peaches; the level steps up', () => {
  const w = result(0, 'moti', 1);
  assert.deepEqual([w.win, w.xp, w.prize, w.level, w.up], [true, 30, 40, 1, false]);
  const w2 = result(30, 'albert', 1);
  assert.deepEqual([w2.xp, w2.level, w2.up, w2.total], [38, 2, true, 68]);
  const again = result(0, 'moti', 1, true);
  assert.deepEqual([again.xp, again.prize], [Math.round(30 * REMATCH), Math.round(40 * REMATCH)]);
  const l = result(0, 'dov', 2);
  assert.deepEqual([l.win, l.xp, l.prize], [false, Math.round(56 * LOSS_XP), LOSS_PRIZE]);
  assert.deepEqual(result(0, 'dov', 2, true), l, 'a loss is the same whether he was beaten before or not');
  assert.ok(l.xp > 0 && l.prize > 0, 'nobody loses for nothing');
  assert.equal(result(0, 'nobody', 1), null);
});

test('the quest templates are the existing race with a rival: his speed, his name, his car, the prize; an optional favour that costs nothing to leave', () => {
  const t = leagueTemplates();
  assert.equal(t.length, 7);
  for (const [i, tpl] of t.entries()) {
    const r = RIVALS[i];
    assert.equal(tpl.id, `league-${r.id}`);
    assert.deepEqual([tpl.mech, tpl.giver, tpl.at, tpl.setpiece, tpl.optional, tpl.rel], ['race', r.id, 'workshop', true, true, r.rel]);
    assert.deepEqual(tpl.mp, { rival: r.speed, who: r.name, prize: r.prize, consolation: LOSS_PRIZE, car: r.car });
    assert.ok(tpl.title.startsWith('The Sababa Cup') && tpl.mins >= 90 && tpl.rewardBoost <= 0.2, 'a race is not a favour: it hardly counts for the rank');
    assert.ok(TEMPLATES.some((x) => x.id === tpl.id), `${tpl.id} is in the game's list of favours`);
  }
  assert.equal(templateOf(RIVALS[0]).doText, 'Race Moti');
  assert.equal(leagueIdOf('league-moti'), 'moti');
  for (const bad of ['dov-race', 'league-', 'league-nobody', 'league-moti2', null, undefined, 3]) assert.equal(leagueIdOf(bad), null, String(bad));
});

console.log(`${n} league tests passed`);
