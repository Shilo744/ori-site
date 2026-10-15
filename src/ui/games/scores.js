// Per-game high scores: best + the last 10 runs + play count, persisted through core/storage.
//   const { isBest, best } = scores.record('snake', 31);          // higher is better (default)
//   scores.record('minesweeper:beginner', 42.5, { lowerIsBetter: true });   // times: lower is better
import { storage } from '../../core/storage.js';
import { bus } from '../../core/bus.js';

const KEEP = 10;
const key = (id) => `scores:${id}`;
const empty = () => ({ best: null, runs: [], plays: 0, last: 0, lowerIsBetter: false });

export function get(id) {
  return { ...empty(), ...(storage.get(key(id), null) || {}) };
}

/** Records a finished run. Returns { best, isBest, rank } where rank is 1-based among the kept runs. */
export function record(id, score, { lowerIsBetter = false, extra = null } = {}) {
  const s = get(id);
  s.lowerIsBetter = lowerIsBetter;
  const better = (a, b) => (lowerIsBetter ? a < b : a > b);
  const isBest = s.best == null || better(score, s.best);
  if (isBest) s.best = score;
  s.runs.unshift({ score, at: Date.now(), ...(extra || {}) });
  s.runs.length = Math.min(s.runs.length, KEEP);
  s.plays += 1;
  s.last = Date.now();
  storage.set(key(id), s);
  const sorted = [...s.runs].sort((a, b) => (lowerIsBetter ? a.score - b.score : b.score - a.score));
  const rank = sorted.findIndex((r) => r.at === s.runs[0].at && r.score === score) + 1;
  bus.emit('game:score', { id, score, best: s.best, isBest, plays: s.plays });
  return { best: s.best, isBest, rank };
}

/** Counts a started run (for "play count" / "last played" even when the run is abandoned). */
export function touch(id) {
  const s = get(id);
  s.last = Date.now();
  storage.set(key(id), s);
}

export const best = (id) => get(id).best;

/** Every game that has any saved data: [{ id, best, plays, last, runs }]. Used by the Arcade leaderboard. */
export function all() {
  return storage.keys('scores:').map((k) => ({ id: k.slice('scores:'.length), ...get(k.slice('scores:'.length)) }));
}

export function reset(id) {
  if (id) storage.remove(key(id));
  else storage.clear('scores:');
}

export const scores = { get, record, touch, best, all, reset };
