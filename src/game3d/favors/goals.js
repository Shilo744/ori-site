// "Ori, Can You...?" — the goals (PURE): no phone, no messages. One goal at a time, shown in a chip with an arrow and a beam; when it is done the next one
// opens and a little reward comes. The state lives in the campaign (love, progress counters, the boxer record).

/** `have(c)` = how far along, `need` = the target; `place` = where the beam points; `hidden`: shown only when `showIf(c)`. */
export const GOALS = [
  { id: 'hello', title: 'Say hello to 5 people', hint: 'Walk up to someone and press H', place: null, need: 5, have: (c) => c.state.progress.hellos, reward: { peaches: 20, xp: 20, love: 2 } },
  { id: 'ringfind', title: 'Find The Ring', hint: 'Follow the beam, or press M for the map', place: 'court', need: 1, have: (c) => c.state.progress.ringSeen || 0, reward: { peaches: 15, xp: 10, love: 1 } },
  { id: 'office', title: 'Visit the office and say hi to Shilo', hint: 'The Startup. Go in with G', place: 'startup', need: 1, have: (c) => c.state.progress.shiloHi, reward: { peaches: 25, xp: 25, love: 3 } },
  { id: 'arcade', title: 'Play a game on the office computer', hint: 'Space at the glowing screen', place: 'startup', need: 1, have: (c) => c.state.progress.arcade, reward: { peaches: 25, xp: 25, love: 2 } },
  { id: 'ring1', title: 'Win your first fight at The Ring', hint: 'The court. Space at the ring', place: 'court', need: 1, have: (c) => c.state.boxer.beaten.length, reward: { peaches: 30, xp: 0, love: 3 } },
  { id: 'love25', title: 'Make the neighbourhood love you (25)', hint: 'Say hi to people, win fights', place: null, need: 25, have: (c) => c.state.love, reward: { peaches: 40, xp: 40, love: 0 } },
  { id: 'ladder3', title: 'Beat three fighters', hint: 'Climb the ladder at The Ring', place: 'court', need: 3, have: (c) => c.state.boxer.beaten.length, reward: { peaches: 60, xp: 50, love: 3 } },
  { id: 'champ', title: 'Beat the champion', hint: 'Coach waits at the top of the ladder', place: 'court', need: 1, have: (c) => (c.state.boxer.beaten.includes('coach') ? 1 : 0), reward: { peaches: 100, xp: 0, love: 6 } },
  { id: 'secret', title: 'Somebody is waiting in the ring...', hint: 'Go back to The Ring', place: 'court', need: 1, have: (c) => (c.state.boxer.beaten.includes('shilo') ? 1 : 0), reward: { peaches: 300, xp: 0, love: 10 }, showIf: (c) => !!c.state.boxer.reveal },
];

/** All goals with their progress: [{ id, title, hint, place, need, have, done, shown }]. */
export function goalList(c) {
  const done = c.state.progress.goalsDone || [];
  return GOALS.map((g) => ({ id: g.id, title: g.title, hint: g.hint, place: g.place, need: g.need, have: Math.min(g.need, Math.floor(g.have(c))), done: done.includes(g.id), shown: !g.showIf || g.showIf(c), reward: g.reward }));
}

/** The goal Ori is on now (the first one not done and shown), or null when he has done them all. */
export function currentGoal(c) { return goalList(c).find((g) => g.shown && !g.done) || null; }

/** Marks the goals that are reached now as done; returns them (the caller pays the reward). */
export function checkGoals(c) {
  const out = [];
  const done = (c.state.progress.goalsDone ||= []);
  for (const g of GOALS) {
    if (done.includes(g.id)) continue;
    if (g.showIf && !g.showIf(c)) continue;
    if (g.have(c) >= g.need) { done.push(g.id); out.push(g); }
  }
  return out;
}
