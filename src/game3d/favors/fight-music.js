// "Ori, Can You...?" — the FIGHT MUSIC, synthesised (no files) and nothing like the street music's marimba: E minor, 128 bpm, four on the floor, a bass riff, stabs and
// arps, a lead on top. It is a look-ahead scheduler (a 30 ms timer books the notes 150 ms ahead on the audio clock, so it never drifts and never stutters when the
// game does), and every note is PURE DATA first: `stepEvents(track, step, level)` says what plays on a 16th-note step, `instrument()` turns an event into voices for the
// engine of fight-sfx.js. So the music is tested in Node, and rendered offline to WAV for the loudness checks.
//   Layers come in with the intensity (0..1, set by fight3d from the health of the two fighters and the clock; they change on a bar line, with hysteresis):
//     level 0  kick, closed hats, bass          level 1  + snare / clap, open hats, stabs        level 2  + 16th arp, crash, ghost kicks      level 3  + lead, fills, riser
//   The HIDDEN BOSS gets his own track: 156 bpm, C# phrygian, 16th-note bass, broken kicks, stutter retriggers (32nds), data pings, random-walk arps, a tape-stop every 8 bars,
//   everything but the kick and the bass through a 5-bit crusher. Silence on a knock-out, then a short sting (win / lose / boss).
// API of createFightMusic({ audio, timer?, active? })   (audio = sfx.audio, the engine shared with the sounds; timer = { set, clear } to drive the scheduler in tests;
//   active = () => boolean: false while the game is not updating, e.g. paused - the music goes quiet and comes back on a bar line)
//   start({ boss, intensity })   begins on the next tick (waits quietly while muted)      setIntensity(x)  0..1, cheap (call it every frame)
//   pause(on)                    the knock-down count: the music nearly goes away and comes back at the get-up      duck(amount, release)  under a big hit (also done by sfx)
//   stop({ fade, now })          fades out (0.3 s) or cuts (now)       sting(kind, delay)  'win' | 'lose' | 'boss'       dispose()      stats() / playing / level
//   scheduleRange(from, to, t0)  books steps from..to at the audio time t0 with no timer (the offline renderer)
// It respects isMuted() / volume() (through the engine), stops its timer on stop / dispose, and takes every node down again.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mtof = (n) => 440 * 2 ** ((n - 69) / 12);

