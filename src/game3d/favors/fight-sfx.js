// "Ori, Can You...?" — the SOUND of THE RING, synthesised (no files). Three layers:
//   1. createRingAudio()  the engine: ONE AudioContext (made on the first sound: the game is opened by a click or a key, and the room's mute switch and volume are
//      honoured), a master chain that cannot clip (buses -> slow-motion low-pass -> compressor -> soft ceiling 0.88 -> master gain), an arena reverb, the ducking of
//      the music under big hits, and the "voice" player that turns a plain description of a sound into WebAudio nodes (and takes every node down again when it ends).
//   2. RECIPES            every sound as PURE DATA: a list of voices { k: 'osc' | 'noise', f0, f1, dur, peak, bp / lp / hp filters, pan, send, env... } built from the
//      event that caused it (the damage of a hit, the wind-up of a punch...) and a random function, a little different every time. No WebAudio in here, so they are
//      tested in Node (scripts/test-favors-sound.mjs) and rendered offline to WAV + spectrogram (scripts/sound-render.mjs).
//   3. createFightSfx()   what fight3d.js calls. Same context and buses are given to the music (fight-music.js): `sfx.audio`.
//
// API of createFightSfx({ isMuted, volume, context?, rnd? })   (context = an OfflineAudioContext to render with; rnd = a seeded random for reproducible renders)
//   thud(hit)                 a punch lands. hit = the sim's 'hit' event ({ dmg, heavy, counter, combo, target }) or a power 0..1. Layers: a sub thump that drops in pitch, a
//                             "knock", a body-noise burst, a bright slap + click, a leather pop; a rumble / crack / boom when it is heavy. Scaled by the damage, a little
//                             random every time (pitch +-7%, gain +-10%, which layer leads), higher with the combo. Ducks the music when heavy.
//   whoosh(wind, weight, mine) a punch is thrown: a band-pass sweep over `wind` seconds that PEAKS AT THE STRIKE (weight 0.4 jab ... 1 uppercut; mine = Ori's own, quieter)
//   block(dmg)                a guarded punch: a dull thump + glove pat (no bright slap, so it is never mistaken for a hit)
//   parry()                   a bright "ting": inharmonic metal partials + a short shing
//   perfect()                 a perfect dodge: a rising chime and a time-warp swoop      fury()  Peach Fury power-up      guardbreak()  the guard cracks
//   dash()  blink()  feint()  lag()   a swish; the boss's glitch; a pulled punch; the boss "buffering"
//   bell(times)               the boxing bell: inharmonic partials (1, 2, 2.76, 4.07, 5.4 x f), 2+ s decay, detuned twins that shimmer; `times` strikes 0.3 s apart
//   ko(who)  knockdown(who)  count(n)  getup(who)   the knock-out (huge thump, body on the canvas, crowd gasp, "ringing ears" low-pass duck, then the cheer when he is
//                             the opponent); a fighter goes down; the referee's count 1..5 (a wood tock that rises); the scuffle of getting up + the crowd swell
//   gasp(level)  cheer(level, delay)  "ooh" / applause + voices of the crowd (level 0..1.5; the cheer after a K.O. comes a second later)
//   crowdStart(love)  crowd(love)  crowdStop()   the murmur bed of the crowd: its loudness follows the love of the neighbourhood (0..100)
//   level()  tick()           the level-up jingle; a soft tick
//   bagHit(power)  bagGlance()  click(accent)     the speed bag: leather smack + board rattle; a brush; the count-in
//   setSlow(on)               slow motion (perfect dodge / parry): the whole mix goes through a 850 Hz low-pass (fades back in 80 ms)
//   duck(amount, release)     dips the music bus (0..1) and brings it back;  audio  the shared engine;  dispose()
// Every call is safe whatever happens: muted -> nothing is made; a suspended or failing context -> nothing is made, nothing throws.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const jit = (rnd, amt) => 1 + (rnd() - 0.5) * 2 * amt; // 1 +- amt

/** The loudest sample the master chain lets through: the soft ceiling's value at full input (0.6 + 0.34 tanh(0.4 / 0.34)). */
export const CLIP_CEILING = 0.94;
export const CLIP_MAX = 0.6 + (CLIP_CEILING - 0.6) * Math.tanh(0.4 / (CLIP_CEILING - 0.6));
/** The curve of the soft ceiling: linear up to 0.6, then a smooth knee (inputs beyond +-1 are held at the end of the curve). */
export function clipCurve(n = 1025) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1; const a = Math.abs(x);
    c[i] = a < 0.6 ? x : Math.sign(x) * (0.6 + (CLIP_CEILING - 0.6) * Math.tanh((a - 0.6) / (CLIP_CEILING - 0.6)));
  }
  return c;
}

/** How hard a hit is, 0.08..1: from the damage of the sim's 'hit' event (a jab ~8 = 0.2, a cross ~17 = 0.5, an uppercut ~31 = 0.9), the heavy flag and a counter. */
export function powerOf(hit) {
  if (typeof hit === 'number') return clamp(hit, 0.05, 1);
  const h = hit || {};
  let p = ((h.dmg ?? 9) - 3) / 30;
  if (h.heavy) p += 0.12;
  if (h.counter) p += 0.18;
  return clamp(p, 0.08, 1);
}

/**
 * A narrow band of white noise is much quieter than white noise (a band-pass at 600 Hz with Q 0.8 keeps ~3% of the power), so a noise voice is lifted by the square root of how much of
 * the spectrum its filters cut away. A voice's `peak` then means about the same loudness for a noise as for a sine, however it is filtered. (Capped at x7.)
 */
export function noiseComp(v, nyquist = 22050) {
  let bw = nyquist;
  const mid = (f) => (f.f1 ? Math.sqrt(f.f0 * f.f1) : f.f0);
  if (v.bp) bw = Math.min(bw, mid(v.bp) / (v.bp.q ?? 1));
  if (v.lp) bw = Math.min(bw, mid(v.lp));
  if (v.hp) bw = Math.min(bw, Math.max(1500, nyquist - mid(v.hp)));
  return clamp(Math.sqrt(nyquist / Math.max(60, bw)), 1, 7);
}

