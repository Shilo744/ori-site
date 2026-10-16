// Little sound effects for the room's interactive objects (T14). Everything goes through audio.js, so the master
// mute, the "page inactive" silence and the audio clock are respected.
import * as audio from '../audio.js';

export const roomSounds = {
  /** Floor lamp switch: a crisp two-part tick (higher when it turns on). */
  lamp(on) {
    audio.blip(on ? 2300 : 1500, 0.03, 'square', 0.05);
    audio.blip(on ? 1250 : 780, 0.05, 'square', 0.04, 0.045);
    audio.noiseHit(0.04, 0.05, 2800, 'highpass', 0.002);
  },
  purr: () => audio.purr(2.6),
  /** Leaves: three soft bursts of filtered noise. */
  rustle() {
    [0, 0.09, 0.2, 0.34].forEach((d, i) => audio.noiseHit(0.16 - i * 0.02, 0.07 - i * 0.012, 3200 + i * 600, 'highpass', d));
    audio.noiseHit(0.5, 0.025, 1400, 'lowpass', 0.05);
  },
  /** Ceramic: a bright "ting" with a second partial. */
  clink() {
    audio.blip(2093, 0.4, 'sine', 0.07);
    audio.blip(3136, 0.28, 'sine', 0.035, 0.012);
    audio.blip(4186, 0.16, 'sine', 0.015, 0.02);
  },
  window() { audio.latch(); audio.pop(); },
  art() { audio.pop(); audio.blip(660, 0.14, 'triangle', 0.05, 0.05); },
  /** Wall clock: tick, tock. */
  tick() {
    audio.blip(1900, 0.025, 'square', 0.04);
    audio.blip(1350, 0.03, 'square', 0.035, 0.55);
  },
  vacuum() { audio.arp([784, 1046, 1318], 0.075, 'sine', 0.07); },
  phone() { audio.blip(988, 0.12, 'sine', 0.07); audio.blip(1480, 0.18, 'sine', 0.05, 0.07); },
  pad() { audio.blip(523, 0.5, 'sine', 0.05); audio.blip(784, 0.6, 'sine', 0.045, 0.08); },
  mac() { audio.click(); },
};
