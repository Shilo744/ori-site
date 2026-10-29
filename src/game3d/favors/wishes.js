// "Ori, Can You...?" — the daily wishes (PURE) [experimental]: every morning Ori has three small wishes, one easy, one a bit more, one a challenge, drawn by the day's seed from things the game already counts
// (hellos, a fight won, metres driven, a game on the office computer, a shift at the cafe, a parcel, a city event, the places gone into today ...). Each wish that is done pays peaches and earns a sticker; all three
// pay a bonus. Nothing is lost for leaving one: a wish that is not done by the day's end is just not stickered, and the next morning brings three new ones. A wish with a time ("before noon") says "maybe tomorrow".
import { mulberry32 } from '../rng.js';

/** The numbers the game keeps, read off `progress` and the boxer. A wish is measured against how much they grew since the morning. */
export const METRICS = ['hellos', 'wins', 'fights', 'driven', 'arcade', 'cafeRuns', 'parcels', 'evCount', 'kos', 'perfect'];
export function readMetrics({ p = {}, b = {} } = {}) {
  return { hellos: p.hellos || 0, wins: b.wins || 0, fights: b.fights || 0, driven: Math.floor(p.driven || 0), arcade: p.arcade || 0, cafeRuns: p.cafeRuns || 0, parcels: p.parcels || 0, evCount: p.evCount || 0, kos: p.kos || 0, perfect: p.perfect || 0 };
}

/** One wish: `tier` 1 easy / 2 more / 3 a challenge, `metric` what it watches ('places' = the places gone into today), `n` = [min, max, step], `before` = by this hour (optional). */
export const POOL = [
  { id: 'hello', tier: 1, metric: 'hellos', n: [3, 5, 1], words: (n) => `Say hello to ${n} people` },
  { id: 'hello-am', tier: 1, metric: 'hellos', n: [3, 4, 1], before: 12, words: (n) => `Say hello to ${n} people before noon` },
  { id: 'places', tier: 1, metric: 'places', n: [2, 3, 1], words: (n) => `Go inside ${n} different places` },
  { id: 'arcade', tier: 1, metric: 'arcade', n: [1, 1, 1], words: () => 'Play a game on the office computer' },
  { id: 'drive', tier: 2, metric: 'driven', n: [400, 900, 100], words: (n) => `Drive ${n} metres in Ori's car` },
  { id: 'coffee', tier: 2, metric: 'cafeRuns', n: [1, 1, 1], words: () => 'Help Roee with Coffee Rush' },
  { id: 'parcel', tier: 2, metric: 'parcels', n: [1, 1, 1], words: () => 'Deliver a parcel for Uzi' },
  { id: 'event', tier: 2, metric: 'evCount', n: [1, 1, 1], words: () => 'Enjoy a city event (look for the beam of light)' },
  { id: 'win', tier: 3, metric: 'wins', n: [1, 1, 1], words: () => 'Win a fight in the ring' },
  { id: 'ko', tier: 3, metric: 'kos', n: [1, 1, 1], words: () => 'Knock somebody out' },
  { id: 'perfect', tier: 3, metric: 'perfect', n: [2, 4, 1], words: (n) => `Dodge ${n} times at the perfect moment` },
  { id: 'fights', tier: 3, metric: 'fights', n: [2, 2, 1], words: () => 'Step into the ring twice' },
];

/** What each tier pays (peaches), and what three out of three adds. */
export const REWARD = { 1: 6, 2: 12, 3: 20 };
export const BONUS = { peaches: 30, love: 1 };
/** How many days of stickers the journal remembers. */
export const LOG_DAYS = 14;

const POOL_BY_ID = Object.fromEntries(POOL.map((w) => [w.id, w]));
/** 'drive:600' -> the wish with its number; null when it is not one of ours. */
export function wishOf(code) {
  const m = /^([a-z-]+):(\d{1,5})$/.exec(String(code));
  const w = m && POOL_BY_ID[m[1]];
  return w ? { ...w, n: Math.max(1, Number(m[2])) } : null;
}
export const wordsOf = (w) => w.words(w.n);

/**
 * Draws a day's three wishes: one of each tier, the same seed and day always the same three, never the same wish as yesterday's when there is another to take.
 * @returns {string[]} codes like 'hello:4'
 */
export function pickWishes({ seed = 1, day = 1, avoid = [] } = {}) {
  const rnd = mulberry32((Math.imul(seed, 131) + Math.imul(day, 7919) + 17) >>> 0);
  const out = [];
  for (const tier of [1, 2, 3]) {
    const all = POOL.filter((w) => w.tier === tier);
    const fresh = all.filter((w) => !avoid.includes(w.id));
    // (two hello wishes are never taken in the same day: only one per tier, so it cannot happen; the pool of a tier is never empty)
    const list = fresh.length ? fresh : all;
    const w = list[Math.floor(rnd() * list.length)];
    const [lo, hi, step] = w.n;
    const steps = Math.floor((hi - lo) / step) + 1;
    out.push(`${w.id}:${lo + Math.floor(rnd() * steps) * step}`);
  }
  return out;
}

/** An empty wish state (a first game, a garbled save): nothing drawn yet. */
export const emptyState = () => ({ day: 0, list: [], base: {}, done: {}, places: {}, bonus: false });

/** The morning: today's three wishes and the numbers they are measured from. `prev` = yesterday's state (its wishes are not drawn again). */
export function newDay({ seed, day, metrics, prev = null }) {
  const avoid = prev && prev.list ? prev.list.map((c) => (wishOf(c) || {}).id).filter(Boolean) : [];
  return { day, list: pickWishes({ seed, day, avoid }), base: { ...metrics }, done: {}, places: {}, bonus: false };
}

/** How the day is going: one row per wish. `hour` = the game clock (0-24). */
export function rows(state, metrics, hour = 0) {
  return (state.list || []).map((code) => {
    const w = wishOf(code);
    if (!w) return null;
    const have = w.metric === 'places' ? Object.keys(state.places || {}).length : Math.max(0, (metrics[w.metric] || 0) - ((state.base || {})[w.metric] || 0));
    const expired = w.before != null && hour >= w.before; // (a wish with a time cannot be finished after it: only one that was marked in time stays done)
    const done = !!(state.done && state.done[w.id]) || (have >= w.n && !expired);
    const late = !done && expired;
    return { code, id: w.id, tier: w.tier, text: wordsOf(w), have: Math.min(have, w.n), n: w.n, done, late, reward: REWARD[w.tier], pct: Math.round((Math.min(have, w.n) / w.n) * 100) };
  }).filter(Boolean);
}

/**
 * What changed since the last look: the wishes that are done now and were not marked, and whether that makes the day complete (the bonus is due once).
 * @returns {{ newly: ReturnType<typeof rows>, full: boolean }}
 */
export function settle(state, metrics, hour = 0) {
  const all = rows(state, metrics, hour);
  const newly = all.filter((r) => r.done && !(state.done && state.done[r.id]));
  const doneAfter = all.filter((r) => r.done).length;
  return { newly, full: !state.bonus && all.length === 3 && doneAfter === 3 };
}

/** The stickers of the journal: today's, then the days before (newest last), each 0-3. */
export const stickers = (state, log = []) => ({ today: Object.keys(state.done || {}).length, days: log.slice(-LOG_DAYS) });

/** Closing a day: how many of its wishes were done (goes on the log). */
export const closeDay = (state) => Math.min(3, Object.keys((state && state.done) || {}).length);
