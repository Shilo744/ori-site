// "Ori, Can You...?" — the short story "The Peach Tree" [experimental] (pure): five clues in order, then the park; kept on the save as two counters.      node scripts/test-favors-story.mjs
import assert from 'node:assert/strict';
import { STEPS, PARTY, CLUE_REWARD, started, finished, current, chipText, placeOf, takeClue, takeParty } from '../src/game3d/favors/story.js';
import { CAST, PLACES } from '../src/game3d/favors/content.js';
import { sanitizeSave } from '../src/game3d/favors/save.js';
import { createCampaign, safeStorage } from '../src/game3d/favors/campaign.js';
import { BY_CAST } from '../src/game3d/favors/greet.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;
const EMOJI = /[\u{1F300}-\u{1FAFF}☀-➿]/u;
const mem = () => { const d = {}; return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } }; };
const begun = (o = {}) => ({ goalsDone: ['hello'], ...o });

test('five clues from five people who exist, in five places that exist, in a warm voice and not too long', () => {
  assert.equal(STEPS.length, 5);
  assert.deepEqual(STEPS.map((s) => s.who), ['ima', 'moti', 'albert', 'roee', 'coach']);
  assert.equal(new Set(STEPS.map((s) => s.who)).size, 5);
  for (const s of STEPS) {
    assert.ok(CAST[s.who] && BY_CAST[s.who], `${s.who} is a cast member`);
    assert.ok(PLACES[s.place], `${s.place} is a place`);
    assert.equal(CAST[s.who].home === s.place || s.who === 'coach' || s.who === 'moti', true, `${s.who} is found at ${s.place}`);
    for (const t of [s.clue, s.chip]) { assert.ok(t.length >= 20 && t.length <= 96, `${t.length}: ${t}`); assert.ok(!BANNED.test(t) && !EMOJI.test(t), t); }
  }
  assert.ok(PLACES[PARTY.place] && PARTY.stay >= 2 && PARTY.seconds >= 30 && PARTY.reward.peaches > CLUE_REWARD.peaches * 5);
  for (const t of [PARTY.chip, PARTY.toast, PARTY.line]) assert.ok(!BANNED.test(t) && !EMOJI.test(t), t);
});

test('it starts after the five hellos, and not before; it ends once', () => {
  assert.equal(started({}), false); assert.equal(current({}), null); assert.equal(chipText({}), ''); assert.equal(placeOf({}), null);
  assert.equal(started(begun()), true);
  assert.deepEqual(current(begun()), { kind: 'clue', index: 0, step: STEPS[0] });
  assert.equal(chipText(begun()), STEPS[0].chip); assert.equal(placeOf(begun()), 'mum');
  assert.equal(started({ story: 2 }), true, 'a story in hand is started whatever the goals say');
  assert.equal(current({ goalsDone: ['hello'], storyEnd: 1 }), null);
  assert.equal(finished({ storyEnd: 1 }), true);
});

test('the clues come only from the next person, in the order of the story; anybody else just says hello', () => {
  const p = begun();
  assert.equal(takeClue(p, 'moti'), null, 'not yet: Mum first');
  assert.equal(takeClue(p, 'nobody'), null);
  assert.equal(p.story, undefined);
  const a = takeClue(p, 'ima');
  assert.deepEqual({ clue: a.clue, index: a.index, last: a.last }, { clue: STEPS[0].clue, index: 0, last: false });
  assert.equal(p.story, 1);
  assert.equal(takeClue(p, 'ima'), null, 'the same person again gives nothing');
  assert.equal(placeOf(p), 'home');
  for (const who of ['moti', 'albert', 'roee']) assert.ok(takeClue(p, who), who);
  assert.equal(p.story, 4);
  const last = takeClue(p, 'coach');
  assert.equal(last.last, true); assert.equal(p.story, 5);
  assert.equal(takeClue(p, 'ima'), null, 'all five given');
});

test('then the park: the party counts once and pays', () => {
  const p = begun({ story: 5 });
  assert.deepEqual(current(p), { kind: 'party', index: 5, step: PARTY });
  assert.equal(chipText(p), PARTY.chip); assert.equal(placeOf(p), 'park');
  assert.equal(takeParty(begun({ story: 3 })), null, 'not before the clues');
  assert.equal(takeParty({}), null, 'not before the story');
  const r = takeParty(p);
  assert.equal(r, PARTY); assert.equal(p.storyEnd, 1);
  assert.equal(takeParty(p), null, 'once');
  assert.equal(current(p), null); assert.equal(chipText(p), '');
});

test('the story is on the save: two counters; garbage is clamped; the old tests\' players start it fresh', () => {
  const st = mem();
  const c = createCampaign({ storage: safeStorage(st), fresh: true });
  c.state.progress.goalsDone.push('hello');
  takeClue(c.state.progress, 'ima'); takeClue(c.state.progress, 'moti');
  c.save();
  const d = createCampaign({ storage: safeStorage(st) });
  assert.equal(d.state.progress.story, 2);
  assert.equal(current(d.state.progress).step.who, 'albert');
  assert.equal(sanitizeSave({ progress: { story: 99, storyEnd: -3 } }).progress.story, 99, 'the number is kept (the code reads it as "all five")');
  assert.deepEqual(current(sanitizeSave({ progress: { story: 99, goalsDone: ['hello'] } }).progress), { kind: 'party', index: 5, step: PARTY });
  assert.equal(sanitizeSave({ progress: { storyEnd: -3 } }).progress.storyEnd, 0);
  assert.deepEqual(current({ story: 'x', goalsDone: ['hello'] }), { kind: 'clue', index: 0, step: STEPS[0] }, 'junk is the start');
});

console.log(`${n} story tests passed`);
