// The error boundary's policy (PURE): when a game's frame throws, the host pauses it and shows a warm card; this decides what the card offers.
// "Carry on" is offered the first times; not when the game trips again right after it was resumed (it would only loop), and not more than `max` times per game.
/**
 * @param {{ now?: () => number, calm?: number, max?: number }} [o] `calm` = ms after "carry on" in which another trip is final, `max` = trips after which it is always final
 */
export function createTripwire({ now = () => Date.now(), calm = 2000, max = 3 } = {}) {
  let trips = 0;
  let resumedAt = -Infinity;
  return {
    get trips() { return trips; },
    /** The frame threw. Returns { carryOn, trips }: whether "Carry on" may be offered. */
    hit() {
      trips++;
      return { carryOn: trips < max && now() - resumedAt >= calm, trips };
    },
    /** The player chose "Carry on". */
    resumed() { resumedAt = now(); },
  };
}

/** What the card says. `who` = the game's own name for itself ("Ori" in the favors game). */
export function tripCard({ carryOn, who = 'The game', startup = false }) {
  if (startup) return { title: 'Something tripped', body: `${who} stumbled while starting up. Press Esc to go back to the desktop and open the game again.` };
  if (carryOn) return { title: 'Something tripped', body: `${who} stumbled over something. Your day is safe: carry on, or head back to the desktop (Esc).` };
  return { title: 'Something tripped again', body: `${who} stumbled again, so it is better to stop here. Press Esc to go back to the desktop and open the game again.` };
}
