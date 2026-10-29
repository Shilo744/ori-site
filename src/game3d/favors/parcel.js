// "Ori, Can You...?" — the parcel run (PURE) [experimental]: Uzi has a parcel for somebody across the neighbourhood. Take it from the garage, get it to the door before the clock says so
// (the faster the better: up to three stars). Late is fine too: the parcel still gets there and somebody still says thank you. By car it is quick; on foot it is a walk.
import { mulberry32 } from '../rng.js';

export const FROM = 'workshop';
/** The doors a parcel can go to. */
export const DESTS = ['cafe', 'kiosk', 'startup', 'mum', 'auntie', 'cityhall', 'perach', 'studio', 'sidegig', 'busstop', 'home'];
export const MIN_METERS = 70; // a parcel always goes a proper way
export const NEAR = 7; // metres from the door: delivered

/** The seconds on the clock for a way of `meters` (a car does about 17 m/s, a walker 5): generous on purpose. */
export const limitFor = (meters) => Math.round(28 + meters / 7);
/** Three stars for half the time or less, two for under four fifths of it, one in time, none when late. */
export const starsFor = (elapsed, limit) => (elapsed <= limit * 0.5 ? 3 : elapsed <= limit * 0.78 ? 2 : elapsed <= limit ? 1 : 0);
/** What each grade pays (by stars; none = late: still a thank-you). */
export const REWARD = [{ peaches: 3, love: 0 }, { peaches: 8, love: 0 }, { peaches: 16, love: 1 }, { peaches: 28, love: 2 }];
/** After this many times the limit the run is let go (the parcel waits at the garage). */
export const GIVE_UP = 2;

/**
 * Picks where the next parcel goes: a door far enough away, by the seed. `dist(a, b)` = metres between two places.
 * @returns {{ from: string, to: string, meters: number, limit: number }}
 */
export function pickRun({ seed = 1, dist }) {
  const rnd = mulberry32(seed * 7919 + 13);
  const far = DESTS.filter((d) => d !== FROM && dist(FROM, d) >= MIN_METERS);
  const to = far[Math.floor(rnd() * far.length)] || DESTS[0];
  const meters = dist(FROM, to);
  return { from: FROM, to, meters, limit: limitFor(meters) };
}

/** What the chip says: "Parcel for The Cafe: 1:12" (time left), or "late" once the clock has run out. */
export function chipFor(run, t, name) {
  const left = Math.ceil(run.limit - t);
  return `Parcel for ${name}: ${left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'take your time'}`;
}
