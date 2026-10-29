// "Ori, Can You...?" — the achievements [experimental] (pure): the roster, what unlocks each one, that earned ones stay, and that every one can be earned.      node scripts/test-favors-trophies.mjs
import assert from 'node:assert/strict';
import { TROPHIES, CAST_IDS, evaluate, newTrophies } from '../src/game3d/favors/trophies.js';
import { tallyFight } from '../src/game3d/favors/career.js';
import { sanitizeSave } from '../src/game3d/favors/save.js';
import { GAMES } from '../src/game3d/favors/arcade.js';
import { STAMPS } from '../src/game3d/favors/stamps.js';
import { GIFT_IDS } from '../src/game3d/favors/gifts.js';
import { GOLDEN } from '../src/game3d/favors/play-content.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;
const EMOJI = /[\u{1F300}-\u{1FAFF}☀-➿]/u;
const SHAPES = ['heart', 'star', 'bolt', 'diamond', 'shield', 'ring', 'peach'];
const ctx0 = (o = {}) => ({ p: {}, b: { level: 1, wins: 0, fights: 0, beaten: [] }, love: 0, day: 1, golden: 0, lifetime: 0, ...o });
const done = (c, earned = []) => evaluate(c, earned).filter((t) => t.done).map((t) => t.id);

test('the roster: about thirty, each with a short warm name, how and line; a shape and a colour; something real to reach', () => {
  assert.ok(TROPHIES.length >= 28 && TROPHIES.length <= 48, `${TROPHIES.length} trophies`);
  assert.equal(new Set(TROPHIES.map((t) => t.id)).size, TROPHIES.length, 'unique ids');
  for (const t of TROPHIES) {
    assert.ok(/^[a-z][a-z0-9]*$/.test(t.id), t.id);
    assert.ok(t.name.length >= 3 && t.name.length <= 28, `name: ${t.name}`);
    assert.ok(t.how.length >= 10 && t.how.length <= 64, `how: ${t.how}`);
    assert.ok(t.line.length >= 10 && t.line.length <= 64, `line: ${t.line}`);
    assert.ok(SHAPES.includes(t.shape) && /^#[0-9a-f]{6}$/i.test(t.color), t.id);
    assert.ok(Number.isFinite(t.need) && t.need >= 1 && typeof t.have === 'function', t.id);
    for (const text of [t.name, t.how, t.line]) { assert.ok(!BANNED.test(text), `cold word: ${text}`); assert.ok(!EMOJI.test(text), `emoji: ${text}`); }
  }
  assert.ok(!CAST_IDS.includes('self') && CAST_IDS.length >= 20, `${CAST_IDS.length} people to meet`);
});

test('a new game has none, and the progress of each is 0', () => {
  const l = evaluate(ctx0());
  assert.equal(l.filter((t) => t.done).length, 0);
  assert.ok(l.filter((t) => !t.id.startsWith('level')).every((t) => t.have === 0), 'everything starts at 0');
  assert.equal(l.find((t) => t.id === 'level5').have, 1, 'except the boxer, who starts at level 1');
});

test('hellos: 1, 10, 40; the people count by name (strangers and strangers\' ids do not)', () => {
  assert.deepEqual(done(ctx0({ p: { hellos: 1 } })), ['hello1']);
  assert.deepEqual(done(ctx0({ p: { hellos: 12 } })), ['hello1', 'hello10']);
  assert.deepEqual(done(ctx0({ p: { hellos: 40 } })), ['hello1', 'hello10', 'hello40']);
  const p = Object.fromEntries(CAST_IDS.map((id) => [`hi_${id}`, 1]));
  assert.ok(done(ctx0({ p })).includes('everybody'));
  delete p.hi_moti;
  assert.ok(!done(ctx0({ p })).includes('everybody'), 'one missing');
  assert.equal(evaluate(ctx0({ p })).find((t) => t.id === 'everybody').have, CAST_IDS.length - 1);
  assert.equal(evaluate(ctx0({ p: { hi_self: 5, hi_nobody: 5, hi_moti: 0 } })).find((t) => t.id === 'everybody').have, 0, 'unknown names, himself and zero do not count');
});

test('every counter unlocks its own: the office, the ring, wins, knock-outs, dodges, parries, a flawless win, a combo', () => {
  assert.deepEqual(done(ctx0({ p: { shiloHi: 1 } })), ['office']);
  assert.deepEqual(done(ctx0({ p: { ringSeen: 1 } })), ['ring']);
  assert.deepEqual(done(ctx0({ b: { wins: 1, level: 1, beaten: [] } })), ['win1']);
  assert.deepEqual(done(ctx0({ b: { wins: 10, level: 1, beaten: [] } })), ['win1', 'win10']);
  assert.deepEqual(done(ctx0({ p: { kos: 1 } })), ['ko1']);
  assert.deepEqual(done(ctx0({ p: { kos: 5 } })), ['ko1', 'ko5']);
  assert.deepEqual(done(ctx0({ p: { perfect: 10 } })), ['perfect1', 'perfect10']);
  assert.deepEqual(done(ctx0({ p: { parries: 5 } })), ['parry5']);
  assert.deepEqual(done(ctx0({ p: { flawless: 1 } })), ['flawless']);
  assert.deepEqual(done(ctx0({ p: { bestCombo: 5 } })), []);
  assert.deepEqual(done(ctx0({ p: { bestCombo: 6 } })), ['combo6']);
});

test('the ladder, the levels, the love, the peaches: the champion and the boss by name, levels 5 and 10, love 25 / 50 / 100, golden peaches, the odometer', () => {
  assert.deepEqual(done(ctx0({ b: { beaten: ['moti', 'coach'], level: 1, wins: 0 } })), ['champion']);
  assert.deepEqual(done(ctx0({ b: { beaten: ['shilo'], level: 1, wins: 0 } })), ['boss']);
  assert.deepEqual(done(ctx0({ b: { beaten: [], level: 5, wins: 0 } })), ['level5']);
  assert.deepEqual(done(ctx0({ b: { beaten: [], level: 10, wins: 0 } })), ['level5', 'level10']);
  assert.deepEqual(done(ctx0({ love: 26 })), ['love25']);
  assert.deepEqual(done(ctx0({ love: 100 })), ['love25', 'love50', 'love100']);
  assert.deepEqual(done(ctx0({ golden: 6 })), ['golden6']);
  assert.deepEqual(done(ctx0({ golden: GOLDEN.length })), ['golden6', 'golden12']);
  assert.deepEqual(done(ctx0({ p: { driven: 999 } })), []);
  assert.deepEqual(done(ctx0({ p: { driven: 1000.5 } })), ['drive1']);
  assert.deepEqual(done(ctx0({ day: 3 })), []);
  assert.deepEqual(done(ctx0({ day: 4 })), ['days3']);
  assert.deepEqual(done(ctx0({ lifetime: 500 })), ['saved500']);
});

test('the parcels: three deliveries make a courier', () => {
  assert.deepEqual(done(ctx0({ p: { parcels: 2 } })), []);
  assert.deepEqual(done(ctx0({ p: { parcels: 3 } })), ['courier']);
});

test('the cafe: twelve customers in one shift make a barista', () => {
  assert.deepEqual(done(ctx0({ p: { cafeBestServed: 11 } })), []);
  assert.deepEqual(done(ctx0({ p: { cafeBestServed: 12 } })), ['barista']);
});

test('the story: the party at the end of the clues is the trophy', () => {
  assert.deepEqual(done(ctx0({ p: { story: 5 } })), []);
  assert.deepEqual(done(ctx0({ p: { storyEnd: 1 } })), ['story']);
});

test('the city events: four enjoyed make a regular', () => {
  assert.deepEqual(done(ctx0({ p: { evCount: 3 } })), []);
  assert.deepEqual(done(ctx0({ p: { evCount: 4 } })), ['events4']);
});

test('the office computer and the explorer: every game played, big scores, ten stamps', () => {
  const best = Object.fromEntries(GAMES.map((g) => [g.id, 5]));
  assert.deepEqual(done(ctx0({ p: { best } })), ['arcade3']);
  delete best.snake;
  assert.deepEqual(done(ctx0({ p: { best } })), []);
  assert.deepEqual(done(ctx0({ p: { best: { tetris: 1000 } } })), ['blocks1000']);
  assert.deepEqual(done(ctx0({ p: { best: { snake: 300 } } })), ['snake300']);
  const nine = Object.fromEntries(STAMPS.slice(0, 9).map((k) => [k, true]));
  assert.deepEqual(done(ctx0({ p: { stamps: nine } })), []);
  assert.deepEqual(done(ctx0({ p: { stamps: { ...nine, [STAMPS[9]]: true } } })), ['explorer']);
  assert.deepEqual(done(ctx0({ p: { seen: { home: true, mum: true, auntie: true, cityhall: true, perach: true, studio: true, startup: true, sidegig: true, cafe: true, kiosk: true } } })), ['explorer'], 'ten rooms entered before the book existed count too');
});

test('a trophy once earned stays (the counters may change), and a finished one shows its whole bar', () => {
  const ctx = ctx0({ love: 0, p: { hellos: 0 } });
  const l = evaluate(ctx, ['love50', 'hello10']);
  assert.ok(l.find((t) => t.id === 'love50').done && l.find((t) => t.id === 'hello10').done);
  assert.equal(l.find((t) => t.id === 'love50').have, 50);
  assert.equal(l.find((t) => t.id === 'love25').done, false);
  assert.deepEqual(evaluate(ctx0({ p: { hellos: 7 } })).find((t) => t.id === 'hello10').have, 7);
  assert.equal(evaluate(ctx0({ p: { hellos: 99999 } })).find((t) => t.id === 'hello40').have, 40, 'capped at need');
});

test('newTrophies: only what is done and not yet on the save, in the order of the roster', () => {
  const c = ctx0({ p: { hellos: 12, shiloHi: 1 }, love: 30 });
  assert.deepEqual(newTrophies(c, []).map((t) => t.id), ['hello1', 'hello10', 'office', 'love25']);
  assert.deepEqual(newTrophies(c, ['hello1', 'love25']).map((t) => t.id), ['hello10', 'office']);
  assert.deepEqual(newTrophies(c, ['hello1', 'hello10', 'office', 'love25']), []);
});

test('every trophy can be earned (a life with everything done has them all) and none is earned too cheaply (nothing is done by a day-one player with a few hellos)', () => {
  const everything = ctx0({
    p: { leagueWon: { moti: true, albert: true, roee: true, dov: true, maya: true, bossB: true, uzi: true, speedway: true, harbor: true, coast: true, ridge: true }, openWins: 1, cats: { ginger: 3, grey: 3, tuxedo: 3 }, gifts: Object.fromEntries(GIFT_IDS.map((k) => [k, true])), photoPlaces: { a: true, b: true, c: true, d: true, e: true }, stamps: Object.fromEntries(STAMPS.map((k) => [k, true])), wishDone: 9, wishDays: 2, hellos: 99, shiloHi: 3, ringSeen: 1, kos: 9, perfect: 20, parries: 9, flawless: 2, bestCombo: 9, evCount: 5, storyEnd: 1, cafeBestServed: 15, parcels: 4, driven: 5000, best: { tetris: 2000, '2048': 2048, snake: 500 }, seen: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`p${i}`, true])), ...Object.fromEntries(CAST_IDS.map((id) => [`hi_${id}`, 1])) },
    b: { level: 10, wins: 30, fights: 40, beaten: ['moti', 'albert', 'inspector', 'dov', 'coach', 'shilo'] }, love: 100, day: 6, golden: 12, lifetime: 9999,
  });
  assert.equal(done(everything).length, TROPHIES.length, `the rest: ${TROPHIES.filter((t) => !done(everything).includes(t.id)).map((t) => t.id).join(', ')}`);
  assert.ok(done(ctx0({ p: { hellos: 3 }, love: 4 })).length <= 1);
});

