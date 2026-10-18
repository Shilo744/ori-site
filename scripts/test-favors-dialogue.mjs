// "Ori, Can You...?" — dialogue tests (T61): the runner, every graph (reachable, no dead ends, no undefined flags, Ori never negative), the voices,
// the compliment generator and the barks.      node scripts/test-favors-dialogue.mjs
import assert from 'node:assert/strict';
import { createRunner, validateGraph, walkAll, holds, BANNED, isEmotion } from '../src/game3d/favors/dialogue.js';
import { GRAPHS, graphFor, genericGraph, KNOWN_FLAGS } from '../src/game3d/favors/dialogue/index.js';
import { speaker, SPEAKER_IDS } from '../src/game3d/favors/dialogue/cast.js';
import { complimentFor, ALL_COMPLIMENT_LINES, ORI_COMPLIMENT_LINES } from '../src/game3d/favors/dialogue/compliments.js';
import { barkFor, ALL_BARKS } from '../src/game3d/favors/dialogue/barks.js';
import { voiceFor, blipPitch } from '../src/game3d/favors/voices.js';
import { CAST } from '../src/game3d/favors/content.js';
import { randomSpec } from '../src/game3d/favors/people/specs.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const EMOJI = /\p{Extended_Pictographic}/u;
const castIds = Object.keys(CAST).filter((k) => k !== 'self');
const all = [...Object.values(GRAPHS), ...castIds.map(genericGraph)];

test('every graph is valid: reachable, no dead ends, targets exist, flags defined, Ori never negative', () => {
  for (const g of all) assert.deepEqual(validateGraph(g, { known: KNOWN_FLAGS, speakers: SPEAKER_IDS }), [], g.id);
});

test('the validator catches broken graphs (missing target, dead end, unreachable node, unknown flag, a negative Ori line)', () => {
  const g = { id: 'bad', start: 'a', nodes: {
    a: { s: 'ori', t: 'Hello', next: 'zzz' }, b: { s: 'ori', t: 'I hate this' }, c: { s: 'ori', t: 'x', choices: [{ t: 'one', next: 'a', if: { flag: 'nothing' } }] },
  } };
  const bad = validateGraph(g).join('\n');
  assert.match(bad, /missing node "zzz"/);
  assert.match(bad, /dead end/);
  assert.match(bad, /unreachable/);
  assert.match(bad, /nothing/);
  assert.match(bad, /negative/);
});

test('three full sample conversations: Mum, the City Hall clerk and a stranger, each with at least three branches', () => {
  for (const id of ['mum', 'clerk', 'stranger']) {
    const g = GRAPHS[id];
    assert.ok(Object.keys(g.nodes).length >= 10, `${id} has ${Object.keys(g.nodes).length} lines`);
    assert.ok(Object.values(g.nodes).filter((x) => x.choices).length >= 2, `${id} branches`);
  }
});

test('every route through every graph ends (each choice index tried)', () => {
  for (const g of all) for (let pick = 0; pick < 4; pick++) assert.ok(walkAll(g, { pick }).done, `${g.id} pick ${pick}`);
});

test('the runner follows lines and choices, applies flags / relationship and records effects', () => {
  const ctx = { flags: new Set(), rel: 60 };
  const r = createRunner(GRAPHS.mum, ctx);
  assert.equal(r.line().speaker, 'ima');
  assert.equal(r.line().choices.length, 3);
  r.choose(2); // the compliment
  assert.ok(ctx.flags.has('ima.complimented'));
  assert.equal(ctx.rel, 63);
  assert.equal(r.line().speaker, 'ima'); // she blushes
  let guard = 0;
  while (!r.done && guard++ < 60) { const l = r.line(); if (l.choices) r.choose(l.choices[0].index); else r.advance(); }
  assert.ok(r.done);
  assert.ok(r.effects.some((e) => e.give === 'cookies'), 'the cookies are given');
});

test('choices can be hidden by relationship and flags, and the runner refuses a hidden choice', () => {
  assert.equal(holds({ rel: 70 }, { flags: new Set(), rel: 60 }), false);
  assert.equal(holds({ rel: 70 }, { flags: new Set(), rel: 80 }), true);
  assert.equal(holds({ flag: 'a' }, { flags: new Set(['a']), rel: 0 }), true);
  assert.equal(holds({ noFlag: 'a' }, { flags: new Set(['a']), rel: 0 }), false);
  const run = (rel) => {
    const r = createRunner(GRAPHS.mum, { flags: new Set(), rel });
    r.choose(0); r.advance(); r.advance(); // hi -> soup -> soup2 -> bulb
    while (r.key !== 'bulb') r.advance();
    r.choose(2); // the whole building
    return r.line().choices.length;
  };
  assert.equal(run(60), 2);
  assert.equal(run(80), 3);
  const r = createRunner(GRAPHS.clerk, { flags: new Set(), rel: 60 });
  r.choose(0); r.choose(0); // f17 -> warm
  while (r.key !== 'extra') r.advance();
  assert.equal(r.line().choices.length, 1, 'the heartfelt reply needs the clerk to have thawed');
});

