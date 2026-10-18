// "Ori, Can You...?" — the little sounds of the phone and the day, synthesised (no files). One AudioContext, made on the first sound (the
// game is opened by a click or a key, so the browser lets it play). The room's mute switch is honoured through `isMuted`.
export function createSfx({ isMuted = () => false, volume = () => 1 } = {}) {
  let ctx = null;
  let master = null;
  const ready = () => {
    if (isMuted()) return null;
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    master.gain.value = 0.5 * Math.max(0, Math.min(1, volume()));
    return ctx;
  };
  /** One enveloped oscillator: type, start freq, end freq, seconds, peak gain, delay. */
  const tone = (type, f0, f1, dur, peak, delay = 0, am = 0) => {
    const c = ready();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (am) { // a fast tremolo: the buzz of a phone on a table
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = am;
      lg.gain.value = peak * 0.7;
      lfo.connect(lg);
      lg.connect(g.gain);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  /** A soft bell: a sine with a quiet octave-and-a-bit partial, a quick attack and a long gentle tail. */
  const bell = (f, dur, peak, delay = 0) => { tone('sine', f, f, dur, peak, delay); tone('sine', f * 2.76, f * 2.76, dur * 0.4, peak * 0.2, delay); };

  // ── the music: a light, cheerful loop (C – Am – F – G, marimba-like plucks over a round bass), scheduled a bar ahead ──
  const BPM = 104;
  const BEAT = 60 / BPM;
  const CHORDS = [[48, [60, 64, 67, 71]], [45, [57, 60, 64, 69]], [41, [57, 60, 65, 69]], [43, [55, 59, 62, 67]]];
  const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
  let musicOn = false;
  let musicTimer = 0;
  let nextBar = 0;
  let barIdx = 0;
  let mgain = null;
  const pluck = (c, f, t, dur, peak) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(mgain);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  function scheduleBar(c, t) {
    const [root, tones] = CHORDS[barIdx % 4];
    pluck(c, mtof(root), t, BEAT * 1.6, 0.16);
    pluck(c, mtof(root), t + BEAT * 2.5, BEAT * 1.2, 0.12);
    for (let i = 0; i < 8; i++) {
      const m = tones[(i * 3 + barIdx) % 4] + (i % 4 === 3 ? 12 : 0);
      pluck(c, mtof(m), t + i * BEAT * 0.5, BEAT * 0.9, i % 2 ? 0.05 : 0.08);
    }
    // a tiny shaker on the off-beats
    for (let i = 0; i < 4; i++) {
      const n = c.createBufferSource();
      const len = Math.floor(c.sampleRate * 0.03);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len);
      n.buffer = buf;
      const g = c.createGain();
      g.gain.value = 0.03;
      n.connect(g);
      g.connect(mgain);
      n.start(t + (i + 0.5) * BEAT);
    }
    barIdx++;
  }
  function musicTick() {
    const c = ready();
    if (!c || !musicOn) return;
    while (nextBar < c.currentTime + 0.6) {
      if (nextBar < c.currentTime) nextBar = c.currentTime + 0.05;
      scheduleBar(c, nextBar);
      nextBar += BEAT * 4;
    }
  }

  // ── the engine: a soft electric hum that rises with the speed (a low saw through a low-pass + a whine), only while driving ──
  let eng = null;
  function engine(k, pedal = 0) {
    if (k < 0) { if (eng) { eng.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1); const e = eng; eng = null; setTimeout(() => { try { e.o1.stop(); e.o2.stop(); } catch { /* done */ } }, 400); } return; }
    const c = ready();
    if (!c) return;
    if (!eng) {
      const g = c.createGain(); g.gain.value = 0;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      const o1 = c.createOscillator(); o1.type = 'sawtooth';
      const o2 = c.createOscillator(); o2.type = 'sine';
      const g2 = c.createGain(); g2.gain.value = 0.35;
      o1.connect(lp); lp.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
      o1.start(); o2.start();
      eng = { g, lp, o1, o2 };
    }
    const t = c.currentTime;
    eng.o1.frequency.setTargetAtTime(48 + k * 70, t, 0.08);
    eng.o2.frequency.setTargetAtTime(180 + k * 520, t, 0.08);
    eng.lp.frequency.setTargetAtTime(380 + k * 900 + Math.max(0, pedal) * 250, t, 0.1);
    eng.g.gain.setTargetAtTime(0.025 + k * 0.05 + Math.max(0, pedal) * 0.01, t, 0.1);
  }

  return {
    engine,
    /** Starts / stops the loop (kept quiet under the sound effects). */
    music(on) {
      if (on === musicOn) return;
      musicOn = on;
      clearInterval(musicTimer);
      if (!on) { if (mgain) mgain.gain.setTargetAtTime(0, ctx.currentTime, 0.15); return; }
      const c = ready();
      if (!c) { musicOn = false; return; }
      if (!mgain) { mgain = c.createGain(); mgain.connect(master); }
      mgain.gain.cancelScheduledValues(c.currentTime);
      mgain.gain.setTargetAtTime(0.55, c.currentTime, 0.4);
      nextBar = c.currentTime + 0.1;
      musicTimer = setInterval(musicTick, 150);
      musicTick();
    },
    /** A new task: a soft two-note bell (and a short vibration on phones). */
    buzz() { bell(784, 0.34, 0.12); bell(1175, 0.5, 0.1, 0.11); try { if (!isMuted() && navigator.vibrate) navigator.vibrate([60, 40, 60]); } catch { /* no vibration */ } },
    /** An urgent one: the same bell, then a brighter third note. */
    urgent() { bell(784, 0.3, 0.12); bell(1175, 0.3, 0.1, 0.1); bell(1568, 0.5, 0.1, 0.2); },
    ding() { tone('sine', 880, 880, 0.16, 0.14); tone('sine', 1320, 1320, 0.28, 0.12, 0.09); tone('sine', 1760, 1760, 0.3, 0.06, 0.18); },
    /** A gentle "next time": two soft notes, the second one a little higher (never a sad sound). */
    soft() { tone('sine', 523, 523, 0.22, 0.08); tone('sine', 659, 659, 0.3, 0.07, 0.14); },
    tap() { tone('sine', 1200, 900, 0.05, 0.07); },
    /** One letter of a character's voice (voices.js): a short blip of their timbre at the given pitch. */
    blip(voice, hz) { if (hz > 0) tone(voice.wave, hz, hz * (1 + (voice.wobble - 0.3) * 0.2), 0.07, 0.035 + 0.02 * voice.bright); },
    pop() { tone('sine', 520, 980, 0.09, 0.09); },
    sip() { tone('triangle', 300, 520, 0.12, 0.08); tone('triangle', 520, 780, 0.16, 0.08, 0.1); },
    dispose() { engine(-1); musicOn = false; clearInterval(musicTimer); if (ctx) { ctx.close().catch(() => {}); ctx = null; } },
  };
}
