// Tiny WebAudio synth: room tone, UI clicks, key clacks, whoosh, boot chime.
let ctx = null;
let master = null;
let enabled = true;      // the user's own on/off choice (HUD button / Control Center)
let pageActive = true;  // false while the tab is hidden or the window is not focused
let ambient = null;
let volume = 0.7; // 0..1, System Settings / Control Center (0.7 = the original loudness)

const live = () => enabled && pageActive;
const level = () => (live() ? 1.286 * volume : 0);

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = level();
  master.connect(ctx.destination);
  if (!pageActive) ctx.suspend();
  return ctx;
}

export function unlock() {
  // a click/tap on the page is proof that we are active, even if the focus event hasn't arrived yet
  if (!document.hidden) pageActive = true;
  const c = ensure();
  if (c && pageActive) {
    if (c.state === 'suspended') c.resume();
    applyGain();
  }
}

export const isEnabled = () => enabled;
/** The audio clock (seconds); 0 until the context exists. Used by schedulers (chiptune). */
export const time = () => (ctx ? ctx.currentTime : 0);

function applyGain() {
  if (!ctx) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(level(), ctx.currentTime, 0.06);
}

/** Master volume 0..1 (the user's slider); 0.7 is the default loudness. */
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, +v || 0));
  applyGain();
}
export const getVolume = () => volume;

export function setEnabled(v) {
  enabled = v;
  applyGain();
}

// Sound only plays while you are actually on the site: silence it when the tab is hidden
// or the browser window loses focus, and bring it back (if you had it on) when you return.
function syncPageState() {
  const active = !document.hidden && document.hasFocus();
  if (active === pageActive) return;
  pageActive = active;
  if (!ctx) return;
  if (active) {
    ctx.resume();
    applyGain();
  } else {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
    ctx.suspend();
  }
}
pageActive = !document.hidden && document.hasFocus();
document.addEventListener('visibilitychange', syncPageState);
window.addEventListener('blur', syncPageState);
window.addEventListener('focus', syncPageState);
window.addEventListener('pagehide', () => { pageActive = false; if (ctx) ctx.suspend(); });
window.addEventListener('pageshow', syncPageState);

function noiseBuffer(c, seconds, brown = false) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

export function startAmbient() {
  const c = ensure();
  if (!c || ambient) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 4, true);
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  const g = c.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(0.09, c.currentTime + 4);
  src.connect(lp).connect(g).connect(master);
  src.start();
  ambient = { src, g };
}

function burst({ freq = 3000, q = 1, dur = 0.05, gain = 0.2, type = 'highpass', tone = 0 }) {
  const c = ensure();
  if (!c || !live()) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur + 0.02);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
  if (tone) {
    const o = c.createOscillator();
    const og = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(tone, t);
    o.frequency.exponentialRampToValueAtTime(tone * 0.6, t + dur);
    og.gain.setValueAtTime(gain * 0.5, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(og).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

export const click = () => burst({ freq: 2400, dur: 0.045, gain: 0.18, tone: 520 });
export const key = () => burst({ freq: 1800 + Math.random() * 900, dur: 0.035, gain: 0.14, tone: 300 + Math.random() * 80 });
export const pop = () => burst({ freq: 900, dur: 0.12, gain: 0.12, type: 'bandpass', q: 2, tone: 420 });

export function whoosh() {
  const c = ensure();
  if (!c || !live()) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 2.4);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 0.8;
  f.frequency.setValueAtTime(250, t);
  f.frequency.exponentialRampToValueAtTime(2200, t + 1.1);
  f.frequency.exponentialRampToValueAtTime(400, t + 2.2);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + 2.4);
}

export function chime() {
  const c = ensure();
  if (!c || !live()) return;
  const t = c.currentTime;
  const notes = [174.61, 261.63, 349.23, 523.25, 698.46];
  notes.forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    o.type = i % 2 ? 'triangle' : 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11 / (1 + i * 0.35), t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    o.connect(lp).connect(g).connect(master);
    o.start(t);
    o.stop(t + 2.5);
  });
}

// ── game SFX helpers (all honour the master gain / mute and stay silent while the page is inactive) ──
let whiteBuf = null;
const white = (c) => whiteBuf || (whiteBuf = noiseBuffer(c, 1));

