// A greedy bot that plays a whole day of "Ori, Can You...?" on the pure quest engine (no browser): it always walks to the task with the best
// payoff per minute that it can still make, answers yes, does it, and repeats. Used by the balance tests and (T54) the difficulty curve.
import { buildMap } from '../../src/game3d/favors/map.js';
import { createQuests, VERB_SECS, MIN_PER_SEC, DAY_END } from '../../src/game3d/favors/quests.js';

export const MAP = buildMap(51);

/**
 * @param {number} seed
 * @param {string} difficulty 'chill' | 'normal' | 'hectic'
 * @param {{ speed?: number, think?: number, quality?: number, delegate?: boolean, focus?: boolean }} o speed m/s, think = seconds between jobs
 */
export function botDay(seed, difficulty = 'normal', { speed = 6.6, think = 0.6, quality = 0.85, delegate = false, focus = false } = {}) {
  const q = createQuests({ seed, dist: MAP.dist, difficulty });
  let at = 'home';
  const tickTo = (m) => { while (q.state.min < m && !q.state.ended) q.tick(Math.min(1, m - q.state.min)); };
  let guard = 0;
  while (!q.state.ended && guard++ < 20000) {
    if (focus && q.focusReady() && q.state.chaos > 70) q.setFocus(true);
    if (delegate) for (const t of q.list(at)) if (t.delegable && q.state.mentors.tokens > 0 && t.remaining < 160) q.delegate(t.uid);
    const open = q.list(at).filter((t) => t.state !== 'delegated');
    let best = null;
    let bs = -1;
    for (const t of open) {
      const trip = (MAP.dist[at][t.at] / speed) * MIN_PER_SEC;
      const doing = VERB_SECS[t.verb] * MIN_PER_SEC;
      if (q.state.min + trip + doing > t.deadline) continue;
      const s = (t.score * (1 + t.pri * 0.2) + (t.deadline - q.state.min < 80 ? 40 : 0)) / (trip + doing + 4);
      if (s > bs) { bs = s; best = t; }
    }
    if (!best) { tickTo(Math.min(DAY_END, q.state.min + 3)); continue; }
    q.reply(best.uid, 'yes');
    tickTo(q.state.min + (MAP.dist[at][best.at] / speed) * MIN_PER_SEC);
    at = best.at;
    const t = q.get(best.uid);
    if (t && (t.state === 'new' || t.state === 'accepted')) { tickTo(q.state.min + VERB_SECS[t.verb] * MIN_PER_SEC); q.complete(best.uid, quality); }
    tickTo(q.state.min + think * MIN_PER_SEC);
  }
  return q;
}
