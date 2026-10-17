// "Ori, Can You...?" — the eight little actions (pure state machines in favors/verbs.js). Kept for the story quests (T63).
//   node scripts/test-favors-verbs.mjs
import assert from 'node:assert/strict';
import { createVerb, autoplay, VERB_INFO, CHAT_BANK, SHOP_BANK } from '../src/game3d/favors/verbs.js';
import { mulberry32 } from '../src/game3d/rng.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const KINDS = Object.keys(VERB_INFO);
const params = (kind) => (kind === 'chat' ? { likes: 'warm', prompts: ['One', 'Two', 'Three'] } : kind === 'shop' ? { aisle: 'pizza' } : kind === 'escort' ? { length: 18 } : {});
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const TONES = ['trivial', 'absurd', 'epic'];
const DT = 1 / 60;

/** Plays one verb to the end with a scripted player; returns the verb. `ctx` feeds the escort distance. */
function play(kind, seed, tone, { react = 0, dist = 2, limit = 120 } = {}) {
  const v = createVerb(kind, { seed, tone, params: params(kind) });
  for (let i = 0; i < limit * 60 && !v.done; i++) { autoplay(v, DT, { react }); v.update(DT, { dist }); }
  return v;
}

test('every verb exists, has a title, a hint and valid keys', () => {
  assert.deepEqual(KINDS.sort(), ['assemble', 'carry', 'chat', 'escort', 'fix', 'handle', 'queue', 'shop']);
  for (const k of KINDS) { const i = VERB_INFO[k]; assert.ok(i.title && i.hint && Array.isArray(i.keys), k); assert.doesNotThrow(() => createVerb(k, { params: params(k) })); }
  assert.throws(() => createVerb('juggle'));
});
test('a good player (about a second between actions) finishes every verb well, within 25 seconds, in every tone', () => {
  for (const kind of KINDS) {
    for (const tone of TONES) {
      for (const seed of SEEDS) {
        const v = play(kind, seed, tone, { react: kind === 'carry' || kind === 'escort' ? 0 : 1.0 });
        assert.ok(v.done && !v.timedOut, `${kind}/${tone}/${seed} timed out`);
        assert.ok(v.quality >= 0.6, `${kind}/${tone}/${seed}: ${v.quality}`);
        assert.ok(v.t >= 0.5 && v.t <= 25, `${kind}/${tone}/${seed}: ${v.t.toFixed(1)} s`);
      }
    }
  }
});
test('an idle player always ends: at the latest when time is up, never above a poor score (waiting politely in a queue still works)', () => {
  for (const kind of KINDS) {
    for (const seed of SEEDS) {
      const v = createVerb(kind, { seed, params: params(kind) });
      let i = 0;
      while (!v.done && i++ < 60 * 100) v.update(DT, { dist: 99 });
      assert.ok(v.done, `${kind} never ended`);
      assert.ok(v.t <= v.maxT + 0.05, `${kind}: ${v.t} > ${v.maxT}`);
      assert.ok(v.quality >= 0.15 && v.quality <= 1);
      assert.ok(v.quality < (kind === 'queue' ? 0.75 : 0.5), `${kind}: an idle player scores ${v.quality}`);
    }
  }
});
test('a clumsy player (random keys) scores clearly below a good one', () => {
  for (const kind of ['fix', 'queue', 'shop', 'assemble', 'handle', 'chat']) {
    let good = 0;
    let clumsy = 0;
    for (const seed of SEEDS) {
      good += play(kind, seed, 'absurd', { react: 1.0 }).quality;
      const v = createVerb(kind, { seed, tone: 'absurd', params: params(kind) });
      const r = mulberry32(seed * 7);
      const keys = VERB_INFO[kind].keys;
      for (let i = 0; i < 60 * 60 && !v.done; i++) { if (i % 20 === 0) { const k = keys[Math.floor(r() * keys.length)]; v.press(k); if (kind === 'fix' && r() < 0.5) v.release(k); } v.update(DT); }
      clumsy += v.quality;
    }
    assert.ok(clumsy < good - SEEDS.length * 0.08, `${kind}: good ${(good / SEEDS.length).toFixed(2)} vs clumsy ${(clumsy / SEEDS.length).toFixed(2)}`);
  }
});
test('deterministic: the same seed and the same keys give the same run; another seed another layout', () => {
  for (const kind of KINDS) {
    const a = play(kind, 5, 'absurd', { react: 0.5 });
    const b = play(kind, 5, 'absurd', { react: 0.5 });
    assert.equal(a.quality, b.quality);
    assert.equal(a.t, b.t);
    assert.equal(JSON.stringify(a.view()), JSON.stringify(b.view()));
  }
  assert.notEqual(JSON.stringify(createVerb('assemble', { seed: 1 }).view()), JSON.stringify(createVerb('assemble', { seed: 2 }).view()));
  assert.notEqual(JSON.stringify(createVerb('fix', { seed: 1 }).view()), JSON.stringify(createVerb('fix', { seed: 2 }).view()));
});
test('after the end nothing moves: presses and updates are ignored and the result stays', () => {
  for (const kind of KINDS) {
    const v = play(kind, 3, 'trivial', { react: 0.3 });
    const q = v.quality;
    const t = v.t;
    v.press('act'); v.press('left'); v.update(1, { dist: 2 });
    assert.equal(v.quality, q);
    assert.equal(v.t, t);
  }
});
test('carry: the zone is kept for a few seconds, leaving it for over a second drops the dish (and costs quality)', () => {
  const v = createVerb('carry', { seed: 2, tone: 'trivial' });
  for (let i = 0; i < 60 * 3 && !v.done; i++) { autoplay(v, DT); v.update(DT); }
  assert.ok(v.core.s.inside > 2, 'steady for 3 s');
  const w = createVerb('carry', { seed: 2, tone: 'trivial' });
  for (let i = 0; i < 60 * 40 && !w.done; i++) { w.press('right'); w.update(DT); } // always pushes right: falls out of the zone again and again
  assert.ok(w.core.s.drops >= 2 && w.quality < 0.6, `drops ${w.core.s.drops} quality ${w.quality}`);
});
test('fix: let go in the green and the stage is done; holding too long overheats and costs a try', () => {
  const v = createVerb('fix', { seed: 4, tone: 'absurd' });
  v.press('act');
  for (let i = 0; i < 60 * 3; i++) v.update(DT); // holds far too long
  assert.ok(v.core.s.tries >= 1 && v.core.s.stage === 0);
  const g = play('fix', 4, 'absurd', { react: 0.4 });
  assert.ok(g.core.s.stage >= 3 && g.core.s.tries === 0);
});
test('queue: sighing speeds the line up but too much and the clerk takes a break (a mistake); the quiet way is slower', () => {
  const sigh = (every) => { const v = createVerb('queue', { seed: 9, tone: 'absurd' }); for (let i = 0; i < 60 * 40 && !v.done; i++) { if (every && i % every === 0) v.press('act'); v.update(DT); } return v; };
  const spam = sigh(6);
  assert.ok(spam.core.s.mistakes >= 1, 'a stall for spamming');
  const calm = sigh(0);
  const smart = play('queue', 9, 'absurd', { react: 0.5 });
  assert.ok(smart.t < calm.t, `${smart.t.toFixed(1)} vs ${calm.t.toFixed(1)}`);
  assert.ok(smart.quality > calm.quality);
});
test('chat: the liked answer scores 1, the bad one 0, a timeout 0; each round offers one of each kind', () => {
  const v = createVerb('chat', { seed: 3, params: { likes: 'excited', prompts: ['a', 'b', 'c'] } });
  v.update(DT);
  for (let round = 0; round < 3; round++) {
    const opts = v.core.s.cur.options;
    assert.equal(new Set(opts.map((o) => o.type)).size, 3);
    assert.equal(opts.filter((o) => o.type === 'excited').length, 1);
    for (const o of opts) assert.ok(CHAT_BANK[o.type].includes(o.text));
    v.press(`c${opts.findIndex((o) => o.type === 'excited') + 1}`);
  }
  assert.ok(v.done && v.quality === 1);
  const bad = createVerb('chat', { seed: 3, params: { likes: 'warm' } });
  bad.update(DT);
  for (let r = 0; r < 3; r++) bad.press(`c${bad.core.s.cur.options.findIndex((o) => o.type === 'evasive') + 1}`);
  assert.ok(bad.done && bad.quality <= 0.2);
  const late = createVerb('chat', { seed: 3, params: { likes: 'warm' } });
  for (let i = 0; i < 60 * 30 && !late.done; i++) late.update(DT);
  assert.ok(late.done && late.quality <= 0.2);
});
test('shop: the wanted item completes it; wrong picks cost; five wrong picks end it; the shelves are well formed', () => {
  for (const [aisle, b] of Object.entries(SHOP_BANK)) { assert.equal(b.items.length, 6, aisle); assert.ok(b.want.every((w) => b.items.includes(w)), aisle); }
  const v = createVerb('shop', { seed: 6, tone: 'trivial', params: { aisle: 'bread' } });
  const want = SHOP_BANK.bread.want[0];
  const target = v.core.items.indexOf(want);
  for (let i = 0; i < 12; i++) v.press('right');
  v.press('act');
  v.update(DT);
  const wrong = v.core.s.cursor !== target;
  if (wrong) assert.equal(v.core.s.mistakes, 1);
  const w = createVerb('shop', { seed: 6, tone: 'epic', params: { aisle: 'pizza' } });
  for (let i = 0; i < 80 && !w.done; i++) { w.press(w.core.items.every((it, j) => !SHOP_BANK.pizza.want.includes(it) || j === w.core.s.cursor) ? 'act' : 'act'); w.update(DT); w.press('right'); }
  assert.ok(w.done);
});
test('escort: they only move while Ori is close; they stop and look around twice; far away it waits and costs quality', () => {
  const near = createVerb('escort', { seed: 2, params: { length: 18 } });
  for (let i = 0; i < 60 * 40 && !near.done; i++) near.update(DT, { dist: 2 });
  assert.ok(near.done && near.quality > 0.95 && near.core.s.paused === 2);
  const far = createVerb('escort', { seed: 2, params: { length: 18 } });
  for (let i = 0; i < 60 * 5; i++) far.update(DT, { dist: 20 });
  assert.equal(far.core.s.s, 0);
  assert.ok(far.core.s.lost > 4.9);
  const lagged = createVerb('escort', { seed: 2, params: { length: 18 } });
  for (let i = 0; i < 60 * 80 && !lagged.done; i++) lagged.update(DT, { dist: i % 240 < 80 ? 20 : 2 });
  assert.ok(lagged.done && lagged.quality < near.quality);
});
test('assemble: the right key advances, a wrong one is a mistake and does not; running out of time on a step is a mistake too', () => {
  const v = createVerb('assemble', { seed: 8, tone: 'absurd' });
  const steps = v.core.steps;
  const wrong = ['left', 'right', 'up', 'down', 'act'].find((k) => k !== steps[0]);
  v.press(wrong);
  assert.equal(v.core.s.idx, 0);
  assert.equal(v.core.s.mistakes, 1);
  v.press(steps[0]);
  assert.equal(v.core.s.idx, 1);
  const slow = createVerb('assemble', { seed: 8, tone: 'absurd' });
  for (let i = 0; i < 60 * 8; i++) slow.update(DT);
  assert.ok(slow.core.s.timeouts >= 2);
});
test('handle: a hit in the middle counts, a miss freezes the stamp for a moment; the beat speeds up with every hit', () => {
  const v = createVerb('handle', { seed: 1, tone: 'absurd' });
  while (Math.abs(v.core.marker() - 0.5) < 0.4) v.update(DT);
  v.press('act');
  assert.equal(v.core.s.miss, 1);
  const before = v.core.s.miss;
  v.press('act');
  assert.equal(v.core.s.miss, before, 'cooling down: the second press is ignored');
  const g = play('handle', 1, 'absurd', { react: 0.3 });
  assert.ok(g.core.s.hits >= 4 && g.core.s.speed > 0.75);
});
test('the text is clean: every line of the chat bank is short, plain and free of emoji', () => {
  for (const [type, lines] of Object.entries(CHAT_BANK)) for (const l of lines) { assert.ok(l.length <= 60, `${type}: ${l}`); assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(l)); }
  for (const [aisle, b] of Object.entries(SHOP_BANK)) for (const it of b.items) assert.ok(it.length <= 26 && !/[\u{1F300}-\u{1FAFF}]/u.test(it), `${aisle}: ${it}`);
});

console.log(`${n} verb tests passed`);