/**
 * The loudness calibration, measured by scripts/sound-render.mjs (the A-weighted loudest 200 ms of every sound against the hierarchy of sound-list.js LOUD): the dB each
 * recipe is trimmed by so that a jab is small, a K.O. and the bell are big, a whoosh is a warning under the blow and the murmur is a whisper.
 */
export const TRIM_DB = { whoosh: -20.6, dash: -13.2, feint: -12.9, parry: -11, perfect: -15.6, guardbreak: 1, bell: -15.6, knockdown: 3.6, count: 3.6, getup: -15.8, fury: -9, blink: -9.2, lag: -13.1, gasp: -5.9, cheer: -10, level: -17.5, tick: 0.6, bagHit: -3.8, bagGlance: -0.3, click: -3.6, ko: 0.8 };
export const dbGain = (d) => 10 ** (d / 20);
/** A hit's trim by its power: the jab and the cross about the same, the heavy ones a few dB up (a counter a little more, a hit on Ori a little more). */
export function thudDb(hit) {
  const p = powerOf(hit);
  const x = clamp((p - 0.15) / 0.85, 0, 1);
  const o = typeof hit === 'object' && hit;
  return -5.5 + 5.5 * x * x + (o && o.target === 'player' ? 1.5 : 0); // (the heaviest hits sit at the limiter's ceiling, so the lighter ones are set below it)
}

const finish = (voices, extra = {}) => ({ voices, dur: voices.reduce((m, v) => Math.max(m, (v.delay || 0) + v.dur), 0), ...extra });

/** A pulse train as an envelope (a cheap applause: one noise voice instead of dozens): n pulses at random times. */
function pulses(rnd, n, span, minGap = 0.012) {
  const ts = Array.from({ length: n }, () => rnd() * span).sort((a, b) => a - b);
  const env = [[0, 0.0001]];
  let last = 0;
  for (const t of ts) {
    const t0 = Math.max(t, last + minGap);
    env.push([t0, 0.0001], [t0 + 0.003, lerp(0.35, 1, rnd())], [t0 + 0.012, 0.0001]);
    last = t0 + 0.012;
  }
  env.push([last + 0.02, 0.0001]);
  return env;
}

