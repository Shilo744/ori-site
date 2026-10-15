// Tiny WebAudio synth: room tone, UI clicks, key clacks, whoosh, boot chime.
let ctx = null;
let master = null;
let enabled = true;      // the user's own on/off choice (HUD button / Control Center)
let pageActive = true;  // false while the tab is hidden or the window is not focused
let ambient = null;

const live = () => enabled && pageActive;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = live() ? 0.9 : 0;
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

function applyGain() {
  if (!ctx) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(live() ? 0.9 : 0, ctx.currentTime, 0.06);
}

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

/** For debugging in the console: window.__ori.audio() */
export const debugState = () => ({ ctx: ctx && ctx.state, gain: master && +master.gain.value.toFixed(2), pageActive, enabled });
