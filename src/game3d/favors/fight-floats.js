// "Ori, Can You...?" — the numbers that float up over whoever is hit (PURE: no DOM, no three). `floatFor(event)` turns an event of the sim (boxing.js) into
// what to show: white = a clean hit, gold = a counter (the payoff of a perfect dodge or a parry) and the PERFECT of the dodge itself, small grey = a punch the
// guard took. `createFloatPool(n)` is the fixed set of slots they live in: the DOM side (fight-ui.js) paints exactly these n elements and nothing is created
// while a fight is on, so a long fight cannot leak anything.

export const FLOAT_LIFE = 0.95; // seconds a number stays up

/** What a sim event shows over a fighter, or null: { who: 'player' | 'opp', text, kind: 'white' | 'gold' | 'grey', size }. */
export function floatFor(e) {
  switch (e.type) {
    case 'hit': {
      const text = `${Math.max(1, Math.round(e.dmg))}`;
      if (e.counter) return { who: e.target, text, kind: 'gold', size: 1.35 };
      return { who: e.target, text, kind: 'white', size: e.heavy ? 1.2 : 1 };
    }
    case 'block': return { who: e.who, text: `${Math.max(1, Math.round(e.dmg))}`, kind: 'grey', size: 0.72 };
    case 'perfect': return { who: e.who, text: 'PERFECT', kind: 'gold', size: 0.8 };
    default: return null;
  }
}

/** A word that floats (the speed bag's PERFECT / GOOD): not a fight event, so it is made by hand. */
export const floatWord = (who, text, kind = 'white', size = 0.9, extra = {}) => ({ who, text, kind, size, ...extra }); // (extra: { rise, life } - a word floats a shorter way than a number)

/** `n` slots, reused for ever. spawn() never allocates: it takes a free slot, or recycles the one nearest its end. */
export function createFloatPool(n = 10) {
  const slots = Array.from({ length: n }, (_, i) => ({ i, live: false, t: 0, life: FLOAT_LIFE, rise: 0.95, text: '', kind: 'white', size: 1, who: 'opp', x: 0, y: 0, z: 0, dx: 0 }));
  let seq = 0;
  return {
    slots,
    get size() { return slots.length; },
    get live() { let c = 0; for (const s of slots) if (s.live) c++; return c; },
    /** Puts `f` (from floatFor) at the world point (x, y, z); returns the slot that now holds it. */
    spawn(f, x, y, z) {
      let s = slots.find((q) => !q.live);
      if (!s) s = slots.reduce((a, b) => (a.t / a.life >= b.t / b.life ? a : b));
      seq++;
      s.live = true; s.t = 0; s.life = f.life || FLOAT_LIFE; s.rise = f.rise || 0.95; s.text = f.text; s.kind = f.kind; s.size = f.size || 1; s.who = f.who;
      s.x = x; s.y = y; s.z = z;
      s.dx = (seq % 2 ? 1 : -1) * (10 + ((seq * 7) % 22)); // (a flurry fans out sideways instead of piling up)
      return s;
    },
    update(dt) { for (const s of slots) if (s.live) { s.t += dt; if (s.t >= s.life) s.live = false; } },
    clear() { for (const s of slots) s.live = false; },
  };
}

/** How a live slot is drawn at its age: the rise in metres, the scale (it starts big and settles) and the opacity (it fades at the end). */
export function floatLook(s) {
  const u = Math.max(0, Math.min(1, s.t / s.life));
  const rise = (s.rise || 0.95) * (1 - (1 - u) ** 2.2);
  const pop = u < 0.14 ? 1.55 - 0.55 * (u / 0.14) : 1;
  const alpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
  return { rise, scale: s.size * pop, alpha };
}
