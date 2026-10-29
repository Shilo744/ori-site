// The frame rate keeper (PURE): trades resolution for smoothness. The host feeds it the measured fps every half second and applies the pixel ratio it answers with.
// A few slow seconds in a row step the ratio down (never below `min`); a long stretch with room to spare steps it back up (never above what the screen offers); after any
// change it rests for a moment so one hitch (a shader compiling, a scene change) cannot make it flap. And it checks that a step down HELPED: if the fps did not rise (a
// display that only does 30 frames, a machine held back by its processor, not its graphics) it takes the step back and leaves the resolution alone for the rest of the game.
const round2 = (v) => Math.round(v * 100) / 100;

/**
 * @param {{ max?: number, min?: number, low?: number, high?: number, down?: number, up?: number, step?: number, hold?: number, probe?: number, gain?: number }} [o]
 *   max = the ratio the screen offers (devicePixelRatio, capped), min = never below, low = fps under which a moment is slow, high = fps from which there is room to spare,
 *   down / up = seconds of slow / of room it takes to step, step = the factor of one step (0.8 = a fifth fewer pixels per side), hold = seconds of rest after a change,
 *   probe = seconds over which it measures whether a step down helped, gain = how much better (a factor) the fps must be for it to count as helped
 */
export function createAdaptiveRes({ max = 2, min = 0.75, low = 40, high = 58, down = 2.5, up = 12, step = 0.8, hold = 3, probe: probeSecs = 1.5, gain = 1.12 } = {}) {
  let top = Math.max(min, max);
  let ratio = top;
  let slow = 0;
  let slowSum = 0; // fps x seconds, over the slow stretch
  let fast = 0;
  let rest = 0;
  let probe = null; // after a step down: { from, fps, t, sum }
  let locked = false; // a step down did not help: no more of them this game
  return {
    get ratio() { return ratio; },
    get max() { return top; },
    get locked() { return locked; },
    /** One measurement: `fps` over the last `dt` seconds. Returns the new ratio when it CHANGED, otherwise null. */
    sample(fps, dt = 0.5) {
      if (!Number.isFinite(fps) || !(dt > 0)) return null;
      if (rest > 0) { rest -= dt; slow = 0; slowSum = 0; fast = 0; return null; }
      if (probe) { // did the last step down help?
        probe.t += dt; probe.sum += fps * dt;
        if (probe.t < probeSecs) return null;
        const avg = probe.sum / probe.t;
        const from = probe.from;
        const full = (1 / step) ** 2 - 1; const part = (probe.from / ratio) ** 2 - 1; // (a small step - the last one before the floor - has to gain less)
        const need = 1 + (gain - 1) * Math.min(1, part / full);
        const helped = avg >= probe.fps * need || avg >= high;
        probe = null;
        if (!helped) { ratio = from; locked = true; rest = hold; return ratio; }
      }
      if (fps < low && !locked) { slow += dt; slowSum += fps * dt; fast = 0; } else if (fps >= high && ratio < top) { fast += dt; slow = 0; slowSum = 0; } else { slow = 0; slowSum = 0; fast = 0; }
      if (slow >= down && ratio > min) { probe = { from: ratio, fps: slowSum / slow, t: 0, sum: 0 }; ratio = Math.max(min, round2(ratio * step)); slow = 0; slowSum = 0; rest = hold; return ratio; }
      if (fast >= up) { ratio = Math.min(top, round2(ratio / step)); fast = 0; rest = hold; return ratio; }
      return null;
    },
    /** The screen changed (another monitor, the window moved): a new top, and back to it. */
    reset(newMax = top) { top = Math.max(min, newMax); ratio = top; slow = 0; slowSum = 0; fast = 0; rest = 0; probe = null; locked = false; return ratio; },
  };
}
