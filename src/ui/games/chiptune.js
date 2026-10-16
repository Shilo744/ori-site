// A tiny chiptune sequencer for the games: square lead + triangle bass playing a looping Korobeiniki-style tune (a
// public-domain Russian folk melody). Notes are scheduled with a 100 ms look-ahead timer (not rAF), through the shared
// audio engine, so master mute / page visibility are honoured and nothing plays while the game is paused.
import * as sound from '../../audio.js';

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const NOTE = { A2: 45, E3: 52, D3: 50, A3: 57, B3: 59, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, A4: 69 };

// [note, beats] — two 16-beat lines (32 beats ≈ 12.8 s at 150 BPM). null = rest.
const LEAD = [
  ['E5', 1], ['B4', 0.5], ['C5', 0.5], ['D5', 1], ['C5', 0.5], ['B4', 0.5], ['A4', 1], ['A4', 0.5], ['C5', 0.5], ['E5', 1], ['D5', 0.5], ['C5', 0.5],
  ['B4', 1.5], ['C5', 0.5], ['D5', 1], ['E5', 1], ['C5', 1], ['A4', 1], ['A4', 1], [null, 1],
  ['D5', 1.5], ['F5', 0.5], ['A5', 1], ['G5', 0.5], ['F5', 0.5], ['E5', 1.5], ['C5', 0.5], ['E5', 1], ['D5', 0.5], ['C5', 0.5],
  ['B4', 1], ['B4', 0.5], ['C5', 0.5], ['D5', 1], ['E5', 1], ['C5', 1], ['A4', 1], ['A4', 1], [null, 1],
];
// one root/fifth pair per bar (4 beats = 4 alternating notes)
const BARS = [['A2', 'E3'], ['A2', 'E3'], ['A2', 'E3'], ['A2', 'E3'], ['D3', 'A3'], ['A2', 'E3'], ['E3', 'B3'], ['A2', 'E3']];
const LOOP_BEATS = 32;

function events() {
  const ev = [];
  let b = 0;
  LEAD.forEach(([n, d]) => { if (n) ev.push({ beat: b, dur: d, f: hz(NOTE[n]), type: 'square', vol: 0.055 }); b += d; });
  BARS.forEach(([root, fifth], bar) => {
    for (let i = 0; i < 4; i++) ev.push({ beat: bar * 4 + i, dur: 0.9, f: hz(NOTE[i % 2 ? fifth : root]), type: 'triangle', vol: 0.085 });
  });
  return ev.sort((x, y) => x.beat - y.beat);
}

export function createChiptune({ bpm = 150 } = {}) {
  const seq = events();
  const beat = 60 / bpm;
  let timer = 0;
  let idx = 0;
  let loopStart = 0;
  let running = false;

  function tick() {
    const now = sound.time();
    if (loopStart < now - 0.5) { loopStart = now + 0.05; idx = 0; } // fell behind (tab was hidden, audio not unlocked yet): resync
    for (let guard = 0; guard < 64; guard++) {
      const e = seq[idx];
      const at = loopStart + e.beat * beat;
      if (at > now + 0.4) break;
      sound.blip(e.f, e.dur * beat * 0.92, e.type, e.vol, Math.max(0, at - now));
      idx++;
      if (idx >= seq.length) { idx = 0; loopStart += LOOP_BEATS * beat; }
    }
  }

  return {
    get playing() { return running; },
    start() {
      if (running) return;
      running = true;
      loopStart = sound.time() + 0.08;
      idx = 0;
      tick();
      timer = setInterval(tick, 100);
    },
    stop() {
      running = false;
      clearInterval(timer);
      timer = 0;
    },
  };
}
