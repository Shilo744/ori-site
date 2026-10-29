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

  // ── the street band (T33) [experimental]: a strummed guitar, an upright bass, an accordion-ish voice and a few claps playing a little tune in D, only while the event is on. `band(level)`: 0 = silent,
  // 1 = he stands right next to them. The street music ducks while the band is heard (two keys at once would be a mess). ──
  const BBEAT = 60 / 112;
  const BAND_CHORDS = [[38, [62, 66, 69]], [43, [62, 67, 71]], [45, [61, 64, 69]], [38, [62, 66, 69]]]; // D, G, A, D
  const BAND_TUNE = [[74, 76, 78, 76, 74, 76, 78, 81], [79, 81, 79, 78, 76, 74, 76, 78], [81, 78, 81, 83, 81, 78, 76, 78], [76, 74, 73, 74, 74, 0, 74, 0]];
  let bandOn = false;
  let bandTimer = 0;
  let bNext = 0;
  let bIdx = 0;
  let bgain = null;
  const bpluck = (c, f, t, dur, peak, type) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bgain); o.start(t); o.stop(t + dur + 0.05);
  };
  const bsqueeze = (c, f, t, dur, peak) => { // the accordion: a saw through a low-pass, a breath of attack and release
    const o = c.createOscillator(); const g = c.createGain(); const lp = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 1700; lp.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.03); g.gain.setValueAtTime(peak, t + dur * 0.6); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(bgain); o.start(t); o.stop(t + dur + 0.05);
  };
  const bclap = (c, t) => {
    const n = c.createBufferSource(); const len = Math.floor(c.sampleRate * 0.05); const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
    for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len) ** 2;
    n.buffer = buf; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.9; const g = c.createGain(); g.gain.value = 0.16;
    n.connect(bp); bp.connect(g); g.connect(bgain); n.start(t);
  };
  function bandBar(c, t) {
    const [root, tones] = BAND_CHORDS[bIdx % 4];
    for (let b = 0; b < 4; b++) bpluck(c, mtof(b % 2 ? root + 7 : root), t + b * BBEAT, BBEAT * 0.9, 0.2, 'sine');
    for (const b of [0.5, 1.5, 2.5, 3.5]) tones.forEach((m, i) => bpluck(c, mtof(m), t + b * BBEAT + i * 0.022, BBEAT * 0.6, 0.07, 'triangle'));
    BAND_TUNE[bIdx % 4].forEach((m, i) => { if (m) bsqueeze(c, mtof(m), t + i * BBEAT * 0.5, BBEAT * 0.46, 0.05); });
    for (const b of [1, 3]) bclap(c, t + b * BBEAT);
    bIdx++;
  }
  function bandTick() {
    const c = ready();
    if (!c || !bandOn) return;
    while (bNext < c.currentTime + 0.6) {
      if (bNext < c.currentTime) bNext = c.currentTime + 0.05;
      bandBar(c, bNext);
      bNext += BBEAT * 4;
    }
  }

  // ── the engine: a proper sporty voice. A stack of detuned saws and a sub through a soft clipper and a resonant low-pass (the growl), an intake hiss, a turbo whistle and a rush of
  // air while boosting, a gearbox whine in reverse and tyre noise when the car slides. Five "gears" make the revs climb and drop as the speed grows, like a real car. ──
  let eng = null;
  let noiseBuf = null;
  const getNoise = (c) => { if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; };
  const clipCurve = (() => { const n = 256; const c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * 2.6); } return c; })();
  function engine(k, pedal = 0, o = {}) {
    if (k < 0) {
      if (eng) { const e = eng; eng = null; e.out.gain.setTargetAtTime(0, ctx.currentTime, 0.12); setTimeout(() => { try { e.srcs.forEach((n) => n.stop()); } catch { /* done */ } }, 600); }
      return;
    }
    const c = ready();
    if (!c) return;
    if (!eng) {
      getNoise(c);
      const out = c.createGain(); out.gain.value = 0;
      const clip = c.createWaveShaper(); clip.curve = clipCurve; clip.oversample = '2x';
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 5; lp.frequency.value = 600;
      const core = c.createGain(); core.gain.value = 0.5;
      const saws = [['sawtooth', 1, 0.5], ['sawtooth', 1.006, 0.45], ['sawtooth', 0.994, 0.35], ['square', 0.5, 0.4], ['triangle', 2, 0.18]].map(([type, mult, g]) => {
        const osc = c.createOscillator(); osc.type = type; const og = c.createGain(); og.gain.value = g; osc.connect(og); og.connect(core); osc.start(); return { osc, mult };
      });
      core.connect(clip); clip.connect(lp); lp.connect(out);
      const noise = (freq, q, type = 'bandpass') => { const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(out); src.start(); return { src, f, g }; };
      const intake = noise(900, 1.2);
      const rush = noise(2600, 0.7);
      const screech = noise(1700, 7);
      const whine = c.createOscillator(); whine.type = 'sine'; const wg = c.createGain(); wg.gain.value = 0; whine.connect(wg); wg.connect(out); whine.start();
      const turbo = c.createOscillator(); turbo.type = 'sine'; const tg = c.createGain(); tg.gain.value = 0; turbo.connect(tg); tg.connect(out); turbo.start();
      out.connect(master);
      eng = { out, lp, saws, intake, rush, screech, whine, wg, turbo, tg, rpm: 0.2, srcs: [...saws.map((s2) => s2.osc), intake.src, rush.src, screech.src, whine, turbo] };
    }
    const t = c.currentTime;
    const boost = o.boost || 0;
    // gears: the revs rise through a gear and drop at the shift (a little pause of lift between)
    const gears = o.mine ? 5 : 4;
    const kk = Math.min(0.999, k);
    const g = Math.floor(kk * gears);
    const within = kk * gears - g;
    const want = Math.min(1, 0.24 + 0.62 * within + 0.06 * g / gears + 0.12 * Math.max(0, pedal) + 0.1 * boost);
    eng.rpm += (want - eng.rpm) * (want < eng.rpm ? 0.35 : 0.18); // a quick fall at a shift, a quicker climb under power
    const rpm = eng.rpm;
    const f0 = (o.mine ? 34 : 40) + rpm * (o.mine ? 118 : 96);
    for (const s2 of eng.saws) s2.osc.frequency.setTargetAtTime(f0 * s2.mult, t, 0.03);
    eng.lp.frequency.setTargetAtTime(260 + rpm * 1700 + Math.max(0, pedal) * 700 + boost * 500, t, 0.05);
    eng.out.gain.setTargetAtTime(0.13 + 0.08 * rpm + 0.05 * Math.max(0, pedal) + 0.05 * boost, t, 0.06);
    eng.intake.f.frequency.setTargetAtTime(700 + rpm * 1400, t, 0.06);
    eng.intake.g.gain.setTargetAtTime(0.05 + 0.2 * Math.max(0, pedal) * rpm, t, 0.08);
    eng.rush.g.gain.setTargetAtTime(boost * 0.35 + k * 0.05, t, 0.1);
    eng.turbo.frequency.setTargetAtTime(1500 + rpm * 2200, t, 0.06);
    eng.tg.gain.setTargetAtTime(boost * 0.05 + (o.mine ? Math.max(0, pedal) * rpm * 0.012 : 0), t, 0.08);
    eng.whine.frequency.setTargetAtTime(220 + k * 700, t, 0.06);
    eng.wg.gain.setTargetAtTime(o.reverse ? 0.035 + k * 0.03 : 0, t, 0.1);
    eng.screech.g.gain.setTargetAtTime(Math.max(0, (o.slide || 0) - 0.45) * 0.5, t, 0.05);
  }

  // ── the sound of a room Ori walks into (rebuilt: a soft bed per kind of room) ──
  let roomNodes = null;
  let roomKind = null;
  function roomStop() {
    if (!roomNodes) return;
    const r = roomNodes;
    roomNodes = null; roomKind = null;
    if (ctx) r.out.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    setTimeout(() => { try { r.srcs.forEach((n) => n.stop()); } catch { /* done */ } }, 1200);
  }
  function room(kind) {
    if (!kind) { roomStop(); return; }
    if (kind === roomKind) return;
    roomStop();
    const c = ready();
    if (!c) return;
    roomKind = kind;
    const out = c.createGain(); out.gain.value = 0; out.connect(master);
    const srcs = [];
    const noise = (type, freq, q, gain, lfoHz = 0) => {
      const src = c.createBufferSource(); src.buffer = getNoise(c); src.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = gain;
      src.connect(f); f.connect(g); g.connect(out); src.start(); srcs.push(src);
      if (lfoHz) { const l = c.createOscillator(); l.frequency.value = lfoHz; const lg = c.createGain(); lg.gain.value = gain * 0.7; l.connect(lg); lg.connect(g.gain); l.start(); srcs.push(l); }
    };
    const hum = (hz, gain) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = hz; const g = c.createGain(); g.gain.value = gain; o.connect(g); g.connect(out); o.start(); srcs.push(o); };
    if (kind === 'hall') { noise('lowpass', 380, 0.5, 0.09); noise('bandpass', 900, 0.8, 0.02, 0.17); } // a big quiet space
    else if (kind === 'office') { hum(100, 0.012); noise('lowpass', 500, 0.6, 0.05); noise('bandpass', 2600, 1.5, 0.008, 0.6); } // lights, air and far-off keys
    else if (kind === 'hum') { hum(50, 0.02); hum(100, 0.012); noise('lowpass', 300, 0.6, 0.05); } // a fridge in the corner
    else if (kind === 'chatter') { noise('bandpass', 520, 0.9, 0.1, 0.7); noise('bandpass', 1100, 1.2, 0.06, 1.3); noise('lowpass', 420, 0.5, 0.04); } // people murmuring
    else noise('lowpass', 420, 0.5, 0.045); // 'quiet': just the air
    out.gain.setTargetAtTime(0.5, c.currentTime, 0.6);
    roomNodes = { out, srcs };
  }

  return {
    engine,
    /** The sound of the room Ori is in ('quiet' | 'hall' | 'office' | 'hum' | 'chatter'); null = outdoors. */
    room,
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
    /** The street band (T33): 0 = stop, up to 1 = right next to them (how loud). It starts by itself and ducks the street music while it is heard. */
    band(level) {
      const L = Math.max(0, Math.min(1, +level || 0));
      if (L <= 0.005) {
        if (bandOn) { bandOn = false; clearInterval(bandTimer); if (ctx && bgain) bgain.gain.setTargetAtTime(0, ctx.currentTime, 0.2); if (ctx && mgain && musicOn) mgain.gain.setTargetAtTime(0.55, ctx.currentTime, 0.5); }
        return;
      }
      const c = ready();
      if (!c) return;
      if (!bgain) { bgain = c.createGain(); bgain.gain.value = 0; bgain.connect(master); }
      bgain.gain.setTargetAtTime(0.9 * L, c.currentTime, 0.25);
      if (mgain && musicOn) mgain.gain.setTargetAtTime(0.55 * (1 - 0.92 * L), c.currentTime, 0.3);
      if (!bandOn) { bandOn = true; bNext = c.currentTime + 0.1; bandTimer = setInterval(bandTick, 150); bandTick(); }
    },
    get bandPlaying() { return bandOn; },
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
    /** A friendly double toot of the horn (a hello from the car). */
    honk() { for (const d of [0, 0.17]) { tone('square', 392, 392, 0.12, 0.05, d); tone('square', 494, 494, 0.12, 0.045, d); } },
    sip() { tone('triangle', 300, 520, 0.12, 0.08); tone('triangle', 520, 780, 0.16, 0.08, 0.1); },
    purr() { for (let i = 0; i < 7; i++) tone('triangle', 150 - (i % 2) * 14, 118, 0.1, 0.05, i * 0.075); }, // (a cat: a low flutter)

    dispose() { roomStop(); engine(-1); musicOn = false; clearInterval(musicTimer); bandOn = false; clearInterval(bandTimer); if (ctx) { ctx.close().catch(() => {}); ctx = null; } },
  };
}