/** Every sound as data. Each returns { voices: [...], dur, duck?: { amt, rel }, lp?: { f, hold, rel } }. */
export const RECIPES = {
  thud(hit, rnd) {
    const p = powerOf(hit);
    const obj = typeof hit === 'object' && hit;
    const combo = obj ? clamp(obj.combo || 1, 1, 9) : 1;
    const mine = !!obj && obj.target === 'player'; // Ori takes it: a little more in the chest
    const pan = mine ? -0.28 : 0.28;
    const cb = 1 + (combo - 1) * 0.012; // the combo climbs in pitch
    const flavor = Math.floor(rnd() * 3); // which layer leads this time: 0 slap, 1 body, 2 pop
    const g = () => jit(rnd, 0.1);
    const f = () => jit(rnd, 0.07);
    const v = [];
    // layers start a few milliseconds apart (click, slap, body, tone, thump): they fuse into one blow but their peaks do not pile up, so it can be LOUD without being squashed
    v.push({ tag: 'click', k: 'noise', dur: 0.012, peak: 0.6 * lerp(0.6, 1, p) * g(), att: 0.0003, hp: { f0: 4500 } });
    v.push({ tag: 'slap', k: 'noise', dur: 0.04 + 0.03 * p, peak: (flavor === 0 ? 0.7 : 0.5) * lerp(0.75, 1, p) * g(), att: 0.0006, bp: { f0: 2900 * f(), q: 0.7 }, delay: 0.002, send: 0.1 });
    v.push({ tag: 'pop', k: 'noise', dur: 0.06, peak: (flavor === 2 ? 0.7 : 0.4) * g(), att: 0.0008, bp: { f0: 1450 * f(), q: 4 }, delay: 0.004 });
    v.push({ tag: 'body', k: 'noise', dur: lerp(0.1, 0.2, p), peak: (flavor === 1 ? 0.95 : 0.75) * g(), att: 0.002, bp: { f0: lerp(700, 430, p) * f(), q: 0.9 }, lp: { f0: 2200 }, delay: 0.004 });
    v.push({ tag: 'chest', k: 'noise', dur: lerp(0.12, 0.24, p), peak: 0.55 * g(), att: 0.004, lp: { f0: 330 * f(), q: 0.8 }, delay: 0.006 });
    v.push({ tag: 'tone', k: 'osc', type: 'sine', f0: lerp(250, 200, p) * f() * cb, f1: 105, fdur: 0.07, dur: lerp(0.1, 0.16, p), peak: 0.34 * g(), att: 0.002, delay: 0.006 });
    v.push({ tag: 'knock', k: 'osc', type: 'triangle', f0: 430 * f(), f1: 170, fdur: 0.04, dur: 0.06, peak: 0.24 * g(), att: 0.001, delay: 0.003 });
    v.push({ tag: 'thump', k: 'osc', type: 'sine', f0: lerp(135, 110, p) * f() * cb, f1: lerp(55, 42, p), fdur: lerp(0.06, 0.11, p), dur: lerp(0.09, 0.2, p), peak: (0.18 + 0.2 * p) * g(), att: 0.002, delay: 0.008, send: 0.12 });
    if (mine) v.push({ tag: 'inner', k: 'noise', dur: 0.14, peak: 0.08 + 0.28 * p, att: 0.002, lp: { f0: 340 }, delay: 0.004 });
    if (p > 0.5) {
      const h = (p - 0.5) / 0.5;
      v.push({ tag: 'rumble', k: 'noise', dur: lerp(0.22, 0.42, h), peak: 0.18 * (0.5 + 0.5 * h), att: 0.004, lp: { f0: 240 }, delay: 0.01 });
      v.push({ tag: 'crunch', k: 'noise', dur: lerp(0.12, 0.2, h), peak: 0.6 * h, att: 0.002, bp: { f0: 1000 * f(), q: 0.8 }, delay: 0.008 });
      v.push({ tag: 'crack', k: 'noise', dur: 0.1, peak: 0.65 * (0.5 + 0.5 * h), att: 0.0005, hp: { f0: 1400 }, delay: 0.012, send: 0.2 });
      v.push({ tag: 'boom', k: 'osc', type: 'sine', f0: 84 * f(), f1: 34, fdur: 0.3, dur: 0.4, peak: 0.05 + 0.12 * h, att: 0.004, delay: 0.015, send: 0.25 });
    }
    for (const x of v) x.pan = pan;
    return finish(v, { duck: p > 0.5 ? { amt: 0.3 + 0.35 * ((p - 0.5) / 0.5), rel: 0.25 } : null, power: p });
  },

  /** `wind` seconds of wind-up: the sweep rises over all of it and peaks at the strike, then it is gone. */
  whoosh(wind, weight, mine, rnd) {
    const w = clamp(wind || 0.2, 0.08, 0.9);
    const wt = clamp(weight ?? 0.6, 0.2, 1.1);
    const g = (mine ? 0.55 : 0.9) * lerp(0.55, 1, clamp(wt, 0, 1));
    const f = () => jit(rnd, 0.1);
    const pan = mine ? -0.3 : 0.3;
    const v = [
      { tag: 'sweep', k: 'noise', pink: true, dur: w + 0.075, peak: g * 0.5, env: [[0, 0.01], [w * 0.55, 0.32], [w, 1], [w + 0.07, 0.01]], bp: { f0: 240 * f(), f1: lerp(1700, 3200, clamp(wt, 0, 1)) * f(), q: 1.3, fdur: w }, pan },
      { tag: 'air', k: 'noise', dur: w + 0.05, peak: g * 0.2, env: [[0, 0.005], [w * 0.7, 0.2], [w, 1], [w + 0.04, 0.005]], hp: { f0: 3600 * f() }, pan },
    ];
    if (wt > 0.7) v.push({ tag: 'body', k: 'osc', type: 'sine', f0: 105, f1: 62, fdur: w, dur: w + 0.06, peak: g * 0.11, env: [[0, 0.02], [w, 1], [w + 0.05, 0.01]], pan });
    return finish(v, { wind: w });
  },

  block(dmg, rnd) {
    const p = clamp((dmg || 1.5) / 4, 0.15, 1);
    const f = () => jit(rnd, 0.07);
    const g = () => jit(rnd, 0.1);
    return finish([
      { tag: 'thump', k: 'osc', type: 'sine', f0: lerp(215, 175, p) * f(), f1: 85, fdur: 0.08, dur: 0.14, peak: 0.4 * lerp(0.6, 1, p) * g(), att: 0.002, pan: -0.25 },
      { tag: 'tok', k: 'osc', type: 'triangle', f0: 360 * f(), f1: 190, fdur: 0.03, dur: 0.05, peak: 0.28 * g(), att: 0.001, pan: -0.25 },
      { tag: 'pad', k: 'noise', dur: 0.075, peak: 0.34 * g(), att: 0.001, bp: { f0: 520 * f(), q: 0.7 }, lp: { f0: 1500 }, pan: -0.25 },
      { tag: 'brush', k: 'noise', dur: 0.05, peak: 0.1 * g(), att: 0.002, hp: { f0: 2600 }, lp: { f0: 5200 }, delay: 0.004, pan: -0.25 },
    ]);
  },

  parry(rnd) {
    const f0 = 1560 * jit(rnd, 0.03);
    const v = [];
    [[1, 1, 0.55], [1.51, 0.62, 0.38], [2.67, 0.4, 0.26], [4.12, 0.22, 0.16]].forEach(([r, a, d]) => v.push({ tag: 'partial', k: 'osc', type: 'sine', f0: f0 * r, f1: f0 * r * 0.998, dur: d, peak: 0.16 * a, att: 0.0008, send: 0.3 }));
    v.push({ tag: 'click', k: 'noise', dur: 0.014, peak: 0.28, att: 0.0003, hp: { f0: 5000 } });
    v.push({ tag: 'shing', k: 'osc', type: 'sine', f0: 1100, f1: 2700, fdur: 0.05, dur: 0.07, peak: 0.1, att: 0.001 });
    return finish(v);
  },

  perfect(rnd) {
    const v = [];
    const root = 659.25 * jit(rnd, 0.01); // E5
    [0, 4, 7, 12].forEach((s, i) => {
      const f = root * 2 ** (s / 12);
      v.push({ tag: 'chime', k: 'osc', type: 'triangle', f0: f, f1: f, dur: 0.42, peak: 0.13, att: 0.002, delay: 0.05 + i * 0.055, send: 0.35 });
      v.push({ tag: 'glint', k: 'osc', type: 'sine', f0: f * 2.01, f1: f * 2.01, dur: 0.3, peak: 0.05, att: 0.002, delay: 0.05 + i * 0.055 });
    });
    v.push({ tag: 'warp', k: 'osc', type: 'sine', f0: 1300, f1: 170, fdur: 0.42, dur: 0.46, peak: 0.07, att: 0.01 });
    v.push({ tag: 'swell', k: 'noise', pink: true, dur: 0.2, peak: 0.1, env: [[0, 0.02], [0.14, 1], [0.2, 0.02]], bp: { f0: 700, f1: 4200, q: 1.2, fdur: 0.16 } });
    return finish(v);
  },

  fury(rnd) {
    const v = [];
    for (let i = 0; i < 6; i++) v.push({ tag: 'rise', k: 'osc', type: 'sawtooth', f0: 220 * 2 ** (i * 0.25), f1: 220 * 2 ** (i * 0.25 + 0.5), fdur: 0.14, dur: 0.18, peak: 0.07, att: 0.004, delay: i * 0.07, lp: { f0: 2600 }, send: 0.2 });
    v.push({ tag: 'power', k: 'osc', type: 'sine', f0: 90, f1: 360, fdur: 0.5, dur: 0.6, peak: 0.28, att: 0.02, send: 0.25 });
    v.push({ tag: 'sparkle', k: 'noise', dur: 0.5, peak: 0.12, env: [[0, 0.02], [0.4, 1], [0.5, 0.02]], hp: { f0: 5200 } });
    void rnd;
    return finish(v);
  },

  guardbreak(rnd) {
    const f = jit(rnd, 0.06);
    return finish([
      { tag: 'shatter', k: 'noise', dur: 0.2, peak: 0.45, att: 0.0005, hp: { f0: 3200 * f }, send: 0.3 },
      { tag: 'crack', k: 'osc', type: 'triangle', f0: 940 * f, f1: 210, fdur: 0.12, dur: 0.16, peak: 0.3, att: 0.001 },
      { tag: 'thunk', k: 'osc', type: 'sine', f0: 140, f1: 52, fdur: 0.14, dur: 0.22, peak: 0.5, att: 0.002 },
      { tag: 'bits', k: 'noise', dur: 0.3, peak: 0.12, env: pulses(rnd, 7, 0.22), hp: { f0: 4500 }, delay: 0.03 },
    ]);
  },

  dash(rnd) {
    const f = () => jit(rnd, 0.1);
    return finish([
      { tag: 'swish', k: 'noise', pink: true, dur: 0.2, peak: 0.26, env: [[0, 0.02], [0.05, 1], [0.2, 0.01]], bp: { f0: 1900 * f(), f1: 480 * f(), q: 1.5, fdur: 0.18 } },
      { tag: 'scuff', k: 'noise', dur: 0.03, peak: 0.12, att: 0.001, hp: { f0: 2600 } },
      { tag: 'land', k: 'osc', type: 'sine', f0: 118, f1: 56, fdur: 0.07, dur: 0.1, peak: 0.16, att: 0.002, delay: 0.16 },
    ]);
  },

  feint(rnd) {
    const f = jit(rnd, 0.1);
    return finish([{ tag: 'half', k: 'noise', pink: true, dur: 0.13, peak: 0.12, env: [[0, 0.02], [0.07, 1], [0.13, 0.02]], bp: { f0: 300 * f, f1: 1300 * f, q: 1.2, fdur: 0.08 } }]);
  },

  blink(rnd) {
    const v = [];
    for (let i = 0; i < 3; i++) v.push({ tag: 'stutter', k: 'osc', type: 'square', f0: lerp(600, 2400, rnd()), f1: lerp(600, 2400, rnd()), fdur: 0.02, dur: 0.026, peak: 0.07, att: 0.001, delay: i * 0.038 });
    v.push({ tag: 'zap', k: 'osc', type: 'sawtooth', f0: 2000, f1: 90, fdur: 0.2, dur: 0.24, peak: 0.1, att: 0.003, delay: 0.1, lp: { f0: 5200 }, send: 0.15 });
    v.push({ tag: 'bits', k: 'noise', dur: 0.22, peak: 0.14, env: pulses(rnd, 10, 0.2, 0.01), bp: { f0: 4200, f1: 1200, q: 2, fdur: 0.2 }, delay: 0.08 });
    v.push({ tag: 'arrive', k: 'osc', type: 'square', f0: 140, f1: 900, fdur: 0.1, dur: 0.12, peak: 0.06, att: 0.002, delay: 0.3 });
    return finish(v);
  },

  lag(rnd) {
    void rnd;
    return finish([
      { tag: 'stall', k: 'osc', type: 'square', f0: 700, f1: 80, fdur: 0.4, dur: 0.45, peak: 0.06, att: 0.003, lp: { f0: 2400 } },
      { tag: 'drive', k: 'osc', type: 'sawtooth', f0: 170, f1: 38, fdur: 0.5, dur: 0.55, peak: 0.14, att: 0.01 },
    ]);
  },

  /** The boxing bell: inharmonic partials with long decays, each with a detuned twin that makes it shimmer, and the metal of the strike. */
  bell(times, rnd) {
    const n = clamp(Math.round(times || 1), 1, 6);
    const f0 = 880 * jit(rnd, 0.004);
    const parts = [[0.5, 0.3, 2.4, false], [1, 1, 2.6, true], [2, 0.5, 1.9, true], [2.76, 0.46, 1.5, true], [4.07, 0.26, 1.0, false], [5.4, 0.2, 0.75, false], [8.93, 0.09, 0.4, false]];
    const v = [];
    for (let i = 0; i < n; i++) {
      const t0 = i * 0.3;
      const last = i === n - 1;
      parts.forEach(([r, a, d, twin]) => {
        const dur = d * (last ? 1 : 0.6);
        v.push({ tag: 'partial', k: 'osc', type: 'sine', f0: f0 * r, f1: f0 * r, dur, peak: 0.2 * a, att: 0.0015, delay: t0, send: 0.28 });
        if (twin) v.push({ tag: 'twin', k: 'osc', type: 'sine', f0: f0 * r * 1.0042, f1: f0 * r * 1.0042, dur: dur * 0.8, peak: 0.14 * a, att: 0.0015, delay: t0, send: 0.28 });
      });
      v.push({ tag: 'strike', k: 'noise', dur: 0.014, peak: 0.34, att: 0.0003, hp: { f0: 3000 }, delay: t0 });
      v.push({ tag: 'clank', k: 'noise', dur: 0.05, peak: 0.16, att: 0.0005, bp: { f0: 4100, q: 3 }, delay: t0 });
    }
    return finish(v);
  },

  /** A fighter is knocked out: the blow (a hit of the biggest kind, so the snap and the body are there), the boom, the body on the canvas, the ears ringing. */
  ko(who, rnd) {
    const f = () => jit(rnd, 0.05);
    const v = RECIPES.thud({ dmg: 40, heavy: true, counter: true, combo: 1, target: who }, rnd).voices.map((x) => ({ ...x, peak: x.peak * 0.8 }));
    v.push(
      { tag: 'boom', k: 'osc', type: 'sine', f0: 125 * f(), f1: 27, fdur: 0.9, dur: 1.0, peak: 0.42, att: 0.003, delay: 0.01, send: 0.35 },
      { tag: 'wump', k: 'noise', dur: 0.6, peak: 0.45, att: 0.004, lp: { f0: 800, f1: 110, fdur: 0.6 }, delay: 0.02, send: 0.25 },
      { tag: 'canvas', k: 'osc', type: 'sine', f0: 90, f1: 36, fdur: 0.26, dur: 0.32, peak: 0.34, att: 0.003, delay: 0.38, send: 0.3 },
      { tag: 'mat', k: 'noise', dur: 0.16, peak: 0.7, att: 0.002, bp: { f0: 620, q: 0.8 }, lp: { f0: 2200 }, delay: 0.38, send: 0.25 },
      { tag: 'floor', k: 'noise', dur: 0.24, peak: 0.45, att: 0.003, lp: { f0: 340 }, delay: 0.38 },
      { tag: 'dust', k: 'noise', dur: 0.08, peak: 0.3, att: 0.001, hp: { f0: 2200 }, delay: 0.38 },
      { tag: 'ring', k: 'osc', type: 'sine', f0: 3100, f1: 3100, dur: 0.9, peak: 0.01, att: 0.05, delay: 0.1 },
    );
    return finish(v, { duck: { amt: 0.95, rel: 1.6 }, lp: { f: 520, hold: 0.45, rel: 0.7 }, who });
  },

  knockdown(who, rnd) {
    const f = () => jit(rnd, 0.05);
    const v = RECIPES.thud({ dmg: 30, heavy: true, combo: 1, target: who }, rnd).voices.map((x) => ({ ...x, peak: x.peak * 0.75 }));
    v.push(
      { tag: 'boom', k: 'osc', type: 'sine', f0: 112 * f(), f1: 30, fdur: 0.6, dur: 0.75, peak: 0.32, att: 0.003, delay: 0.01, send: 0.3 },
      { tag: 'canvas', k: 'osc', type: 'sine', f0: 82, f1: 36, fdur: 0.24, dur: 0.3, peak: 0.28, att: 0.003, delay: 0.3, send: 0.25 },
      { tag: 'mat', k: 'noise', dur: 0.14, peak: 0.6, att: 0.002, bp: { f0: 640, q: 0.8 }, lp: { f0: 2200 }, delay: 0.3, send: 0.2 },
      { tag: 'floor', k: 'noise', dur: 0.2, peak: 0.36, att: 0.003, lp: { f0: 320 }, delay: 0.3 },
    );
    return finish(v, { duck: { amt: 0.8, rel: 1.2 }, who });
  },

  /** The referee's count: a wood "tock" that rises a little with each number. */
  count(n, rnd) {
    const k = clamp(Math.round(n || 1), 1, 5);
    const f = 150 * 1.1 ** (k - 1) * jit(rnd, 0.02);
    return finish([
      { tag: 'tock', k: 'osc', type: 'sine', f0: f, f1: f * 0.62, fdur: 0.07, dur: 0.13, peak: 0.5, att: 0.001, send: 0.25 },
      { tag: 'wood', k: 'osc', type: 'triangle', f0: f * 4.1, f1: f * 2.6, fdur: 0.025, dur: 0.045, peak: 0.26, att: 0.0008 },
      { tag: 'click', k: 'noise', dur: 0.008, peak: 0.16 + 0.03 * k, att: 0.0003, hp: { f0: 3000 } },
    ]);
  },

  getup(who, rnd) {
    const f = () => jit(rnd, 0.1);
    return finish([
      { tag: 'scrape', k: 'noise', pink: true, dur: 0.34, peak: 0.2, env: [[0, 0.02], [0.08, 0.6], [0.16, 0.2], [0.26, 0.9], [0.34, 0.02]], bp: { f0: 420 * f(), f1: 1100 * f(), q: 0.9, fdur: 0.3 } },
      { tag: 'shoe', k: 'noise', dur: 0.05, peak: 0.12, att: 0.001, hp: { f0: 1800 }, delay: 0.06 },
      { tag: 'step', k: 'osc', type: 'sine', f0: 110, f1: 55, fdur: 0.07, dur: 0.1, peak: 0.2, att: 0.002, delay: 0.3 },
      { tag: 'brace', k: 'noise', pink: true, dur: 0.5, peak: 0.12, env: [[0, 0.02], [0.3, 1], [0.5, 0.02]], bp: { f0: 600, f1: 900, q: 0.7, fdur: 0.5 }, delay: 0.1 },
    ]);
  },

  /** The crowd: an inhale and an "ooh" (two formants that glide up). */
  gasp(level, rnd) {
    const L = clamp(level ?? 0.6, 0.1, 1.5);
    const f = () => jit(rnd, 0.08);
    return finish([
      { tag: 'inhale', bus: 'crowd', k: 'noise', pink: true, dur: 0.3, peak: 0.13 * (0.5 + 0.5 * L), env: [[0, 0.02], [0.2, 1], [0.3, 0.02]], hp: { f0: 1200 }, bp: { f0: 1800, f1: 3200, q: 0.8, fdur: 0.25 } },
      { tag: 'ooh-1', bus: 'crowd', k: 'noise', pink: true, dur: 0.55, peak: 0.2 * (0.5 + 0.5 * L), env: [[0, 0.02], [0.14, 1], [0.3, 0.8], [0.55, 0.02]], bp: { f0: 460 * f(), f1: 640 * f(), q: 4, fdur: 0.4 }, delay: 0.08, send: 0.25 },
      { tag: 'ooh-2', bus: 'crowd', k: 'noise', pink: true, dur: 0.55, peak: 0.12 * (0.5 + 0.5 * L), env: [[0, 0.02], [0.14, 1], [0.3, 0.8], [0.55, 0.02]], bp: { f0: 980 * f(), f1: 1250 * f(), q: 5, fdur: 0.4 }, delay: 0.08, send: 0.25 },
    ]);
  },

  /** The crowd cheers: voices, and an applause made of one noise voice with a train of claps as its envelope. */
  cheer(level, rnd) {
    const L = clamp(level ?? 0.6, 0.1, 1.5);
    const v = [];
    const n = 5 + Math.round(3 * L);
    for (let i = 0; i < n; i++) {
      const t0 = rnd() * 0.25; const d = lerp(0.7, 1.5, rnd()) * (0.7 + 0.3 * L); const fc = lerp(650, 1900, rnd());
      v.push({ tag: 'voice', bus: 'crowd', k: 'noise', pink: true, delay: t0, dur: d, peak: 0.12 * (0.5 + 0.5 * L) * lerp(0.7, 1, rnd()), env: [[0, 0.02], [d * 0.22, 1], [d * 0.55, 0.7], [d, 0.02]], bp: { f0: fc, f1: fc * lerp(0.9, 1.25, rnd()), q: lerp(1.2, 3, rnd()), fdur: d }, send: 0.25 });
    }
    const span = 1.1 + 0.5 * L;
    v.push({ tag: 'applause', bus: 'crowd', k: 'noise', dur: span + 0.1, peak: 0.3 * (0.5 + 0.5 * L), env: pulses(rnd, Math.round(26 + 30 * L), span), bp: { f0: 2400, q: 0.7 }, delay: 0.12, send: 0.2 });
    return finish(v);
  },

  level(rnd) {
    const v = [];
    const root = 523.25 * jit(rnd, 0.005); // C5
    [0, 4, 7, 12, 16].forEach((s, i) => {
      const f = root * 2 ** (s / 12);
      v.push({ tag: 'note', k: 'osc', type: 'triangle', f0: f, f1: f, dur: i === 4 ? 0.9 : 0.32, peak: 0.12, att: 0.003, delay: i * 0.085, send: 0.3 });
      v.push({ tag: 'twin', k: 'osc', type: 'sine', f0: f * 1.004, f1: f * 1.004, dur: i === 4 ? 0.9 : 0.3, peak: 0.07, att: 0.003, delay: i * 0.085 });
    });
    [0, 4, 7].forEach((s) => v.push({ tag: 'chord', k: 'osc', type: 'triangle', f0: root * 2 ** ((s + 12) / 12), f1: root * 2 ** ((s + 12) / 12), dur: 1.0, peak: 0.07, att: 0.01, delay: 0.42, send: 0.35 }));
    v.push({ tag: 'sparkle', k: 'noise', dur: 0.7, peak: 0.07, env: pulses(rnd, 14, 0.6), hp: { f0: 6000 }, delay: 0.38 });
    return finish(v);
  },

  tick() { return finish([{ tag: 'tick', k: 'osc', type: 'sine', f0: 1100, f1: 1100, dur: 0.05, peak: 0.06, att: 0.002 }]); },

  bagHit(power, rnd) {
    const p = clamp(power ?? 0.6, 0.1, 1);
    const f = () => jit(rnd, 0.08);
    return finish([
      { tag: 'smack', k: 'noise', dur: 0.075, peak: 0.12 + 0.22 * p, att: 0.001, bp: { f0: 900 * f(), f1: 320, q: 1.1, fdur: 0.07 } },
      { tag: 'body', k: 'osc', type: 'triangle', f0: (235 - 40 * p) * f(), f1: 95, fdur: 0.07, dur: 0.11, peak: 0.12 + 0.14 * p, att: 0.001 },
      { tag: 'slap', k: 'noise', dur: 0.035, peak: 0.1 + 0.14 * p, att: 0.0005, hp: { f0: 2600 * f() } },
      { tag: 'rattle-1', k: 'noise', dur: 0.06, peak: 0.06 + 0.05 * p, att: 0.001, hp: { f0: 2200 }, delay: 0.055 },
      { tag: 'rattle-2', k: 'noise', dur: 0.05, peak: 0.04, att: 0.001, hp: { f0: 2000 }, delay: 0.125 },
    ]);
  },

  bagGlance(rnd) {
    return finish([{ tag: 'brush', k: 'noise', dur: 0.06, peak: 0.06, att: 0.002, bp: { f0: 800 * jit(rnd, 0.1), f1: 450, q: 1, fdur: 0.05 } }]);
  },

  click(accent) {
    return finish([{ tag: 'click', k: 'osc', type: 'sine', f0: accent ? 1480 : 1100, f1: accent ? 1480 : 1100, dur: accent ? 0.09 : 0.05, peak: accent ? 0.09 : 0.06, att: 0.002 }]);
  },
};