/** A steady 0..1 hash of two numbers (so the boss's "random" glitches are the same every time: tests and offline renders reproduce them). */
export function hash01(a, salt = 0) {
  let h = (Math.imul((a | 0) + 0x9e3779b9 + salt * 0x85ebca6b, 0x27d4eb2d) ^ (salt * 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const TRACKS = {
  fight: {
    id: 'fight', bpm: 128, minLevel: 0,
    bass: [28, 36, 31, 38], // E1 C2 G1 D2: one chord a bar (Em C G D)
    chords: [[55, 59, 62, 64], [55, 59, 60, 64], [55, 59, 62, 67], [57, 62, 66, 69]],
    arp: [[64, 67, 71, 74], [64, 67, 72, 76], [62, 67, 71, 74], [62, 66, 69, 74]],
    arpPattern: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3],
    // the bass: R root, O octave, F fifth, per 16th of a bar
    bassBars: ['R..R..R.R.O.R..F', 'R..R.R..R...O.RF'],
    // the lead: [step in a 4 bar phrase (0..63), midi, length in steps]
    lead: [[0, 76, 3], [4, 79, 2], [7, 76, 1], [8, 74, 2], [11, 71, 2], [14, 74, 1], [15, 76, 1],
      [16, 79, 3], [20, 76, 2], [23, 79, 1], [24, 84, 3], [28, 83, 2], [30, 79, 1],
      [32, 79, 3], [36, 83, 2], [39, 79, 1], [40, 78, 2], [43, 74, 2], [46, 78, 1], [47, 79, 1],
      [48, 78, 3], [52, 74, 2], [55, 78, 1], [56, 81, 3], [60, 79, 2], [62, 76, 2]],
  },
  boss: {
    id: 'boss', bpm: 156, minLevel: 1,
    bass: [37, 37, 40, 38], // C#2 C#2 E2 D2 (phrygian)
    scale: [61, 62, 64, 66, 68, 69, 71, 73, 74, 76, 78, 80, 81], // C# D E F# G# A B C# D E F# G# A
    bassBars: ['R.RR.bR.R.R.R.bR', 'R.RR.bR.R.R.RbR.'],
    chords: [[61, 64, 68], [61, 64, 68], [64, 68, 71], [62, 66, 69]],
  },
};

const BASS_OFFSET = { R: 0, O: 12, F: 7, b: 1 };

/** The layer (0..3) for an intensity, with hysteresis so it does not flutter. */
export function levelFor(v, cur = 0, minLevel = 0) {
  const up = [0.3, 0.55, 0.78]; const down = [0.22, 0.45, 0.7];
  let L = cur;
  while (L < 3 && v >= up[L]) L++;
  while (L > 0 && v < down[L - 1]) L--;
  return Math.max(minLevel, L);
}

/**
 * What plays on a 16th-note step. `step` counts from the start of the track (16 to a bar), `level` 0..3.
 * Returns [{ inst, note?, notes?, vel, dur (in steps), off (a fraction of a step: 32nd stutters) }].
 */
export function stepEvents(trackId, step, level) {
  const T = TRACKS[trackId] || TRACKS.fight;
  const bar = Math.floor(step / 16); const s = step % 16; const ci = bar % 4;
  const L = Math.max(level, T.minLevel);
  const out = [];
  const ev = (inst, vel, dur = 1, extra = {}) => out.push({ inst, vel, dur, off: 0, ...extra });
  const bassPat = T.bassBars[bar % 2];
  const bc = bassPat[s];
  if (trackId === 'boss') {
    // drums: a broken beat; a stutter every fourth bar
    const kicks = bar % 2 ? [0, 3, 6, 10, 12, 14] : [0, 3, 6, 10, 12];
    if (kicks.includes(s)) ev('kick', s === 0 ? 1 : 0.85);
    if (L >= 1) {
      if (s === 4 || s === 12) ev('snare', 1);
      if ((s === 7 || s === 15) && hash01(step, 2) < 0.7) ev('snare', 0.35);
    }
    if (hash01(step, 11) > 0.18) ev('hat', 0.2 + 0.35 * hash01(step, 12), 1, { boss: true });
    if (L >= 1 && hash01(step, 17) < 0.2) ev('ping', 0.5 + 0.3 * hash01(step, 18), 0.6, { note: T.scale[Math.floor(hash01(step, 19) * T.scale.length)] + 12 });
    if (L >= 2 && hash01(step, 13) < 0.3) ev('tick', 0.5, 0.3, { off: hash01(step, 14) < 0.5 ? 0 : 0.5 });
    if (L >= 2) { const idx = Math.floor(hash01(step >> 1, 23) * T.scale.length); ev('arp', 0.3 + 0.1 * (s % 4 === 0 ? 1 : 0), 0.7, { note: T.scale[idx] + 12, boss: true }); }
    if (L >= 3 && bar % 4 === 3 && s >= 12) { ev('snare', 0.5 + 0.1 * (s - 12), 0.5); ev('snare', 0.4 + 0.1 * (s - 12), 0.5, { off: 0.5 }); }
    if (L >= 3 && s % 2 === 0 && hash01(step, 29) < 0.6) { const idx = Math.floor(hash01(step, 31) * 8) + 4; ev('lead', 0.5, 1.6, { note: T.scale[idx] + 12, boss: true }); }
    if (L >= 3 && s === 0 && bar % 4 === 3) ev('riser', 0.8, 16);
    if (bar % 8 === 7 && s === 12 && L >= 2) ev('tape', 0.8, 6, { note: T.scale[7] + 12 });
    if (bc !== '.') ev('bass', 0.9, bc === 'R' ? 0.8 : 0.6, { note: T.bass[ci] + BASS_OFFSET[bc], boss: true });
    return out;
  }
  // ── the fight track ──
  const kicks = [0, 4, 8, 12];
  if (L >= 2 && bar % 2 === 1) kicks.push(15);
  if (L >= 3 && bar % 4 === 3) kicks.push(10, 14);
  if (kicks.includes(s)) ev('kick', s === 15 || s === 10 || s === 14 ? 0.55 : s % 8 === 0 ? 1 : 0.9);
  if (L >= 1 && (s === 4 || s === 12)) ev('snare', 1);
  if (L >= 3 && bar % 4 === 3 && s >= 12) ev('snare', 0.4 + 0.15 * (s - 12), 0.5); // the roll before the next phrase
  if (L >= 1 && s % 4 === 2) ev('ohat', 0.5, 1.5); // the off-beat open hat
  else if (L >= 2 || s % 2 === 0) ev('hat', L >= 2 ? (s % 4 === 0 ? 0.55 : s % 2 === 0 ? 0.4 : 0.25) : (s % 4 === 0 ? 0.55 : 0.4));
  if (bc !== '.') ev('bass', 0.9, bc === 'R' ? 0.9 : 0.7, { note: T.bass[ci] + BASS_OFFSET[bc] });
  if (L >= 1 && (bar % 2 === 0 ? [3, 6, 10] : [3, 10, 13]).includes(s)) ev('stab', 0.6, 1.5, { notes: T.chords[ci] });
  if (L >= 2) ev('arp', s % 4 === 0 ? 0.5 : 0.34, 0.9, { note: T.arp[ci][T.arpPattern[s]] });
  if (L >= 2 && s === 0 && bar % 4 === 0) ev('crash', 0.7, 8);
  if (L >= 3) for (const [at, note, len] of T.lead) if (at === step % 64) ev('lead', 0.55, len, { note });
  if (L >= 3 && s === 0 && bar % 4 === 3) ev('riser', 0.7, 16);
  return out;
}

/** The voices of one event: { bus, voices } for the engine (fight-sfx.js voice()). `sd` = seconds per 16th step. */
export function instrument(e, sd) {
  const v = e.vel;
  const hold = Math.max(0.03, e.dur * sd);
  switch (e.inst) {
    case 'kick': return { bus: 'drums', voices: [
      { tag: 'kick', k: 'osc', type: 'sine', f0: 158, f1: 44, fdur: 0.11, dur: 0.36, peak: 0.95 * v, att: 0.001 },
      { tag: 'tail', k: 'osc', type: 'sine', f0: 58, f1: 46, fdur: 0.2, dur: 0.26, peak: 0.3 * v, att: 0.004 },
      { tag: 'click', k: 'noise', dur: 0.008, peak: 0.22 * v, att: 0.0003, hp: { f0: 3000 } },
    ] };
    case 'snare': return { bus: 'drums', voices: [
      { tag: 'body', k: 'osc', type: 'triangle', f0: 205, f1: 135, fdur: 0.08, dur: 0.14, peak: 0.42 * v, att: 0.001 },
      { tag: 'noise', k: 'noise', dur: 0.17 * (0.6 + 0.4 * v), peak: 0.7 * v, att: 0.001, bp: { f0: 1900, q: 0.7 } },
      { tag: 'snap', k: 'noise', dur: 0.1, peak: 0.35 * v, att: 0.0005, hp: { f0: 4500 } },
      { tag: 'clap-1', k: 'noise', dur: 0.012, peak: 0.3 * v, att: 0.0004, bp: { f0: 1200, q: 1 }, delay: 0.004 },
      { tag: 'clap-2', k: 'noise', dur: 0.012, peak: 0.26 * v, att: 0.0004, bp: { f0: 1200, q: 1 }, delay: 0.014 },
    ], send: 0.12 };
    case 'hat': return { bus: e.boss ? 'crush' : 'hats', voices: [{ tag: 'hat', k: 'noise', dur: 0.04, peak: 0.4 * v, att: 0.0005, hp: { f0: 7200 } }] };
    case 'ohat': return { bus: 'hats', voices: [{ tag: 'ohat', k: 'noise', dur: Math.min(0.2, hold), peak: 0.32 * v, att: 0.001, hp: { f0: 6000 } }] };
    case 'tick': return { bus: 'crush', voices: [{ tag: 'tick', k: 'noise', dur: 0.014, peak: 0.4 * v, att: 0.0003, hp: { f0: 5200 } }] };
    case 'bass': { const f = mtof(e.note); return { bus: e.boss ? 'bassBoss' : 'bass', voices: [
      { tag: 'saw', k: 'osc', type: 'sawtooth', f0: f, f1: f, dur: Math.max(0.09, hold * 0.95), peak: e.boss ? 0.3 * v : 0.36 * v, att: 0.004, lp: { f0: e.boss ? 1100 : 760, f1: e.boss ? 300 : 260, q: 3, fdur: 0.14 } },
      { tag: 'sub', k: 'osc', type: 'sine', f0: f, f1: f, dur: Math.max(0.09, hold * 0.95), peak: 0.35 * v, att: 0.006 },
    ] }; }
    case 'stab': return { bus: 'synth', send: 0.18, voices: e.notes.map((n, i) => (
      { tag: 'stab', k: 'osc', type: 'sawtooth', f0: mtof(n), f1: mtof(n), det: i % 2 ? 6 : -6, dur: Math.max(0.12, hold), peak: 0.12 * v, att: 0.004, lp: { f0: 2600, f1: 800, q: 1, fdur: 0.18 } }
    )) };
    case 'arp': { const f = mtof(e.note); return { bus: e.boss ? 'crush' : 'synth', voices: [{ tag: 'arp', k: 'osc', type: 'square', f0: f, f1: f, dur: Math.max(0.06, hold * 0.9), peak: 0.11 * v, att: 0.002, lp: { f0: 2800, f1: 1200, q: 1, fdur: 0.08 } }] }; }
    case 'lead': { const f = mtof(e.note); return { bus: e.boss ? 'crush' : 'lead', voices: [
      { tag: 'lead', k: 'osc', type: 'sawtooth', f0: f, f1: f, det: -8, dur: Math.max(0.1, hold), peak: 0.1 * v, att: 0.008, lp: { f0: 3600, f1: 1800, q: 1.5, fdur: hold } },
      { tag: 'lead', k: 'osc', type: 'sawtooth', f0: f, f1: f, det: 8, dur: Math.max(0.1, hold), peak: 0.1 * v, att: 0.008, lp: { f0: 3600, f1: 1800, q: 1.5, fdur: hold } },
    ] }; }
    case 'ping': { const f = mtof(e.note); return { bus: 'crush', voices: [{ tag: 'ping', k: 'osc', type: 'triangle', f0: f, f1: f * 1.0, dur: 0.07, peak: 0.1 * v, att: 0.001 }] }; }
    case 'riser': return { bus: 'synth', voices: [{ tag: 'riser', k: 'noise', pink: true, dur: hold, peak: 0.28 * v, env: [[0, 0.02], [hold * 0.85, 1], [hold, 0.02]], bp: { f0: 300, f1: 7000, q: 1.2, fdur: hold } }] };
    case 'crash': return { bus: 'hats', voices: [{ tag: 'crash', k: 'noise', dur: 1.3, peak: 0.3 * v, att: 0.002, hp: { f0: 4800 }, send: 0.3 }] };
    case 'tape': { const f = mtof(e.note); return { bus: 'lead', voices: [{ tag: 'tape', k: 'osc', type: 'sawtooth', f0: f, f1: 40, fdur: 0.55, dur: 0.6, peak: 0.1 * v, att: 0.01, lp: { f0: 2400, f1: 500, q: 1, fdur: 0.5 } }] }; }
    default: return { bus: 'synth', voices: [] };
  }
}

/** The stings: what plays after the knock-out. Each is { voices } for the music bus. */
export const STINGS = {
  /** a win: a brass-ish major chord, a rising run, a cymbal */
  win() {
    const root = 64; // E4
    const v = [];
    [0, 4, 7, 12].forEach((s, i) => { const f = mtof(root + s); v.push({ tag: 'brass', k: 'osc', type: 'sawtooth', f0: f, f1: f, det: -5, dur: 1.4, peak: 0.07, att: 0.012, lp: { f0: 2600, f1: 1000, q: 1, fdur: 1.0 }, delay: 0.02 * i, send: 0.3 }, { tag: 'brass', k: 'osc', type: 'sawtooth', f0: f, f1: f, det: 5, dur: 1.4, peak: 0.07, att: 0.012, lp: { f0: 2600, f1: 1000, q: 1, fdur: 1.0 }, delay: 0.02 * i }); });
    [0, 4, 7, 12, 16].forEach((s, i) => v.push({ tag: 'run', k: 'osc', type: 'triangle', f0: mtof(root + 12 + s), f1: mtof(root + 12 + s), dur: i === 4 ? 0.9 : 0.25, peak: 0.1, att: 0.003, delay: 0.1 + i * 0.07, send: 0.3 }));
    v.push({ tag: 'kick', k: 'osc', type: 'sine', f0: 150, f1: 44, fdur: 0.11, dur: 0.35, peak: 0.8, att: 0.001 });
    v.push({ tag: 'cymbal', k: 'noise', dur: 1.5, peak: 0.2, att: 0.004, hp: { f0: 5000 }, send: 0.3 });
    return { voices: v, dur: 1.6 };
  },
  /** a loss: warm and short - two soft falling notes ("next time"), never a harsh buzz */
  lose() {
    const v = [];
    [[64, 0], [60, 0.28]].forEach(([n, t]) => { v.push({ tag: 'pad', k: 'osc', type: 'triangle', f0: mtof(n), f1: mtof(n), dur: 0.9, peak: 0.32, att: 0.03, delay: t, lp: { f0: 1800 }, send: 0.4 }, { tag: 'pad', k: 'osc', type: 'sine', f0: mtof(n - 12), f1: mtof(n - 12), dur: 0.9, peak: 0.3, att: 0.03, delay: t }, { tag: 'pad', k: 'osc', type: 'triangle', f0: mtof(n + 7), f1: mtof(n + 7), dur: 0.8, peak: 0.12, att: 0.03, delay: t, lp: { f0: 1800 } }); });
    return { voices: v, dur: 1.3 };
  },
  /** the hidden boss falls: the glitch resolves into a clean chord */
  boss(rnd = Math.random) {
    const v = [];
    for (let i = 0; i < 6; i++) v.push({ tag: 'glitch', k: 'osc', type: 'square', f0: lerp(500, 2600, rnd()), f1: lerp(500, 2600, rnd()), fdur: 0.02, dur: 0.03, peak: 0.07, att: 0.001, delay: i * 0.05 });
    const root = 61; // C#4
    [0, 4, 7, 12].forEach((s) => v.push({ tag: 'resolve', k: 'osc', type: 'triangle', f0: mtof(root + s), f1: mtof(root + s), dur: 1.5, peak: 0.1, att: 0.01, delay: 0.34, send: 0.4 }));
    v.push({ tag: 'sweep', k: 'noise', pink: true, dur: 0.4, peak: 0.16, env: [[0, 0.02], [0.3, 1], [0.4, 0.02]], bp: { f0: 400, f1: 6000, q: 1.2, fdur: 0.35 } });
    v.push({ tag: 'kick', k: 'osc', type: 'sine', f0: 150, f1: 44, fdur: 0.11, dur: 0.35, peak: 0.8, att: 0.001, delay: 0.34 });
    return { voices: v, dur: 2.0 };
  },
};

const STING_GAIN = { win: 2.8, lose: 2.2, boss: 3.7 }; // (they play through the music bus, which sits low)
const BOSS_GAIN = 0.7; // the boss track is written hotter: -3 dB brings it level with the fight track
const LOOK = 0.15; // seconds booked ahead
const TICK_MS = 30;
const BUS_LEVELS = { drums: 1, hats: 0.8, bass: 0.95, bassBoss: 0.95, synth: 0.85, lead: 0.8, crush: 0.7 };

/**
 * @param {{ audio: ReturnType<import('./fight-sfx.js').createRingAudio>, timer?: { set: (fn: () => void, ms: number) => any, clear: (id: any) => void } }} o
 */
export function createFightMusic({ audio, timer = null, active = null }) {
  const T = timer || { set: (fn, ms) => setInterval(fn, ms), clear: (id) => clearInterval(id) };
  let running = false;
  let trackId = 'fight';
  let step = 0;
  let nextTime = 0;
  let level = 0;
  let intensity = 0.3;
  let smooth = 0.3;
  let timerId = null;
  let chain = null; // the persistent nodes of the music (made on the first tick that has an audio context)
  let counting = false; // a knock-down count is on: the music is all but gone
  let wasActive = true;
  const stat = { scheduled: 0, ticks: 0, lastTick: 0, levelChanges: 0 };

  const stepDur = () => 60 / TRACKS[trackId].bpm / 4;

  function crushCurve(bits = 5) {
    const n = 1025; const c = new Float32Array(n); const q = 2 ** bits;
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.round(x * q) / q; }
    return c;
  }
  function softCurve() {
    const n = 513; const c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 1.8) / Math.tanh(1.8); }
    return c;
  }

  function buildChain(c) {
    const nodes = [];
    const add = (n) => { nodes.push(n); return n; };
    const gate = add(c.createGain()); gate.gain.value = 1;
    gate.connect(audio.nodes.music);
    const pump = add(c.createGain()); pump.gain.value = 1; pump.connect(gate); // the sidechain: everything but the drums ducks a little on every kick
    const bus = (name, dest) => { const b = add(c.createGain()); b.gain.value = BUS_LEVELS[name]; b.connect(dest); return b; };
    const drums = bus('drums', gate);
    const hats = bus('hats', gate);
    const bass = bus('bass', pump);
    const sat = add(c.createWaveShaper()); sat.curve = softCurve();
    const bassBoss = add(c.createGain()); bassBoss.gain.value = BUS_LEVELS.bassBoss; bassBoss.connect(sat); sat.connect(pump);
    const synth = bus('synth', pump);
    const lead = bus('lead', pump);
    const crush = add(c.createGain()); crush.gain.value = BUS_LEVELS.crush;
    const cr = add(c.createWaveShaper()); cr.curve = crushCurve(5); crush.connect(cr); cr.connect(pump);
    // a dotted-eighth echo on the synths and the lead: it makes the arps spacious
    const echo = add(c.createDelay(1)); echo.delayTime.value = (60 / TRACKS.fight.bpm) * 0.75;
    const fb = add(c.createGain()); fb.gain.value = 0.34;
    const damp = add(c.createBiquadFilter()); damp.type = 'lowpass'; damp.frequency.value = 2600;
    const wet = add(c.createGain()); wet.gain.value = 0.22;
    for (const src of [synth, lead]) src.connect(echo);
    echo.connect(damp); damp.connect(fb); fb.connect(echo); damp.connect(wet); wet.connect(pump);
    chain = { gate, pump, drums, hats, bass, bassBoss, synth, lead, crush, nodes };
  }

  function dropChain() {
    if (!chain) return;
    for (const n of chain.nodes) { try { n.disconnect(); } catch { /* gone */ } }
    chain = null;
  }

  function pumpAt(t) {
    const p = chain.pump.gain;
    p.setValueAtTime(0.45, t);
    p.linearRampToValueAtTime(1, t + 0.17);
  }

  function scheduleStep(st, t) {
    const sd = stepDur();
    if (st % 16 === 0) { const L = levelFor(smooth, level, TRACKS[trackId].minLevel); if (L !== level) { level = L; stat.levelChanges++; } }
    const evs = stepEvents(trackId, st, level);
    let kick = false;
    for (const e of evs) {
      const r = instrument(e, sd);
      const dest = chain[r.bus] || chain.synth;
      const tt = t + (e.off || 0) * sd;
      for (const v of r.voices) audio.voice(r.send ? { ...v, send: v.send ?? r.send } : v, tt, dest, trackId === 'boss' ? BOSS_GAIN : 1);
      if (e.inst === 'kick') kick = true;
      stat.scheduled++;
    }
    if (kick) pumpAt(t);
  }

  function tick() {
    if (!running) return;
    const c = audio.ready();
    stat.ticks++;
    if (!c) return; // muted / no context: it waits (and falls behind the clock, so it comes back on a bar line)
    if (!chain) { buildChain(c); nextTime = c.currentTime + 0.06; }
    const now = c.currentTime;
    const on = !active || active();
    if (on !== wasActive) { wasActive = on; chain.gate.gain.setTargetAtTime(on ? (counting ? 0.08 : 1) : 0.0001, now, on ? 0.15 : 0.06); } // (the game is paused: quiet, and back when it runs)
    if (!on) return;
    stat.lastTick = now;
    if (nextTime < now) { nextTime = now + 0.03; step = Math.ceil(step / 16) * 16; } // late (a hidden tab, a mute): rejoin on a bar line, no burst of catch-up notes
    smooth += (intensity - smooth) * 0.12;
    while (nextTime < now + LOOK) {
      scheduleStep(step, nextTime);
      nextTime += stepDur();
      step++;
    }
  }

  const api = {
    get playing() { return running; },
    get level() { return level; },
    get track() { return trackId; },
    stats() { return { running, track: trackId, bpm: TRACKS[trackId].bpm, step, level, intensity: smooth, ...stat, alive: audio.alive, gate: chain ? chain.gate.gain.value : null }; },
    /** Starts the music (the next tick, or when the sound is unmuted). */
    start({ boss = false, intensity: i = 0.3 } = {}) {
      if (running) api.stop({ now: true });
      trackId = boss ? 'boss' : 'fight';
      step = 0; level = TRACKS[trackId].minLevel; intensity = smooth = clamp(i, 0, 1);
      running = true; counting = false; wasActive = true;
      if (timerId == null) timerId = T.set(tick, TICK_MS);
      tick();
      if (chain) { const c = audio.ctx; chain.gate.gain.cancelScheduledValues(c.currentTime); chain.gate.gain.setValueAtTime(1, c.currentTime); }
    },
    setIntensity(x) { intensity = x < 0 ? 0 : x > 1 ? 1 : x; },
    /** The count of a knock-down: the music all but goes away, and comes back at the get-up. */
    pause(on) {
      const c = audio.ctx;
      counting = !!on;
      if (!chain || !c || !wasActive) return;
      chain.gate.gain.setTargetAtTime(on ? 0.08 : 1, c.currentTime, on ? 0.05 : 0.18);
    },
    duck(amount, release) { audio.duck(amount, release); },
    /** Fades out (default 0.3 s) or cuts at once. Safe to call when it is not playing. */
    stop({ fade = 0.3, now = false } = {}) {
      if (timerId != null) { T.clear(timerId); timerId = null; }
      const was = running;
      running = false;
      const c = audio.ctx;
      if (!chain || !c) { dropChain(); return; }
      const t = c.currentTime;
      chain.gate.gain.cancelScheduledValues(t);
      if (now || fade <= 0) { chain.gate.gain.setValueAtTime(0, t); dropChain(); return; }
      chain.gate.gain.setValueAtTime(chain.gate.gain.value, t);
      chain.gate.gain.linearRampToValueAtTime(0, t + fade);
      const keep = chain; // the notes already booked fade with the gate; the nodes go when they are done
      const id = setTimeoutSafe(() => { if (chain === keep && !running) dropChain(); }, (fade + LOOK + 0.8) * 1000);
      if (id && id.unref) id.unref();
      void was;
    },
    /** The sting after the knock-out: 'win' | 'lose' | 'boss', `delay` seconds from now. */
    sting(kind = 'win', delay = 0) {
      const c = audio.ready();
      if (!c) return;
      const r = (STINGS[kind] || STINGS.win)(audio.rnd);
      audio.nodes.music.gain.cancelScheduledValues(c.currentTime);
      audio.nodes.music.gain.setValueAtTime(audio.musicBase, c.currentTime);
      for (const v of r.voices) audio.voice(v, c.currentTime + 0.01 + delay, audio.nodes.music, STING_GAIN[kind] || 1);
    },
    /** Offline: books the steps from..to at the audio time t0, with no timer (the renderer builds the graph on an OfflineAudioContext and calls this once). */
    scheduleRange({ boss = false, from = 0, to = 64, t0 = 0, level: L = 0 } = {}) {
      const c = audio.ready();
      if (!c) return 0;
      trackId = boss ? 'boss' : 'fight';
      if (!chain) buildChain(c);
      const sd = stepDur();
      level = Math.max(L, TRACKS[trackId].minLevel); smooth = intensity = [0.1, 0.4, 0.65, 0.9][level];
      const before = stat.scheduled;
      for (let st = from; st < to; st++) {
        const evs = stepEvents(trackId, st, level);
        let kick = false;
        for (const e of evs) {
          const r = instrument(e, sd);
          const dest = chain[r.bus] || chain.synth;
          for (const v of r.voices) audio.voice(r.send ? { ...v, send: v.send ?? r.send } : v, t0 + (st - from) * sd + (e.off || 0) * sd, dest, trackId === 'boss' ? BOSS_GAIN : 1);
          if (e.inst === 'kick') kick = true;
          stat.scheduled++;
        }
        if (kick) pumpAt(t0 + (st - from) * sd);
      }
      return stat.scheduled - before;
    },
    dispose() { api.stop({ now: true }); dropChain(); },
  };

  // (a timer for dropping the chain after a fade; the tests replace the clock through `timer`, so this one is only used when the timer is the real one)
  function setTimeoutSafe(fn, ms) { try { return setTimeout(fn, ms); } catch { return null; } }
  return api;
}
