// "Ori, Can You...?" — sound captions [experimental] (pure): the words for the ring's and the street's sounds, kind and short; the same words not repeated at once; the wrapper that says them next to the real engines
// (against a fake AudioContext), and that it never breaks a sound.      node scripts/test-favors-captions.mjs
import assert from 'node:assert/strict';
import { MAX, LIFE, SAME, TABLES, CAPTIONED, createCaptioner, withCaptions } from '../src/game3d/favors/captions.js';
import { createFightSfx } from '../src/game3d/favors/fight-sfx.js';
import { createSfx } from '../src/game3d/favors/sfx.js';
import { createFakeContext } from './lib/fake-audio.mjs';
import { mulberry32 } from '../src/game3d/rng.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const heard = () => { const lines = []; return { lines, say: (t) => lines.push(t) }; };

test('the words: short, plain, kind, no emoji, for every sound the ring and the street give', () => {
  const ring = TABLES.ring();
  const street = TABLES.street();
  const samples = [[ring.bell, [1]], [ring.bell, [3]], [ring.count, [7]], [ring.ko, ['opp']], [ring.knockdown, ['opp']], [ring.getup, ['opp']], [ring.parry, []], [ring.perfect, []], [ring.guardbreak, []], [ring.fury, []], [ring.level, []], [ring.lag, []], [ring.cheer, [1]], [ring.gasp, [1]], [street.honk, []], [street.purr, []], [street.band, [0.6]]];
  for (const [fn, args] of samples) { const t = fn(...args); assert.ok(typeof t === 'string' && t.length >= 4 && t.length <= 40, String(t)); assert.ok(!BANNED.test(t) && !EMOJI.test(t), t); }
  assert.equal(ring.bell(1), 'Bell: get ready');
  assert.equal(ring.bell(2), 'Bell: fight!');
  assert.equal(ring.bell(3), 'Bell: the fight is over');
  assert.equal(ring.count(4), 'The referee counts: 4');
  assert.equal(ring.cheer(0.2), null, 'a small cheer is not worth a line');
  assert.deepEqual(CAPTIONED.ring.sort(), ['bell', 'cheer', 'count', 'fury', 'gasp', 'getup', 'guardbreak', 'knockdown', 'ko', 'lag', 'level', 'parry', 'perfect']);
  assert.deepEqual(CAPTIONED.street.sort(), ['band', 'honk', 'purr']);
  assert.ok(MAX >= 2 && MAX <= 4 && LIFE >= 2 && LIFE <= 5 && SAME >= 1);
});

test('the same words are not said again within a moment; different words always are', () => {
  const c = createCaptioner();
  assert.equal(c.say('Parry!', 10), true);
  assert.equal(c.say('Parry!', 10.5), false);
  assert.equal(c.say('Knock-out!', 10.6), true);
  assert.equal(c.say('Parry!', 10 + SAME + 0.01), true);
  assert.equal(c.say('', 20), false);
  assert.equal(c.say(null, 20), false);
});

test('next to the real ring engine: the call makes its sound AND says its words; the other sounds are untouched', () => {
  const ctx = createFakeContext();
  const raw = createFightSfx({ context: ctx, rnd: mulberry32(3) });
  for (const name of CAPTIONED.ring) assert.equal(typeof raw[name], 'function', `the ring engine has ${name}`);
  const h = heard();
  const sfx = withCaptions(raw, 'ring', h.say);
  const before = ctx.created ? ctx.created.length : 0;
  sfx.bell(1); sfx.ko('opp'); sfx.count(3); sfx.parry(); sfx.cheer(0.2); sfx.cheer(0.9);
  assert.deepEqual(h.lines, ['Bell: get ready', 'Knock-out!', 'The referee counts: 3', 'Parry!', 'The crowd cheers']);
  sfx.thud({ dmg: 5, target: 'opp' }); sfx.whoosh(0.2, 0.5, true);
  assert.equal(h.lines.length, 5, 'a thud and a whoosh have no words');
  assert.ok(sfx.audio === raw.audio, 'plain values pass through');
  void before;
  sfx.dispose();
});

test('next to the real street engine: the horn says so, the band speaks once when it is first heard, getters stay live', () => {
  const raw = createSfx({ isMuted: () => true, volume: () => 1 });
  for (const name of CAPTIONED.street) assert.equal(typeof raw[name], 'function', `the street engine has ${name}`);
  const h = heard();
  const sfx = withCaptions(raw, 'street', h.say);
  sfx.honk();
  sfx.band(0.6); sfx.band(0.7); sfx.band(0.2);
  sfx.band(0); sfx.band(0.4);
  assert.deepEqual(h.lines, ['A car horn', 'A street band is playing', 'A street band is playing'], 'once per time the music comes in');
  assert.equal(typeof sfx.ding, 'function');
  assert.equal(sfx.bandPlaying, raw.bandPlaying, 'a getter is read live, not copied');
  sfx.dispose();
});

test('a property replaced afterwards is the one that gets called (the sound test puts spies on the engine), with or without words', () => {
  const calls = [];
  const raw = { thud: () => calls.push('thud'), ko: () => calls.push('ko') };
  const h = heard();
  const sfx = withCaptions(raw, 'ring', h.say);
  sfx.thud(); sfx.ko();
  raw.thud = () => calls.push('spy-thud');
  const was = raw.ko;
  raw.ko = (...a) => { calls.push('spy-ko'); return was(...a); };
  sfx.thud(); sfx.ko();
  assert.deepEqual(calls, ['thud', 'ko', 'spy-thud', 'spy-ko', 'ko']);
  assert.deepEqual(h.lines, ['Knock-out!', 'Knock-out!'], 'and the words still come');
  sfx.thud = () => calls.push('set-through-the-wrapper');
  sfx.thud();
  assert.equal(calls.at(-1), 'set-through-the-wrapper', 'assigning through the wrapper works too');
});

test('a caption can never break a sound, and a sound can never break the captions', () => {
  const calls = [];
  const raw = { ko: (w) => { calls.push(w); return 'sound'; }, perfect: () => 'ok', other: () => 'x' };
  const boom = withCaptions(raw, 'ring', () => { throw new Error('the screen is gone'); });
  assert.equal(boom.ko('opp'), 'sound');
  assert.deepEqual(calls, ['opp']);
  assert.equal(boom.other(), 'x');
  const quiet = withCaptions({ ko: () => 1 }, 'nowhere', () => assert.fail('no table, no words'));
  assert.equal(quiet.ko(), 1);
});

console.log(`${n} captions tests passed`);