test('the City Hall clerk thaws when Ori compliments her glasses, and then tells him a hint', () => {
  const ctx = { flags: new Set(), rel: 60 };
  const r = createRunner(GRAPHS.clerk, ctx);
  r.choose(0); r.choose(1);
  while (!r.done) { const l = r.line(); if (l.choices) r.choose(l.choices[l.choices.length - 1].index); else r.advance(); }
  assert.ok(ctx.flags.has('clerk.thawed'));
  assert.ok(r.effects.some((e) => e.hint && /kiosk/.test(e.hint)));
});

test('Ori never says anything negative: every line of his in every graph, every generated compliment, every choice', () => {
  for (const g of all) {
    for (const [k, node] of Object.entries(g.nodes)) {
      if (node.s === 'ori') assert.ok(!BANNED.test(node.t), `${g.id}.${k}: ${node.t}`);
      for (const c of node.choices || []) assert.ok(!BANNED.test(c.t), `${g.id}.${k}: ${c.t}`);
    }
  }
  for (const l of ORI_COMPLIMENT_LINES) assert.ok(!BANNED.test(l), l);
  for (const l of ALL_COMPLIMENT_LINES) assert.ok(!BANNED.test(l) && !EMOJI.test(l), l);
  for (const l of ALL_BARKS) assert.ok(!BANNED.test(l) && !EMOJI.test(l), l);
});

test('lines are short enough to read (<= 160 chars) and every emotion is a real, warm expression', () => {
  for (const g of all) for (const [k, node] of Object.entries(g.nodes)) {
    assert.ok(node.t.length <= 160, `${g.id}.${k}: ${node.t.length}`);
    if (node.e) assert.ok(isEmotion(node.e), `${g.id}.${k}: ${node.e}`);
  }
});

test('every speaker has a spec (plain data), a name, and a voice; the main cast has distinct voices', () => {
  const ids = ['ori', ...castIds, 'stranger:3', 'stranger:9'];
  const voices = new Set();
  for (const id of ids) {
    const s = speaker(id);
    assert.ok(s.name && s.spec && s.voice, id);
    assert.deepEqual(JSON.parse(JSON.stringify(s.spec)), s.spec, `${id} spec is plain data`);
    assert.ok(s.voice.base > 80 && s.voice.base < 480 && s.voice.rate > 0.03 && s.voice.rate < 0.12, `${id} voice in range`);
    voices.add(`${s.voice.base}/${s.voice.rate.toFixed(3)}/${s.voice.wave}`);
  }
  assert.ok(voices.size >= ids.length - 2, `${voices.size} different voices of ${ids.length}`);
  assert.ok(speaker('ima').voice.base > speaker('ori').voice.base, 'Mum sounds higher than Ori');
});

test('the same id always gives the same voice and face; strangers differ from each other', () => {
  assert.deepEqual(voiceFor('x'), voiceFor('x'));
  assert.notDeepEqual(speaker('stranger:1').spec.face, speaker('stranger:2').spec.face);
  assert.equal(speaker('stranger:4'), speaker('stranger:4'));
});

test('blips: vowels ring higher than consonants, spaces and punctuation are silent', () => {
  const v = voiceFor('ima', { gender: 'f', age: 'elder' });
  assert.equal(blipPitch(v, ' '), 0);
  assert.equal(blipPitch(v, ','), 0);
  assert.ok(blipPitch(v, 'a', 3) > 0);
  assert.ok(blipPitch(v, 'a', 0) > blipPitch(v, 'm', 0));
});

test('compliments are specific to the person (hair, glasses, colours...), deterministic per seed, and always land warmly', () => {
  const seen = new Set();
  for (let s = 1; s <= 120; s++) {
    const spec = randomSpec(s * 31);
    const c = complimentFor(spec, '', s);
    assert.ok(c.ori && c.reply && c.hearts >= 1 && c.hearts <= 3 && isEmotion(c.emo), `seed ${s}`);
    assert.deepEqual(c, complimentFor(spec, '', s));
    seen.add(c.topic);
  }
  assert.ok(seen.size >= 6, `${seen.size} different topics`);
  const withGlasses = randomSpec(5, {}); withGlasses.glasses = { frame: '#000' }; withGlasses.age = 'adult'; withGlasses.hair = { style: 'short' };
  let glasses = 0;
  for (let s = 1; s <= 60; s++) if (complimentFor(withGlasses, '', s).topic === 'glasses') glasses++;
  assert.ok(glasses > 5, 'a person with glasses is sometimes complimented on them');
  assert.ok(complimentFor(randomSpec(2), 'ima', 1).hearts >= 1);
});

test('barks: warm, vary by the hour and the relationship, deterministic', () => {
  const set = new Set();
  for (let s = 1; s <= 80; s++) set.add(barkFor({ rel: s % 3 ? 'friends' : 'family', hour: (s * 3) % 24, seed: s }));
  assert.ok(set.size >= 10, `${set.size} different barks`);
  assert.equal(barkFor({ seed: 3, hour: 9 }), barkFor({ seed: 3, hour: 9 }));
  assert.ok(ALL_BARKS.some((b) => /Habibi/.test(b)));
});

test('graphFor finds the right conversation for Mum, the clerk, strangers and everyone else', () => {
  assert.equal(graphFor('ima').id, 'mum');
  assert.equal(graphFor('clerk').id, 'clerk');
  assert.equal(graphFor('stranger:12').id, 'stranger');
  assert.equal(graphFor('roee').who, 'roee');
});

console.log(`${n} dialogue tests passed`);
