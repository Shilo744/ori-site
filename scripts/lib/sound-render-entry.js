// Runs INSIDE the headless browser (bundled by scripts/sound-render.mjs): renders the real sounds of the ring offline with an OfflineAudioContext, exactly the code the game
// plays (fight-sfx.js, fight-music.js), seeded so a render is reproducible. Exposes window.__sound.{list, sfx, music, sting, scenario}; each returns { rate, n, ch: [base64 Float32, ...] }.
import { createFightSfx } from '../../src/game3d/favors/fight-sfx.js';
import { createFightMusic, TRACKS } from '../../src/game3d/favors/fight-music.js';
import { SOUNDS, MUSIC, STING_LIST } from '../../src/game3d/favors/sound-list.js';

const RATE = 44100;
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function b64(f32) {
  const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function pack(buf) {
  const ch = [];
  for (let c = 0; c < buf.numberOfChannels; c++) ch.push(b64(buf.getChannelData(c)));
  return { rate: buf.sampleRate, n: buf.length, ch };
}
/** Renders `len` seconds; `setup(sfx, ctx, at)` books things now (t = 0); `at(t, fn)` runs fn at time t of the render (the context is suspended there, fn plays sounds, it resumes). */
async function render(len, setup, seed = 7) {
  const ctx = new OfflineAudioContext(2, Math.ceil(RATE * len), RATE);
  const sfx = createFightSfx({ context: ctx, rnd: seeded(seed) });
  const jobs = [];
  const at = (t, fn) => jobs.push([t, fn]);
  setup(sfx, ctx, at);
  jobs.sort((a, b) => a[0] - b[0]);
  const seen = new Set();
  for (const [t, fn] of jobs) {
    const tq = Math.round(t * RATE / 128) * 128 / RATE; // (suspend points are multiples of the render quantum)
    if (seen.has(tq)) { fn(); continue; }
    seen.add(tq);
    ctx.suspend(tq).then(() => { fn(); ctx.resume(); });
  }
  const out = pack(await ctx.startRendering());
  out.alive = sfx.audio.alive;
  return out;
}

const hit = (dmg, extra = {}) => ({ dmg, heavy: dmg >= 13, combo: 1, counter: false, target: 'opp', ...extra });

const SCENARIOS = {
  /** The whole thing at once: full-on music and a fight going on (flurry, uppercut, counter, block, parry, a knock-down, the K.O. and the cheer). */
  mix: { len: 12, setup: (sfx, ctx, at) => {
    const mu = createFightMusic({ audio: sfx.audio });
    mu.scheduleRange({ boss: false, from: 0, to: 96, t0: 0.05, level: 3 });
    sfx.crowdStart(60);
    const hits = [[1.0, 8], [1.35, 8], [1.7, 17], [2.5, 31], [3.4, 12, 'player'], [3.8, 8], [4.2, 33, 'opp', true], [5.0, 17]];
    for (const [t, d, who, counter] of hits) at(t, () => sfx.thud(hit(d, { target: who || 'opp', counter: !!counter, combo: 2 })));
    at(3.0, () => sfx.block(2)); at(3.6, () => sfx.parry()); at(4.9, () => sfx.gasp(1));
    at(6.5, () => { sfx.knockdown('opp'); mu.pause(true); }); at(7.5, () => sfx.count(1)); at(8.5, () => sfx.count(2)); at(9.0, () => { sfx.getup('opp'); mu.pause(false); });
    at(10.0, () => { sfx.ko('opp'); }); at(10.9, () => sfx.cheer(1.3));
  } },
  /** Music at full level; at 3.0 s a duck(0.8, 0.6): the music must dip at once and be back by 4.5 s. */
  duck: { len: 8, setup: (sfx, ctx, at) => { const mu = createFightMusic({ audio: sfx.audio }); mu.scheduleRange({ boss: false, from: 0, to: 64, t0: 0.05, level: 2 }); at(3.0, () => sfx.duck(0.8, 0.6)); } },
  /** Music and a hit; slow motion from 3.0 s: everything above 3 kHz must fall away. */
  'slow-ref': { len: 7, setup: (sfx) => { const mu = createFightMusic({ audio: sfx.audio }); mu.scheduleRange({ boss: false, from: 0, to: 48, t0: 0.05, level: 3 }); } },
  slow: { len: 7, setup: (sfx, ctx, at) => { const mu = createFightMusic({ audio: sfx.audio }); mu.scheduleRange({ boss: false, from: 0, to: 48, t0: 0.05, level: 3 }); at(3.0, () => sfx.setSlow(true)); at(5.0, () => sfx.setSlow(false)); } },
};

window.__sound = {
  list: () => ({ sounds: SOUNDS.map(({ id, group, len, from, expect, label }) => ({ id, group, len, from: from || 0, expect: expect || {}, label })), music: MUSIC, stings: STING_LIST, scenarios: Object.keys(SCENARIOS) }),
  sfx: (id, seed = 7) => { const s = SOUNDS.find((x) => x.id === id); return render(s.len + 1.0, (sfx) => s.play(sfx), seed); },
  music: (id) => {
    const m = MUSIC.find((x) => x.id === id);
    const sd = 60 / TRACKS[m.boss ? 'boss' : 'fight'].bpm / 4;
    return render(m.bars * 16 * sd + 1.5, (sfx) => { const mu = createFightMusic({ audio: sfx.audio }); mu.scheduleRange({ boss: m.boss, from: 0, to: m.bars * 16, t0: 0.05, level: m.level }); });
  },
  sting: (id) => { const s = STING_LIST.find((x) => x.id === id); return render(s.len + 1.0, (sfx) => { const mu = createFightMusic({ audio: sfx.audio }); mu.sting(s.kind, 0); }); },
  scenario: (name) => { const s = SCENARIOS[name]; return render(s.len, s.setup); },
};
