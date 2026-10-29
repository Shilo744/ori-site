// "Ori, Can You...?" — the comfort settings (pure): defaults, garbage in = defaults out, saved and read back, a broken storage never throws, listeners.      node scripts/test-favors-settings.mjs
import assert from 'node:assert/strict';
import { createSettings, normalize, DEFAULTS, HINTS, RESOLUTIONS } from '../src/game3d/favors/settings.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const mem = (seed) => { const d = { ...(seed || {}) }; return { d, getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; } }; };
const KEY = 'ori-favors-settings-v1';

test('a fresh game: no high contrast, the key hints and the resolution are automatic', () => {
  const s = createSettings({ storage: mem() });
  assert.deepEqual(s.get(), { contrast: false, hints: 'auto', resolution: 'auto', captions: false });
  assert.deepEqual(RESOLUTIONS, ['auto', 'full']);
  assert.deepEqual(s.get(), DEFAULTS);
  assert.deepEqual(HINTS, ['auto', 'on', 'off']);
});

test('normalize: garbage in, defaults out; unknown keys are dropped', () => {
  for (const bad of [null, undefined, 7, 'x', [], [1, 2], () => 1, true]) assert.deepEqual(normalize(bad), DEFAULTS, String(bad));
  assert.deepEqual(normalize({ contrast: 'yes', hints: 'sometimes', resolution: 'ultra' }), DEFAULTS, 'wrong types');
  assert.deepEqual(normalize({ contrast: true, hints: 'off', resolution: 'full', volume: 3, __proto__: { hacked: 1 } }), { contrast: true, hints: 'off', resolution: 'full', captions: false });
});

test('set saves, a new game reads it back', () => {
  const st = mem();
  const a = createSettings({ storage: st });
  assert.deepEqual(a.set({ contrast: true }), { contrast: true, hints: 'auto', resolution: 'auto', captions: false });
  a.set({ hints: 'on', resolution: 'full' });
  assert.deepEqual(JSON.parse(st.d[KEY]), { contrast: true, hints: 'on', resolution: 'full', captions: false });
  assert.deepEqual(createSettings({ storage: st }).get(), { contrast: true, hints: 'on', resolution: 'full', captions: false });
});

test('invalid values fall back to the defaults, and the object the caller holds is a copy', () => {
  const s = createSettings({ storage: mem() });
  s.set({ contrast: true, hints: 'on' });
  assert.deepEqual(s.set({ hints: 'loud' }), { contrast: true, hints: 'auto', resolution: 'auto', captions: false });
  const copy = s.get();
  copy.contrast = false;
  assert.equal(s.get().contrast, true, 'get() hands out a copy');
  assert.deepEqual(s.set(null), s.get(), 'a null patch changes nothing');
});

test('corrupted or foreign saves never break the game', () => {
  for (const text of ['{not json', '[]', '"hi"', '12', 'null', JSON.stringify({ contrast: 'yes', hints: 5 })]) {
    assert.deepEqual(createSettings({ storage: mem({ [KEY]: text }) }).get(), DEFAULTS, text);
  }
});

test('a blocked or full storage is fine: the change still applies, it is just not remembered', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  const s = createSettings({ storage: broken });
  assert.deepEqual(s.get(), DEFAULTS);
  assert.deepEqual(s.set({ contrast: true }), { contrast: true, hints: 'auto', resolution: 'auto', captions: false });
  assert.equal(createSettings({ storage: null }).set({ hints: 'off' }).hints, 'off', 'no storage at all');
});

test('listeners hear a real change once, not a no-op; off() stops them; one bad listener does not stop the others', () => {
  const s = createSettings({ storage: mem() });
  const seen = [];
  const off = s.on((v) => seen.push(v));
  s.on(() => { throw new Error('boom'); });
  const later = [];
  s.on((v) => later.push(v));
  s.set({ contrast: true });
  s.set({ contrast: true }); // no change
  s.set({ hints: 'nonsense' }); // falls back to 'auto' = no change
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], { contrast: true, hints: 'auto', resolution: 'auto', captions: false });
  off();
  s.set({ hints: 'off' });
  assert.equal(seen.length, 1, 'unsubscribed');
  assert.equal(later.length, 2, 'the listener after the broken one still ran');
  s.reset();
  assert.deepEqual(s.get(), DEFAULTS);
  assert.equal(later.length, 3, 'reset is a change too');
});

test('sound captions: off by default, only a real true turns them on, remembered, and told once', () => {
  assert.equal(DEFAULTS.captions, false);
  for (const bad of ['yes', 1, 'true', null, {}, []]) assert.equal(normalize({ captions: bad }).captions, false, String(bad));
  assert.equal(normalize({ captions: true }).captions, true);
  const st = mem();
  const s = createSettings({ storage: st });
  const seen = [];
  s.on((v) => seen.push(v.captions));
  s.set({ captions: true });
  s.set({ captions: true });
  assert.deepEqual(seen, [true], 'told once');
  assert.equal(createSettings({ storage: st }).get().captions, true, 'remembered');
  assert.equal(s.set({ contrast: true }).captions, true, 'another setting does not undo it');
});

console.log(`${n} settings tests passed`);
