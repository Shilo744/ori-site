// "Ori, Can You...?" — the career (PURE): the little numbers of a life in the neighbourhood, counted as it happens (a few counters on the save's `progress`) and shown on the
// journal's last section. Nothing here is ever taken away: the numbers only go up.
import { GOLDEN } from './play-content.js';
import { GAMES } from './arcade.js';

const n = (v) => (Number.isFinite(v) ? v : 0);

/** A bout is over: `progress` (campaign.state.progress) learns what happened. `res` = the bout's result ({ winner, how, stats }). Returns `progress`. */
export function tallyFight(progress, res) {
  const s = (res && res.stats) || {};
  const add = (k, v) => { progress[k] = n(progress[k]) + Math.max(0, Math.round(n(v))); };
  if (res && res.winner === 'player' && res.how === 'ko') add('kos', 1);
  if (res && res.winner === 'player' && s.taken != null && n(s.taken) === 0) add('flawless', 1); // (a win without being hit)
  add('perfect', s.perfect);
  add('parries', s.parry);
  add('landed', s.hits);
  progress.bestCombo = Math.max(n(progress.bestCombo), Math.round(n(s.maxCombo)));
  return progress;
}

/** What the journal shows: [{ id, label, value }] in a fixed order (eleven numbers). `golden` = how many golden peaches are found, `lifetime` = peaches earned in all. */
export function careerStats({ boxer = {}, progress = {}, day = 1, golden = 0, lifetime = 0 } = {}) {
  const best = progress.best || {};
  const arcade = GAMES.filter((g) => n(best[g.id]) > 0).map((g) => `${g.name} ${n(best[g.id])}`);
  const combo = n(progress.bestCombo);
  return [
    { id: 'fights', label: 'Fights won', value: `${n(boxer.wins)} / ${n(boxer.fights)}` },
    { id: 'kos', label: 'Knock-outs', value: String(n(progress.kos)) },
    { id: 'perfect', label: 'Perfect dodges', value: String(n(progress.perfect)) },
    { id: 'parries', label: 'Parries', value: String(n(progress.parries)) },
    { id: 'combo', label: 'Best combo', value: combo ? `${combo} hits` : '-' },
    { id: 'hellos', label: 'Hellos', value: String(n(progress.hellos)) },
    { id: 'arcade', label: 'Arcade bests', value: arcade.length ? arcade.join(' · ') : '-' },
    { id: 'days', label: 'Day', value: String(Math.max(1, n(day))) },
    { id: 'peaches', label: 'Peaches earned', value: String(n(lifetime)) },
    { id: 'golden', label: 'Golden peaches', value: `${n(golden)} / ${GOLDEN.length}` },
    { id: 'events', label: 'City events enjoyed', value: String(n(progress.evCount)) },
  ];
}
