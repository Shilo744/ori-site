// "Ori, Can You...?" — the week (PURE): which day it is, what carries over from day to day (money, upgrades, the hearts, the golden peaches), the save
// slot, and the finale: who comes to Sababa Night. A day ends with a report; the campaign turns it into a summary and moves on.
import { WEEK, GUESTS, PARTY_LINES, GOLDEN } from './play-content.js';
import { createEconomy } from './economy.js';
import { gainXp } from './boxer.js';
import { REL } from './content.js';
import { safeStorage, sanitizeSave, encodeSave, decodeSave } from './save.js';

export { safeStorage }; // (the save slot lives in save.js now: versioned, sanitised, and it never throws)

/** What `progress` holds in a first game: the complete shape the save code gives back (so state -> code -> state changes nothing, and nothing needs a `|| {}`). */
const freshProgress = () => sanitizeSave({}).progress;

/** Who would come to the party with these hearts: [{ id, name, line, came }]. */
export function guestsFor(rel = {}, golden = 0) {
  return GUESTS.map((g) => ({ id: g.id, name: g.name, line: g.line, came: (rel[g.rel] ?? 0) + Math.min(6, golden * 0.6) >= g.min }));
}
export const partyLine = (n) => PARTY_LINES.reduce((a, [min, text]) => (n >= min ? text : a), PARTY_LINES[0][1]);

/**
 * @param {{ storage?: { read(): any, write(v: any): boolean | void, clear(): void, problem?: string | null }, fresh?: boolean, onProblem?: (kind: 'full' | 'blocked' | 'corrupt') => void }} [o]
 *   `fresh` ignores the save; `onProblem` hears (once per kind) that the browser would not save, or that the old save could not be read
 */