test('the fight tally gives the flawless count: only a win with no damage taken', () => {
  const p = {};
  tallyFight(p, { winner: 'player', how: 'ko', stats: { taken: 0, perfect: 0, parry: 0, hits: 9, maxCombo: 3 } });
  assert.equal(p.flawless, 1);
  tallyFight(p, { winner: 'player', how: 'time', stats: { taken: 12, hits: 3 } });
  tallyFight(p, { winner: 'opp', how: 'ko', stats: { taken: 0 } });
  tallyFight(p, { winner: 'player', how: 'ko', stats: { hits: 3 } });
  assert.equal(p.flawless, 1, 'damage taken, a loss, or no number: none of them');
});

test('the save keeps what the trophies need: the earned ids, the places gone into, who was met, the odometer', () => {
  const s = sanitizeSave({ progress: { trophies: ['hello1', 'bad id!', 'win1', 'win1'], seen: { mum: true, cafe: 1, nope: 0 }, hi_moti: 2, driven: 1500.5, flawless: 2 } });
  assert.deepEqual(s.progress.trophies, ['hello1', 'win1']);
  assert.deepEqual(s.progress.seen, { mum: true, cafe: true });
  assert.equal(s.progress.hi_moti, 2); assert.equal(s.progress.driven, 1500.5); assert.equal(s.progress.flawless, 2);
});

console.log(`${n} trophy tests passed`);
