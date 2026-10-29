// "Ori, Can You...?" — the first steps and "what now?" (PURE) [experimental]: three things to learn by doing (walk, say hello, open the map) that tick themselves off, and the words of the
// small panel that answers "what do I do now?" (the goal of the moment, where it is, the keys).

/** The keys of the game, for the panel. */
export const KEYS = [
  ['W A S D', 'move'], ['Shift', 'run'], ['H', 'say hello'], ['Space', 'use / get in / out'], ['G', 'go inside'],
  ['M', 'the map'], ['Tab', 'the journal'], ['Q E', 'turn the camera'], ['V', 'photo mode'], ['Esc', 'pause'], ['?', 'this help'],
];

/** What a new player learns first. `done(state)`; state = { moved (metres on foot), hellos, mapOpened }. */
export const TOUR = [
  { id: 'walk', text: 'Walk around', keys: ['W', 'A', 'S', 'D'], extra: 'hold Shift to run', done: (s) => s.moved >= 4 },
  { id: 'hello', text: 'Say hello to somebody', keys: ['H'], extra: 'walk up close first: a wave, a smile, a little more love', done: (s) => s.hellos >= 1 },
  { id: 'map', text: 'Open the map', keys: ['M'], extra: 'every place, the ring, his car', done: (s) => !!s.mapOpened },
];

/** The steps with where each stands: [{ id, text, keys, extra, done }]. */
export function tourSteps(state = {}) {
  const s = { moved: 0, hellos: 0, mapOpened: false, ...state };
  return TOUR.map((t) => ({ id: t.id, text: t.text, keys: t.keys, extra: t.extra, done: !!t.done(s) }));
}
export const tourDone = (steps) => steps.length > 0 && steps.every((x) => x.done);

/**
 * What the "what now?" panel says. `goal` = the current goal ({ title, hint, have, need, place }) or null; `placeName` = where it is (or null);
 * `tracked` = the place the beam already points at.
 * @returns {{ title: string, hint: string, progress: string, where: string, canTrack: boolean, tracking: boolean }}
 */
export function whatNow({ goal = null, placeName = null, tracked = null } = {}) {
  if (!goal) return { title: 'Nothing special: it is your day', hint: 'Say hello to people, box in the ring, play on the office computer, or just walk about.', progress: '', where: '', canTrack: false, tracking: false };
  const need = Math.max(1, goal.need || 1);
  const have = Math.min(need, Math.max(0, Math.floor(goal.have || 0)));
  return {
    title: goal.title,
    hint: goal.hint || '',
    progress: need > 1 ? `${have} / ${need}` : '',
    where: placeName ? `It is at ${placeName}.` : 'You can do it anywhere.',
    canTrack: !!goal.place && !!placeName,
    tracking: !!goal.place && tracked === goal.place,
  };
}
