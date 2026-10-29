// "Ori, Can You...?" — the cafe job "Coffee Rush" (PURE) [experimental]: Roee is swamped, Ori takes the orders. A customer wants one, two or three drinks in a row; press the matching keys
// (J espresso, K latte, L tea) before the customer's patience runs out. A mistake starts the order again, a streak of happy customers pays a bonus and adds a little to the clock.
import { mulberry32 } from '../rng.js';

export const DRINKS = [
  { id: 'espresso', key: 'J', code: 'KeyJ', name: 'Espresso', color: '#6b3f24' },
  { id: 'latte', key: 'K', code: 'KeyK', name: 'Latte', color: '#e8d3b0' },
  { id: 'tea', key: 'L', code: 'KeyL', name: 'Tea', color: '#7fc97f' },
];
export const SECONDS = 45;
const MAX_TIME = 60; // the clock never holds more than this, whatever the bonuses

/** How many drinks the next customer wants, by how many were served so far: 1 at first, 2 from the fourth, 3 from the ninth. */
export const sizeFor = (served) => (served >= 8 ? 3 : served >= 3 ? 2 : 1);
/** How long a customer waits (seconds): longer for bigger orders, a little less patient as the rush goes on. */
export const patienceFor = (size, served) => Math.max(2.2, 2.6 + size * 1.5 - Math.min(1.4, served * 0.07));
/** The points of a served order: more for bigger ones, plus a bonus for a streak (capped). */
export const pointsFor = (size, streak) => 10 * size + 5 * Math.min(5, streak);
/** Peaches for a score; the lunch rush (12-14) pays one and a half times. */
export const peachesFor = (score, lunch = false) => Math.max(2, Math.min(40, Math.floor((score / 12) * (lunch ? 1.5 : 1))));

/** @param {{ seed?: number, seconds?: number }} [o] */
export function createCoffeeRun({ seed = 1, seconds = SECONDS } = {}) {
  const rnd = mulberry32(seed);
  const s = { time: seconds, served: 0, left: 0, wrong: 0, streak: 0, bestStreak: 0, score: 0, over: false, order: null, wait: 0, maxWait: 1 };
  function next() {
    const size = sizeFor(s.served);
    s.order = { items: Array.from({ length: size }, () => DRINKS[Math.floor(rnd() * DRINKS.length)].id), i: 0 };
    s.maxWait = patienceFor(size, s.served);
    s.wait = s.maxWait;
  }
  next();
  return {
    state: s,
    /** A key (by its letter: 'J' | 'K' | 'L'): 'ok' (right drink), 'done' (the order is served), 'wrong' (it starts again), or null (not a drink key / over). */
    press(key) {
      if (s.over) return null;
      const d = DRINKS.find((x) => x.key === String(key).toUpperCase());
      if (!d) return null;
      if (d.id === s.order.items[s.order.i]) {
        s.order.i++;
        if (s.order.i < s.order.items.length) return 'ok';
        s.served++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak);
        s.score += pointsFor(s.order.items.length, s.streak - 1);
        s.time = Math.min(MAX_TIME, s.time + (s.streak >= 5 ? 0.9 : 0.5)); // (a little: a fast player can stretch the clock, never stop it)
        next();
        return 'done';
      }
      s.wrong++; s.streak = 0; s.order.i = 0; s.wait = Math.max(0.6, s.wait - 0.9);
      return 'wrong';
    },
    update(dt) {
      if (s.over) return;
      s.time = Math.max(0, s.time - dt);
      s.wait -= dt;
      if (s.wait <= 0) { s.left++; s.streak = 0; s.time = Math.max(0, s.time - 1.5); next(); } // (the customer sighs and leaves)
      if (s.time <= 0) s.over = true;
    },
    view() { return { time: s.time, served: s.served, left: s.left, wrong: s.wrong, streak: s.streak, bestStreak: s.bestStreak, score: s.score, over: s.over, order: { items: s.order.items.slice(), i: s.order.i }, patience: Math.max(0, s.wait / s.maxWait) }; },
  };
}