export function createCampaign({ storage = safeStorage(), fresh = false, onProblem = null } = {}) {
  let raw = null;
  if (!fresh) { try { raw = storage.read(); } catch { raw = null; } }
  const saved = sanitizeSave(raw); // (anything -> a complete, clamped save; null = a first game)
  const told = new Set();
  const tell = (kind) => { if (kind && !told.has(kind)) { told.add(kind); try { if (onProblem) onProblem(kind); } catch { /* the game goes on */ } } };
  if (!fresh && storage.problem === 'corrupt') tell('corrupt');
  const eco = createEconomy(saved && saved.eco);
  const s = {
    day: saved ? Math.min(WEEK.days + 1, saved.day || 1) : 1,
    rel: saved && saved.rel ? { ...saved.rel } : Object.fromEntries(Object.keys(REL).map((k) => [k, 60])),
    golden: saved && Array.isArray(saved.golden) ? [...saved.golden] : [],
    history: saved && Array.isArray(saved.history) ? saved.history.slice() : [],
    seed: saved && saved.seed ? saved.seed : 1,
    wins: saved && saved.wins ? { ...saved.wins } : {}, // set pieces won / tried: { race, inspection }
    // the life of Ori (T63): the love of the neighbourhood, the boxer, and what he has done (counters for the goals)
    love: saved && saved.love != null ? saved.love : 0,
    boxer: { xp: 0, level: 1, beaten: [], fights: 0, wins: 0, reveal: false, ...(saved && saved.boxer ? JSON.parse(JSON.stringify(saved.boxer)) : {}) },
    progress: { ...freshProgress(), ...(saved && saved.progress ? JSON.parse(JSON.stringify(saved.progress)) : {}) },
    endless: true, // days follow each other (there is no last day any more)
  };
  const snapshot = () => ({ day: s.day, rel: s.rel, golden: s.golden, history: s.history, seed: s.seed, wins: s.wins, love: s.love, boxer: s.boxer, progress: s.progress, eco: eco.snapshot() });
  const api = {
    eco,
    state: s,
    get day() { return s.day; },
    get finale() { return !s.endless && s.day > WEEK.days; },
    get ramp() { return WEEK.ramp[Math.min(WEEK.days, s.day) - 1]; },
    get dayName() { return WEEK.names[Math.min(WEEK.days, s.day) - 1]; },
    /** The seed of this day's quest plan: each day differs, the same week replays the same. */
    daySeed() { return s.seed * 101 + s.day * 7; },
    foundGolden(i) { return s.golden.includes(i); },
    pickGolden(i) { if (s.golden.includes(i) || i < 0 || i >= GOLDEN.length) return false; s.golden.push(i); return true; },
    /** The love of the neighbourhood, 0..100. Returns how much it really moved. */
    addLove(n) { const before = s.love; s.love = Math.max(0, Math.min(100, s.love + n)); return s.love - before; },
    /** XP for the boxer: { level, xp, gained: [levels], moves: [newly opened moves] }. */
    addXp(n) { return gainXp(s.boxer, n); },
    bump(stat, n = 1) { s.progress[stat] = (s.progress[stat] || 0) + n; return s.progress[stat]; },
    won(id) { return !!s.wins[id]; },
    mark(id, v = 1) { s.wins[id] = Math.max(s.wins[id] || 0, v); },
    /**
     * The day is over: `report` from quests.report(), `relNow` the hearts at midnight. Returns the summary the card shows and advances to the next day
     * (call `advance()` when the player taps "Next day").
     */
    summarize(report, { relNow, tried = {} } = {}) {
      const before = { ...s.rel };
      const rel = { ...(relNow || s.rel) };
      const delta = Object.fromEntries(Object.keys(rel).map((k) => [k, Math.round((rel[k] - (before[k] ?? 60)) * 10) / 10]));
      const by = eco.breakdown();
      const sum = {
        day: s.day, dayName: api.dayName, theme: api.ramp.theme, last: s.day >= WEEK.days,
        earned: eco.todayTotal, by, peaches: eco.peaches, lines: report.lines || [], helped: report.helped, rank: report.rank, score: report.score, bestStreak: report.bestStreak,
        rel, delta, golden: s.golden.length, goldenTotal: GOLDEN.length, afford: eco.affordable(), tried,
      };
      s.rel = rel;
      s.history.push({ day: s.day, earned: sum.earned, helped: sum.helped, score: sum.score });
      return sum;
    },
    /** The next day (or the finale after the last). */
    advance() { s.day = Math.min(WEEK.days + 1, s.day + 1); eco.newDay(); api.save(); },
    /** The finale: who came to Sababa Night, and how big it was. */
    party() {
      const g = guestsFor(s.rel, s.golden.length);
      const n = g.filter((x) => x.came).length;
      return { guests: g, came: n, of: g.length, line: partyLine(n), full: n === g.length };
    },
    /** True when it was written; when the browser says no (full / blocked) `onProblem` hears of it once. */
    save() { const ok = storage.write(snapshot()); if (ok === false) tell(storage.problem || 'blocked'); return ok !== false; },
    /** Replaces the whole game with a save (the import). False when it is not a save. */
    load(save) {
      const v = sanitizeSave(save);
      if (!v) return false;
      eco.restore(v.eco);
      Object.assign(s, { day: v.day, rel: v.rel, golden: v.golden, history: v.history, seed: v.seed, wins: v.wins, love: v.love, boxer: v.boxer, progress: v.progress });
      return true;
    },
    /** The game as a short code to copy: ORI2-... */
    exportCode() { return encodeSave(snapshot()); },
    /** A pasted code: { ok: true, save } after it replaced the game (and was saved), or { ok: false, error } with everything left as it was. */
    importCode(text) { const r = decodeSave(text); if (!r.ok) return r; api.load(r.save); api.save(); return r; },
    /** A brand new week (new seed). */
    reset() { storage.clear(); const seed = s.seed + 1; eco.restore({ peaches: 40, owned: {}, lifetime: 0, spent: 0 }); eco.newDay(); Object.assign(s, { day: 1, rel: Object.fromEntries(Object.keys(REL).map((k) => [k, 60])), golden: [], history: [], seed, wins: {}, love: 0, boxer: { xp: 0, level: 1, beaten: [], fights: 0, wins: 0, reveal: false }, progress: freshProgress() }); },
  };
  return api;
}