// ───────────────────────────── the engine ─────────────────────────────

/**
 * One AudioContext for the whole ring. `context` = give it a (Offline)AudioContext to render with; otherwise one is made on the first sound.
 * @param {{ isMuted?: () => boolean, volume?: () => number, context?: any, rnd?: () => number }} [o]
 */
export function createRingAudio({ isMuted = () => false, volume = () => 1, context = null, rnd = Math.random } = {}) {
  let ctx = null;
  let owned = false;
  let offline = false;
  let g = null; // the nodes of the master chain, once built
  let alive = 0; // voices playing (a leak check)
  let slowOn = false;

  const MASTER = 0.9;
  const MUSIC_BUS = 0.2; // the music bus when it is not ducked

  function noiseBuffer(c, pink) {
    const len = Math.floor(c.sampleRate * 2);
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    if (!pink) { for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1; return b; }
    let b0 = 0; let b1 = 0; let b2 = 0; let b3 = 0; let b4 = 0; let b5 = 0; let b6 = 0; // (Paul Kellet's pink filter)
    for (let i = 0; i < len; i++) {
      const w = rnd() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
    return b;
  }
  function impulse(c) {
    const rate = c.sampleRate; const len = Math.floor(rate * 1.0);
    const b = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      const pre = Math.floor(rate * 0.012);
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / rate;
        lp += ((rnd() * 2 - 1) - lp) * lerp(0.85, 0.12, clamp(t / 0.6, 0, 1)); // an arena: it gets darker as it dies
        d[i] = lp * Math.exp(-t / 0.22) * (1 - Math.min(1, t / 1.0));
      }
    }
    return b;
  }

  function build(c) {
    const mk = (type) => c[type]();
    const mix = mk('createGain');
    const slow = mk('createBiquadFilter'); slow.type = 'lowpass'; slow.frequency.value = 22000; slow.Q.value = 0.5;
    const comp = mk('createDynamicsCompressor');
    comp.threshold.value = -11; comp.knee.value = 8; comp.ratio.value = 10; comp.attack.value = 0.002; comp.release.value = 0.07;
    const clip = mk('createWaveShaper'); clip.curve = clipCurve();
    try { clip.oversample = '2x'; } catch { /* fine without */ }
    const master = mk('createGain'); master.gain.value = MASTER;
    mix.connect(slow); slow.connect(comp); comp.connect(clip); clip.connect(master); master.connect(c.destination);
    const bus = (v) => { const n = mk('createGain'); n.gain.value = v; n.connect(mix); return n; };
    const sfx = bus(4.0); const crowd = bus(1.3); const music = bus(MUSIC_BUS);
    const send = mk('createGain'); send.gain.value = 1;
    const conv = mk('createConvolver'); conv.buffer = impulse(c);
    const wet = mk('createGain'); wet.gain.value = 0.6;
    send.connect(conv); conv.connect(wet); wet.connect(mix);
    if (slowOn) slow.frequency.value = 850;
    g = { mix, slow, comp, clip, master, sfx, crowd, music, send, conv, wet, white: noiseBuffer(c, false), pink: noiseBuffer(c, true) };
  }

  /** The context (made on the first call), or null when muted / there is none. Cheap: called by every sound. */
  function ready() {
    if (isMuted()) { if (g) g.master.gain.value = 0; return null; }
    if (!ctx) {
      if (context) { ctx = context; offline = typeof context.startRendering === 'function'; } else {
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); owned = true; } catch { return null; }
      }
      try { build(ctx); } catch { ctx = null; g = null; return null; }
    }
    if (!offline && ctx.state === 'suspended') { try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch { /* a locked context stays quiet */ } }
    g.master.gain.value = MASTER * clamp(volume(), 0, 1);
    return ctx;
  }

  /** Plays one voice (see RECIPES) at the context time t0 into the bus `dest`. */
  function voice(v, t0, dest, gain = 1) {
    const c = ctx;
    if (!c || !g) return;
    const t = t0 + (v.delay || 0);
    const dur = Math.max(0.01, v.dur);
    const nodes = [];
    const add = (n) => { nodes.push(n); return n; };
    const env = add(c.createGain());
    const pk = Math.max(0.0002, v.peak * gain * (v.k === 'noise' ? noiseComp(v, c.sampleRate / 2) : 1));
    if (v.env) {
      env.gain.setValueAtTime(Math.max(0.0001, v.env[0][1] * pk), t + v.env[0][0]);
      for (let i = 1; i < v.env.length; i++) env.gain.exponentialRampToValueAtTime(Math.max(0.0001, v.env[i][1] * pk), t + v.env[i][0]);
    } else {
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(pk, t + (v.att ?? 0.002));
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    let src;
    if (v.k === 'noise') {
      src = add(c.createBufferSource());
      src.buffer = v.pink ? g.pink : g.white; src.loop = true;
    } else {
      src = add(c.createOscillator());
      src.type = v.type || 'sine';
      src.frequency.setValueAtTime(v.f0, t);
      if (v.f1 && v.f1 !== v.f0) src.frequency.exponentialRampToValueAtTime(Math.max(10, v.f1), t + (v.fdur || dur));
      if (v.det) src.detune.value = v.det;
    }
    let node = src;
    for (const key of ['bp', 'lp', 'hp']) {
      const f = v[key];
      if (!f) continue;
      const b = add(c.createBiquadFilter());
      b.type = key === 'bp' ? 'bandpass' : key === 'lp' ? 'lowpass' : 'highpass';
      b.Q.value = f.q ?? (key === 'bp' ? 1 : 0.7);
      b.frequency.setValueAtTime(f.f0, t);
      if (f.f1 && f.f1 !== f.f0) b.frequency.exponentialRampToValueAtTime(Math.max(30, f.f1), t + (f.fdur || dur));
      node.connect(b); node = b;
    }
    node.connect(env);
    let out = env;
    if (v.pan && c.createStereoPanner) { const p = add(c.createStereoPanner()); p.pan.value = clamp(v.pan, -1, 1); env.connect(p); out = p; }
    out.connect(dest);
    if (v.send) { const s = add(c.createGain()); s.gain.value = v.send; out.connect(s); s.connect(g.send); }
    if (v.k === 'noise') src.start(t, rnd() * Math.max(0, 1.7 - dur)); else src.start(t);
    src.stop(t + dur + 0.05);
    alive++;
    src.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch { /* already gone */ } } alive--; };
  }

  /** Plays a whole recipe now (a little ahead of the clock). */
  function play(r, gain = 1, delay = 0) {
    const c = ready();
    if (!c || !r) return;
    const t = c.currentTime + 0.004 + delay;
    for (const v of r.voices) voice(v, t, v.bus === 'crowd' ? g.crowd : g.sfx, gain);
    if (r.duck) duck(r.duck.amt, r.duck.rel);
    if (r.lp) lowpassDip(r.lp.f, r.lp.hold, r.lp.rel);
  }

  /** The music bus dips to (1 - amt) in an instant and comes back over `rel` seconds. */
  function duck(amt, rel = 0.3) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    const p = g.music.gain;
    p.cancelScheduledValues(t);
    p.setTargetAtTime(clamp(1 - amt, 0.02, 1) * MUSIC_BUS, t, 0.012);
    p.setTargetAtTime(MUSIC_BUS, t + 0.06, Math.max(0.05, rel / 3));
  }
  /** The ears ring: the whole mix goes dull for `hold` seconds and opens up again over `rel`. */
  function lowpassDip(f, hold = 0.4, rel = 0.6) {
    const c = ready();
    if (!c) return;
    const t = c.currentTime;
    const p = g.slow.frequency;
    p.cancelScheduledValues(t);
    p.setTargetAtTime(f, t, 0.015);
    p.setTargetAtTime(slowOn ? 850 : 22000, t + hold, Math.max(0.05, rel / 3));
  }
  /** Slow motion: dull the mix while it lasts (cheap: only acts when it changes). */
  function setSlow(on) {
    on = !!on;
    if (on === slowOn) return;
    slowOn = on;
    if (!ctx || !g) return;
    const t = ctx.currentTime;
    g.slow.frequency.cancelScheduledValues(t);
    g.slow.frequency.setTargetAtTime(on ? 850 : 22000, t, on ? 0.03 : 0.08);
  }

  return {
    ready, voice, play, duck, lowpassDip, setSlow, rnd, musicBase: MUSIC_BUS,
    get ctx() { return ctx; },
    get nodes() { return g; },
    get alive() { return alive; },
    get slow() { return slowOn; },
    get offline() { return offline; },
    /** For the lab: the loudness meter of the master (an analyser after the chain), made on the first ask. */
    analyser() { if (!ctx || !g) return null; if (!g.an) { g.an = ctx.createAnalyser(); g.an.fftSize = 2048; g.master.connect(g.an); } return g.an; },
    reduction() { return g && g.comp ? g.comp.reduction : 0; },
    dispose() {
      if (g) { for (const n of Object.values(g)) { try { if (n && n.disconnect) n.disconnect(); } catch { /* gone */ } } }
      g = null;
      if (ctx && owned) { try { const p = ctx.close(); if (p && p.catch) p.catch(() => {}); } catch { /* closed already */ } }
      ctx = null;
    },
  };
}

