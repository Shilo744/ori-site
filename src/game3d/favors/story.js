// "Ori, Can You...?" — a short story with a clear end: "The Peach Tree" (PURE) [experimental]. After his first five hellos Mum starts whispering; five people each give a clue when Ori says hello
// to them in the right order (Mum, Moti, Albert, Roee, Coach), and the last one sends him to the park, where the whole neighbourhood has planted a peach tree for him and the band plays.
// Everything is kept on the save as two counters (`progress.story` = clues given so far, `progress.storyEnd` = the party happened).

/** The clues, in order. `who` = the cast member who says it (when Ori says hello to them), `place` = where to find them, `chip` = the line on the screen. */
export const STEPS = [
  { who: 'ima', place: 'mum', chip: 'Mum has a secret: say hello to her', clue: 'Motek... the whole street is whispering about you. Ask Moti. Secrets do not stay long with him!' },
  { who: 'moti', place: 'home', chip: 'Ask Moti, in your building', clue: 'Shh! I said nothing! ...Ask Albert at the kiosk. He sold the soil.' },
  { who: 'albert', place: 'kiosk', chip: 'Ask Albert at the kiosk', clue: 'Soil? Eleven bags! Roee carried them. Ask him at the cafe.' },
  { who: 'roee', place: 'cafe', chip: 'Ask Roee at the cafe', clue: 'Bro, I swore on my coffee! ...Coach did the lifting. Go ask him at the ring.' },
  { who: 'coach', place: 'court', chip: 'Ask Coach at the ring', clue: 'Fine! It is for you. Go to the park. Now. And act surprised.' },
];
/** The last step: go to the park, stand there a moment, and the party starts. */
export const PARTY = { place: 'park', chip: 'Go to the park: everybody is waiting', stay: 3, seconds: 50, chipDone: '', reward: { peaches: 50, love: 8, xp: 40 }, toast: 'SURPRISE! The neighbours planted a peach tree for you.', line: 'Act surprised, Ori. You are bad at it. We love you anyway.' };
/** The party in the park wears the look of an event (the beam, the sign, the band) while it lasts. */
export const PARTY_EVENT = { id: 'party', name: 'Peach party', place: 'park', sign: 'PEACH PARTY', short: 'PARTY', color: '#ffb25b', music: true };
/** What each clue pays (small: the story is the reward). */
export const CLUE_REWARD = { peaches: 3, love: 1 };

const n = (v) => (Number.isFinite(v) ? v : 0);

/** The story starts when the first goal (five hellos) is done. */
export const started = (p) => (p.goalsDone || []).includes('hello') || n(p.story) > 0;
export const finished = (p) => n(p.storyEnd) > 0;

/** Where the story stands: null (not started or over), or { kind: 'clue', index, step } / { kind: 'party', step: PARTY }. */
export function current(p = {}) {
  if (finished(p) || !started(p)) return null;
  const i = Math.max(0, Math.min(STEPS.length, Math.floor(n(p.story))));
  return i < STEPS.length ? { kind: 'clue', index: i, step: STEPS[i] } : { kind: 'party', index: i, step: PARTY };
}

/** The line on the screen for the story ('' when there is none). */
export const chipText = (p) => { const c = current(p); return c ? c.step.chip : ''; };
/** The place the story points at now (or null). */
export const placeOf = (p) => { const c = current(p); return c ? c.step.place : null; };

/**
 * Ori said hello to `who`: if they are the next one in the story, the clue is theirs. Returns { clue, index, last } (and counts it on `p`), or null.
 * `last` = this was the fifth clue: the park is next.
 */
export function takeClue(p, who) {
  const c = current(p);
  if (!c || c.kind !== 'clue' || c.step.who !== who) return null;
  p.story = c.index + 1;
  return { clue: c.step.clue, index: c.index, last: c.index + 1 >= STEPS.length };
}

/** He arrived at the park with every clue: the party. Counts it on `p` and returns the reward, or null. */
export function takeParty(p) {
  const c = current(p);
  if (!c || c.kind !== 'party') return null;
  p.storyEnd = 1;
  return PARTY;
}
