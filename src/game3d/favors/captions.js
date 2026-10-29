// "Ori, Can You...?" — sound captions (PURE) [experimental]: for a player who cannot hear (or plays with the sound off), the sounds that tell you something become a short line of words at the bottom of the screen:
// the bell, the referee's count, a knock-out, a parry, a perfect dodge, the guard breaking, a level up, a car horn, the band in the park. A setting in the pause menu, off by default. Nothing here touches the DOM or
// the audio: `withCaptions` wraps a sound engine so that the same call that makes the sound also says its words.

/** How many lines show at once, how long a line stays (seconds), and how long the very same words are not said again. */
export const MAX = 3;
export const LIFE = 2.8;
export const SAME = 1.4;

/** What the ring's sounds say (null = not worth a caption). Each takes the arguments of the sound call. */
const ringTable = () => ({
  bell: (times = 1) => (times >= 3 ? 'Bell: the fight is over' : times === 2 ? 'Bell: fight!' : 'Bell: get ready'),
  count: (n) => `The referee counts: ${n}`,
  ko: () => 'Knock-out!',
  knockdown: () => 'Knock-down!',
  getup: () => 'Back on his feet',
  parry: () => 'Parry!',
  perfect: () => 'Perfect dodge!',
  guardbreak: () => 'The guard breaks!',
  fury: () => 'Peach Fury!',
  level: () => 'Level up!',
  lag: () => 'The boss is buffering...',
  cheer: (level = 0) => (level >= 0.7 ? 'The crowd cheers' : null),
  gasp: (level = 0) => (level >= 0.7 ? 'The crowd gasps' : null),
});

/** What the street's sounds say. `band` is called every frame with how loud it is: it speaks once, when the music starts being heard. */
const streetTable = () => {
  let heard = false;
  return {
    honk: () => 'A car horn',
    purr: () => 'A purr',
    band: (level = 0) => { const now = level > 0.05; const first = now && !heard; heard = now; return first ? 'A street band is playing' : null; },
  };
};

export const TABLES = { ring: ringTable, street: streetTable };
/** The sounds that can have words, by group (for the tests and the docs). */
export const CAPTIONED = { ring: Object.keys(ringTable()), street: Object.keys(streetTable()) };

/** Decides whether a caption is shown now: the same words are not repeated within `same` seconds. */
export function createCaptioner({ life = LIFE, max = MAX, same = SAME } = {}) {
  const last = new Map();
  return {
    life,
    max,
    /** @returns {boolean} true when these words should appear (at time `t`, in seconds) */
    say(text, t) {
      if (!text) return false;
      const was = last.get(text);
      if (was != null && t - was < same) return false;
      last.set(text, t);
      return true;
    },
  };
}

/**
 * Wraps a sound engine: the calls that have words say them too (through `say`), everything else (getters, other sounds) passes straight through.
 * @param {object} raw the engine (sfx.js or fight-sfx.js)
 * @param {'ring' | 'street'} group which table of words
 * @param {(text: string) => void} say
 */
export function withCaptions(raw, group, say) {
  const table = (TABLES[group] || (() => ({})))();
  const bound = new Map();
  return new Proxy(raw, {
    get(target, key) {
      const v = target[key];
      if (typeof v !== 'function') return v;
      const words = typeof key === 'string' ? table[key] : null;
      if (!words) { const hit = bound.get(key); if (hit && hit.src === v) return hit.fn; const fn = v.bind(target); bound.set(key, { src: v, fn }); return fn; } // (the cache knows when the property was replaced: a spy put on the engine afterwards is still called)
      return (...args) => {
        const r = v.apply(target, args);
        let text = null;
        try { text = words(...args); } catch { /* a caption must never break a sound */ }
        if (text) { try { say(text); } catch { /* nor the other way round */ } }
        return r;
      };
    },
  });
}