/** One tone with a fast attack and exponential decay. `delay` (s) schedules it for chiptune sequences. */
export function blip(freq = 440, dur = 0.08, type = 'square', vol = 0.1, delay = 0) {
  const c = ensure();
  if (!c || !live()) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** A tone gliding from `f0` to `f1` (laser, power-up, death…). */
export function sweep(f0 = 800, f1 = 200, dur = 0.25, type = 'sawtooth', vol = 0.08, delay = 0) {
  const c = ensure();
  if (!c || !live()) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Filtered noise burst (explosions, thuds, line clears). */
export function noiseHit(dur = 0.15, vol = 0.16, freq = 900, type = 'lowpass', delay = 0) {
  const c = ensure();
  if (!c || !live()) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = white(c);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

/** Achievement unlocked: a bright little fanfare. */
export function trophy() {
  arp([784, 988, 1175, 1568], 0.075, 'triangle', 0.075);
  blip(2349, 0.5, 'sine', 0.05, 0.3);
  blip(3136, 0.4, 'sine', 0.03, 0.34);
}

/** The MacBook lid shutting: a soft low knock plus a muffled tap. */
export function thud() {
  sweep(130, 46, 0.2, 'sine', 0.26);
  noiseHit(0.1, 0.12, 360);
}

/** The lid latch letting go as it starts to open. */
export function latch() {
  blip(1800, 0.025, 'square', 0.035);
  noiseHit(0.035, 0.05, 2600, 'highpass');
}

/** A quick run of notes (jingles): `arp([523, 659, 784], 0.07)`. */
export function arp(freqs, step = 0.07, type = 'square', vol = 0.09) {
  freqs.forEach((f, i) => blip(f, step * 1.6, type, vol, i * step));
}

// ── room sounds that need the audio graph itself (T14) ──

/** A cat's purr: brown noise through a low-pass, amplitude-modulated at ~25 Hz, with a swell in and out. */
export function purr(sec = 2.4) {
  const c = ensure();
  if (!c || !live()) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, sec + 0.6, true);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 300;
  const am = c.createGain();
  am.gain.value = 0.55;
  const lfo = c.createOscillator();
  lfo.frequency.value = 24;
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 0.45;
  lfo.connect(lfoDepth).connect(am.gain);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(0.32, t + 0.4);
  env.gain.setValueAtTime(0.32, t + Math.max(0.5, sec - 0.7));
  env.gain.exponentialRampToValueAtTime(0.0001, t + sec);
  src.connect(lp).connect(am).connect(env).connect(master);
  src.start(t);
  lfo.start(t);
  src.stop(t + sec + 0.1);
  lfo.stop(t + sec + 0.1);
}

// HomePod ambient pad: a slow generative chord loop (sine + detuned triangle voices, low-passed, with a soft echo).
// T19 replaces this with the full music engine; the analyser feeds the 3D HomePod ring (padLevel()).
let pad = null;
const PAD_CHORDS = [[48, 55, 59, 64, 67], [45, 52, 57, 60, 64], [41, 48, 52, 57, 60], [43, 50, 55, 59, 62]]; // C△9 · Am7 · F△7 · G6
const SPARKLE = [72, 74, 76, 79, 81, 84];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export const padOn = () => !!pad;

export function padStart() {
  const c = ensure();
  if (!c || pad) return !!pad;
  const t0 = c.currentTime;
  const bus = c.createGain();
  bus.gain.setValueAtTime(0.0001, t0);
  bus.gain.exponentialRampToValueAtTime(0.5, t0 + 2.2);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1150;
  lp.Q.value = 0.4;
  const an = c.createAnalyser();
  an.fftSize = 256;
  const echo = c.createDelay(1);
  echo.delayTime.value = 0.42;
  const fb = c.createGain();
  fb.gain.value = 0.36;
  const wet = c.createGain();
  wet.gain.value = 0.3;
  bus.connect(lp);
  lp.connect(an);
  an.connect(master);
  lp.connect(echo);
  echo.connect(fb).connect(echo);
  echo.connect(wet).connect(master);
  const state = { bus, an, buf: new Uint8Array(an.fftSize), level: 0, nextAt: t0 + 0.05, chord: 0, timer: 0 };
  const voice = (f, when, dur, vol, type) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = (Math.random() - 0.5) * 12;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + Math.min(1.6, dur * 0.35));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(bus);
    o.start(when);
    o.stop(when + dur + 0.05);
  };
  const schedule = () => {
    // keep ~1.2 s of the future scheduled so a busy main thread never leaves a gap
    while (state.nextAt < c.currentTime + 1.2) {
      const chord = PAD_CHORDS[state.chord % PAD_CHORDS.length];
      chord.forEach((n, i) => {
        voice(midi(n), state.nextAt + i * 0.05, 7.4, 0.07 / (1 + i * 0.12), 'sine');
        voice(midi(n + 12) * 1.002, state.nextAt + i * 0.05, 6.2, 0.022, 'triangle');
      });
      for (let k = 0; k < 2; k++) voice(midi(SPARKLE[Math.floor(Math.random() * SPARKLE.length)]), state.nextAt + 1.2 + Math.random() * 4, 2.6, 0.035, 'sine');
      state.chord++;
      state.nextAt += 6;
    }
  };
  schedule();
  state.timer = setInterval(schedule, 500);
  pad = state;
  return true;
}

export function padStop() {
  if (!pad || !ctx) { pad = null; return; }
  const p = pad;
  pad = null;
  clearInterval(p.timer);
  const t = ctx.currentTime;
  p.bus.gain.cancelScheduledValues(t);
  p.bus.gain.setValueAtTime(Math.max(0.0001, p.bus.gain.value), t);
  p.bus.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  setTimeout(() => { try { p.bus.disconnect(); } catch { /* already gone */ } }, 1800);
}

/** Smoothed 0..1 loudness of the pad (RMS of the analyser), 0 when it is off. */
export function padLevel() {
  if (!pad) return 0;
  pad.an.getByteTimeDomainData(pad.buf);
  let sum = 0;
  for (let i = 0; i < pad.buf.length; i++) { const v = (pad.buf[i] - 128) / 128; sum += v * v; }
  const rms = Math.sqrt(sum / pad.buf.length);
  pad.level += (Math.min(1, rms * 9) - pad.level) * 0.25;
  return pad.level;
}

/** For debugging in the console: window.__ori.audio() */
export const debugState = () => ({ ctx: ctx && ctx.state, gain: master && +master.gain.value.toFixed(2), pageActive, enabled, pad: !!pad, volume });