// ───────────────────────────── what fight3d.js calls ─────────────────────────────

export function createFightSfx(opts = {}) {
  const audio = createRingAudio(opts);
  const rnd = audio.rnd;
  const play = (r, name) => audio.play(r, dbGain(TRIM_DB[name] || 0));

  // the murmur of the crowd: a looping pink noise through two slowly breathing formant bands; its loudness follows the love
  let bed = null;
  const BED_MAX = 0.2 * dbGain(-13.4);
  function bedLevel(love01) {
    if (!bed || !audio.ctx) return;
    const c = audio.ctx;
    bed.out.gain.setTargetAtTime(BED_MAX * lerp(0.3, 1, clamp(love01, 0, 1)), c.currentTime, 0.5);
  }
  function crowdStart(love = 0) {
    const c = audio.ready();
    if (!c) return;
    const n = audio.nodes;
    if (!bed) {
      const nodes = [];
      const add = (x) => { nodes.push(x); return x; };
      const src = add(c.createBufferSource()); src.buffer = n.pink; src.loop = true;
      const lowB = add(c.createBiquadFilter()); lowB.type = 'bandpass'; lowB.frequency.value = 420; lowB.Q.value = 0.6;
      const midB = add(c.createBiquadFilter()); midB.type = 'bandpass'; midB.frequency.value = 1050; midB.Q.value = 0.8;
      const gLow = add(c.createGain()); gLow.gain.value = 0.75;
      const gMid = add(c.createGain()); gMid.gain.value = 0.5;
      const out = add(c.createGain()); out.gain.value = 0;
      const l1 = add(c.createOscillator()); l1.frequency.value = 0.23; const l1g = add(c.createGain()); l1g.gain.value = 0.35; l1.connect(l1g); l1g.connect(gLow.gain);
      const l2 = add(c.createOscillator()); l2.frequency.value = 0.37; const l2g = add(c.createGain()); l2g.gain.value = 0.3; l2.connect(l2g); l2g.connect(gMid.gain);
      src.connect(lowB); lowB.connect(gLow); gLow.connect(out);
      src.connect(midB); midB.connect(gMid); gMid.connect(out);
      out.connect(n.crowd);
      src.start(0, rnd() * 1.5); l1.start(); l2.start();
      bed = { src, out, l1, l2, nodes };
    }
    bedLevel(love / 100);
  }
  function crowdStop() {
    if (!bed || !audio.ctx) { bed = null; return; }
    const c = audio.ctx; const b = bed; bed = null;
    const t = c.currentTime;
    b.out.gain.cancelScheduledValues(t);
    b.out.gain.setTargetAtTime(0, t, 0.25);
    for (const s of [b.src, b.l1, b.l2]) { try { s.stop(t + 1.6); } catch { /* not started */ } }
    b.src.onended = () => { for (const x of b.nodes) { try { x.disconnect(); } catch { /* gone */ } } };
  }

  return {
    audio,
    thud: (hit) => audio.play(RECIPES.thud(hit, rnd), dbGain(thudDb(hit))),
    whoosh: (wind, weight, mine) => audio.play(RECIPES.whoosh(wind, weight, mine, rnd), dbGain(TRIM_DB.whoosh + (mine ? 4.5 : 0))),
    block: (dmg) => audio.play(RECIPES.block(dmg, rnd), dbGain(1.4 + 2.2 * clamp((dmg || 1.5) / 4, 0.15, 1))),
    parry: () => play(RECIPES.parry(rnd), 'parry'),
    perfect: () => play(RECIPES.perfect(rnd), 'perfect'),
    fury: () => play(RECIPES.fury(rnd), 'fury'),
    guardbreak: () => play(RECIPES.guardbreak(rnd), 'guardbreak'),
    dash: () => play(RECIPES.dash(rnd), 'dash'),
    feint: () => play(RECIPES.feint(rnd), 'feint'),
    blink: () => play(RECIPES.blink(rnd), 'blink'),
    lag: () => play(RECIPES.lag(rnd), 'lag'),
    bell: (times = 1) => play(RECIPES.bell(times, rnd), 'bell'),
    ko: (who) => play(RECIPES.ko(who, rnd), 'ko'),
    knockdown: (who) => play(RECIPES.knockdown(who, rnd), 'knockdown'),
    count: (n) => play(RECIPES.count(n, rnd), 'count'),
    getup: (who) => play(RECIPES.getup(who, rnd), 'getup'),
    gasp: (level) => play(RECIPES.gasp(level, rnd), 'gasp'),
    cheer: (level, delay = 0) => audio.play(RECIPES.cheer(level, rnd), dbGain(TRIM_DB.cheer), delay),
    level: () => play(RECIPES.level(rnd), 'level'),
    tick: () => play(RECIPES.tick(), 'tick'),
    bagHit: (power) => play(RECIPES.bagHit(power, rnd), 'bagHit'),
    bagGlance: () => play(RECIPES.bagGlance(rnd), 'bagGlance'),
    click: (accent) => play(RECIPES.click(!!accent), 'click'),
    crowdStart, crowdStop,
    crowd: (love) => bedLevel(love / 100),
    setSlow: (on) => audio.setSlow(on),
    duck: (amount, release) => audio.duck(amount, release),
    dispose() { crowdStop(); audio.dispose(); },
  };
}
