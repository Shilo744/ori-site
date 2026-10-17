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
  return {
    /** A new task: the phone buzzes twice. */
    buzz() { tone('square', 92, 88, 0.16, 0.16, 0, 38); tone('square', 92, 88, 0.16, 0.16, 0.21, 38); tone('sine', 880, 880, 0.07, 0.05, 0.02); try { if (!isMuted() && navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch { /* no vibration */ } },
    /** An urgent one: a third buzz and a rising ping. */
    urgent() { tone('square', 96, 90, 0.14, 0.18, 0.42, 38); tone('triangle', 660, 990, 0.18, 0.07, 0.5); },
    ding() { tone('sine', 880, 880, 0.16, 0.14); tone('sine', 1320, 1320, 0.28, 0.12, 0.09); tone('sine', 1760, 1760, 0.3, 0.06, 0.18); },
    /** A gentle "next time": two soft notes, the second one a little higher (never a sad sound). */
    soft() { tone('sine', 523, 523, 0.22, 0.08); tone('sine', 659, 659, 0.3, 0.07, 0.14); },
    tap() { tone('sine', 1200, 900, 0.05, 0.07); },
    pop() { tone('sine', 520, 980, 0.09, 0.09); },
    sip() { tone('triangle', 300, 520, 0.12, 0.08); tone('triangle', 520, 780, 0.16, 0.08, 0.1); },
    dispose() { if (ctx) { ctx.close().catch(() => {}); ctx = null; } },
  };
}
