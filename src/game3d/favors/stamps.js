// "Ori, Can You...?" — the stamp book (PURE) [experimental]: a stamp for every place Ori has been to. The eleven he can go inside are stamped at the door the first time he steps in; the three open ones (the bus stop, the park,
// the ring) are stamped when he first walks up to them. A full book pays a little reward and an achievement. Rooms he went into before the book existed already count.
import { PLACES } from './content.js';

/** The places with a room inside (the stamp comes when he goes in). */
export const ROOM_STAMPS = ['home', 'mum', 'auntie', 'cityhall', 'perach', 'studio', 'startup', 'sidegig', 'cafe', 'kiosk', 'workshop'];
/** The open places (the stamp comes when he walks up to them). */
export const OPEN_STAMPS = ['busstop', 'park', 'court'];
export const STAMPS = [...ROOM_STAMPS, ...OPEN_STAMPS];
/** How near an open place he must come (metres); the park counts from its edge. */
export const NEAR = 12;
/** What a full book pays. */
export const REWARD = { peaches: 40, love: 2 };

/** The stamps a save has: the flags on `progress.stamps`, plus the rooms the old `progress.seen` remembers. -> { placeId: true } */
export function got(p = {}) {
  const out = {};
  for (const id of STAMPS) if ((p.stamps && p.stamps[id]) || (ROOM_STAMPS.includes(id) && p.seen && p.seen[id])) out[id] = true;
  return out;
}
export const count = (p) => Object.keys(got(p)).length;
export const isFull = (p) => count(p) === STAMPS.length;

/** The book for the journal: every place with its name, colour and sign, and whether it is stamped. */
export function book(p) {
  const have = got(p);
  return STAMPS.map((id) => ({ id, name: PLACES[id].name, tone: PLACES[id].tone, sign: PLACES[id].sign, open: OPEN_STAMPS.includes(id), got: !!have[id] }));
}

/**
 * Which open places he is at right now and has not yet stamped.
 * @param {{ x: number, z: number, points: Record<string, { x: number, z: number }>, park: { x0: number, x1: number, z0: number, z1: number } | null }} where `points` = the busstop and the ring (court)
 * @param {Record<string, boolean>} have the stamps so far
 */
export function newOpenStamps({ x, z, points = {}, park = null }, have = {}) {
  const out = [];
  for (const id of OPEN_STAMPS) {
    if (have[id]) continue;
    if (id === 'park') { if (park && x >= park.x0 - 2 && x <= park.x1 + 2 && z >= park.z0 - 2 && z <= park.z1 + 2) out.push(id); continue; }
    const p = points[id];
    if (p && Math.hypot(p.x - x, p.z - z) <= NEAR) out.push(id);
  }
  return out;
}
