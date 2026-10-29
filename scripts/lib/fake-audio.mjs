// A fake AudioContext for the Node tests of the sound (scripts/test-favors-sound.mjs): just enough of the WebAudio API for fight-sfx.js and fight-music.js. It keeps the
// books: every node that was made and not yet taken down (a "live" node), the automation calls on every parameter, the clock (`advance(seconds)` moves it and ends the
// sources whose stop time has passed, like the real thing). Nothing is rendered: the real sound is measured by scripts/sound-render.mjs in the browser.

class Param {
  constructor(ctx, value = 0) { this.ctx = ctx; this._v = value; this.calls = []; }
  get value() { return this._v; }
  set value(v) { this._v = v; this.calls.push(['value', v, this.ctx.currentTime]); }
  setValueAtTime(v, t) { this.calls.push(['set', v, t]); if (t <= this.ctx.currentTime + 1e-9) this._v = v; return this; }
  linearRampToValueAtTime(v, t) { this.calls.push(['lin', v, t]); return this; }
  exponentialRampToValueAtTime(v, t) { if (!(v > 0)) throw new Error(`exponentialRamp to ${v}`); this.calls.push(['exp', v, t]); return this; }
  setTargetAtTime(v, t, k) { this.calls.push(['target', v, t, k]); this._v = v; return this; }
  cancelScheduledValues(t) { this.calls.push(['cancel', t]); return this; }
}

class Node {
  constructor(ctx, kind) { this.ctx = ctx; this.kind = kind; this.out = []; this.dead = false; ctx.nodes.push(this); }
  connect(to) { if (!to || (!to.kind && !to.cancelScheduledValues)) throw new Error('connect: not a node'); this.out.push(to); return to; }
  disconnect() { this.out = []; this.dead = true; }
}
class Gain extends Node { constructor(c) { super(c, 'gain'); this.gain = new Param(c, 1); } }
class Filter extends Node { constructor(c) { super(c, 'biquad'); this.type = 'lowpass'; this.frequency = new Param(c, 350); this.Q = new Param(c, 1); this.gain = new Param(c, 0); } }
class Comp extends Node { constructor(c) { super(c, 'compressor'); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) this[k] = new Param(c, 0); this.reduction = 0; } }
class Shaper extends Node { constructor(c) { super(c, 'shaper'); this.curve = null; this.oversample = 'none'; } }
class Conv extends Node { constructor(c) { super(c, 'convolver'); this.buffer = null; this.normalize = true; } }
class Delay extends Node { constructor(c) { super(c, 'delay'); this.delayTime = new Param(c, 0); } }
class Panner extends Node { constructor(c) { super(c, 'panner'); this.pan = new Param(c, 0); } }
class Analyser extends Node { constructor(c) { super(c, 'analyser'); this.fftSize = 2048; } }
class Source extends Node {
  constructor(c, kind) { super(c, kind); this.startAt = null; this.stopAt = null; this.onended = null; this.type = 'sine'; this.frequency = new Param(c, 440); this.detune = new Param(c, 0); this.buffer = null; this.loop = false; this.ended = false; }
  start(t = 0) { if (this.startAt != null) throw new Error('start twice'); this.startAt = t; this.ctx.sources.push(this); }
  stop(t = 0) { if (this.startAt == null) throw new Error('stop before start'); this.stopAt = t; }
}

export function createFakeContext({ state = 'running', sampleRate = 44100 } = {}) {
  const ctx = {
    state, sampleRate, currentTime: 0, nodes: [], sources: [], resumed: 0, closed: false,
    destination: { kind: 'destination', connect() {}, disconnect() {}, out: [] },
    createGain: () => new Gain(ctx),
    createOscillator: () => new Source(ctx, 'osc'),
    createBufferSource: () => new Source(ctx, 'bufsrc'),
    createBiquadFilter: () => new Filter(ctx),
    createDynamicsCompressor: () => new Comp(ctx),
    createWaveShaper: () => new Shaper(ctx),
    createConvolver: () => new Conv(ctx),
    createDelay: () => new Delay(ctx),
    createStereoPanner: () => new Panner(ctx),
    createAnalyser: () => new Analyser(ctx),
    createBuffer: (ch, len, rate) => { const data = Array.from({ length: ch }, () => new Float32Array(len)); return { numberOfChannels: ch, length: len, sampleRate: rate, duration: len / rate, getChannelData: (i) => data[i] }; },
    resume() { ctx.resumed++; return Promise.resolve(); },
    close() { ctx.closed = true; return Promise.resolve(); },
    /** Moves the clock; sources whose stop time has passed end (their onended runs, which takes their nodes down). */
    advance(sec) {
      ctx.currentTime += sec;
      for (const s of ctx.sources) if (!s.ended && s.stopAt != null && s.stopAt <= ctx.currentTime) { s.ended = true; if (s.onended) s.onended(); }
      ctx.sources = ctx.sources.filter((s) => !s.ended);
    },
    get live() { return ctx.nodes.filter((n) => !n.dead).length; },
    liveOf(kind) { return ctx.nodes.filter((n) => !n.dead && n.kind === kind).length; },
  };
  return ctx;
}

/** A timer the test drives by hand: set(fn, ms) / clear(id) / tick() runs the function once. */
export function createFakeTimer() {
  const t = { fn: null, ms: 0, id: 0, cleared: 0, sets: 0, set(fn, ms) { t.fn = fn; t.ms = ms; t.sets++; t.id++; return t.id; }, clear() { t.fn = null; t.cleared++; }, tick() { if (t.fn) t.fn(); }, get active() { return !!t.fn; } };
  return t;
}
