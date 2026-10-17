// "Ori, Can You...?" — the PERSONA lint. Ori is always positive, warm and kind; he never snaps, sulks or fails: when time runs out it is a
// "rain check", when he cannot he says so lovingly. Every line the game says in Ori's own voice (src/game3d/favors/texts.js, the phone
// replies, the ranks, the report card, the verbs' prompts) must be free of cold words — the NPCs' own task texts are theirs and are not
// checked here (a boss may grumble; Ori never does).      node scripts/test-favors-persona.mjs
import assert from 'node:assert/strict';
import { TEXT, nextTimeFor } from '../src/game3d/favors/texts.js';
import { REPLIES, RANKS } from '../src/game3d/favors/content.js';
import { VERB_INFO, CHAT_BANK } from '../src/game3d/favors/verbs.js';
import { createQuests } from '../src/game3d/favors/quests.js';
import { MAP } from './lib/favors-bot.mjs';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };

/** Words that do not belong in Ori's mouth (word boundaries; case-insensitive). */
export const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;
const EMOJI = /[\u{1F300}-\u{1FAFF}☀-➿]/u;

/** Every string a TEXT entry can produce (functions are called with sample arguments). */
function lines(entry) {
  if (typeof entry === 'string') return [entry];
  if (Array.isArray(entry)) return entry.flatMap(lines);
  if (typeof entry === 'function') {
    const out = [];
    for (const args of [[0], [1], [3], ['Mum', 'Light bulb'], ['Mum'], ['5 min'], [60, 3], [85], ['1 h'], [2, 1, 4, 3], [3, 3, 11, 3], [1, 0, 0, 0]]) {
      try { const r = entry(...args); out.push(...lines(r)); } catch { /* wrong arity for this sample */ }
    }
    return out;
  }
  return [];
}

test('every word of Ori\'s own voice is warm: no "missed", "failed", "sorry", "can\'t", "not now"…', () => {
  const all = Object.entries(TEXT).flatMap(([k, v]) => lines(v).map((l) => [k, l]));
  assert.ok(all.length > 60, `${all.length} lines`);
  for (const [k, l] of all) {
    assert.ok(!BANNED.test(l), `TEXT.${k}: "${l}"`);
    assert.ok(!EMOJI.test(l), `TEXT.${k}: emoji`);
    assert.ok(l.length <= 130, `TEXT.${k}: too long`);
  }
  for (let uid = 0; uid < 12; uid++) assert.ok(!BANNED.test(nextTimeFor(uid)));
});
test('the phone replies are loving: yes is eager, later is hopeful, no is a rain check', () => {
  for (const [k, list] of Object.entries(REPLIES)) for (const l of list) { assert.ok(!BANNED.test(l), `${k}: ${l}`); assert.ok(!EMOJI.test(l)); }
  assert.ok(REPLIES.no.every((l) => /love|rain check|next time|make it up|wish/i.test(l)), 'every "no" says it with love');
  assert.ok(REPLIES.yes.length >= 3 && REPLIES.later.length >= 3 && REPLIES.no.length >= 3);
});
test('the ranks cheer the player on; the verbs\' prompts are friendly', () => {
  for (const r of RANKS) assert.ok(!BANNED.test(r.title) && !EMOJI.test(r.title), r.title);
  for (const [k, v] of Object.entries(VERB_INFO)) assert.ok(!BANNED.test(`${v.title} ${v.hint}`), k);
  for (const [t, ls] of Object.entries(CHAT_BANK)) for (const l of ls) assert.ok(!BANNED.test(l), `${t}: ${l}`);
});
test('the report card of a day with nothing done is still kind', () => {
  const q = createQuests({ seed: 3, dist: MAP.dist });
  while (!q.state.ended) q.tick(1);
  const r = q.state.report;
  assert.equal(r.helped, 0);
  for (const l of r.lines) { assert.ok(!BANNED.test(l), l); assert.ok(!EMOJI.test(l)); }
  assert.ok(r.lines.some((l) => /rain check/.test(l)), 'the aunts get a rain check, not a snub');
  assert.ok(!BANNED.test(r.rank), r.rank);
});
test('time running out is always "next time": a lazy day produces only rain checks in the voice of the game', () => {
  const q = createQuests({ seed: 4, dist: MAP.dist });
  while (!q.state.ended) q.tick(1);
  const failed = q.state.tasks.filter((t) => t.state === 'failed');
  assert.ok(failed.length > 20);
  for (const t of failed) { const msg = TEXT.rainCheck(t.giverName, t.title); assert.ok(!BANNED.test(msg.replace(t.title, '')), msg); assert.ok(/rain check/.test(msg)); }
});

console.log(`${n} persona tests passed`);
