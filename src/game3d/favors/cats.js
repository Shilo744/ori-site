// "Ori, Can You...?" — the street cats (PURE) [experimental]: the three cats that sit about the neighbourhood (on a bench, on a car, by the kiosk door) can be petted. Space next to one: a purr, a heart, a little love for the first
// few pets; the third pet makes the cat his friend. Three friends make a "Cat person". A cat is only a cat: it never runs away, never scratches, and a second pet a moment later is just more purring.

/** The cats, by the name of their mesh in the street (life3d.js): `color` for "Pet the ginger cat", `name` once they are friends. */
export const CATS = [
  { id: 'ginger', color: 'ginger', name: 'Mango' },
  { id: 'grey', color: 'grey', name: 'Misty' },
  { id: 'tuxedo', color: 'black and white', name: 'Socks' },
];
export const CAT_IDS = CATS.map((c) => c.id);
/** How near (metres) to be, how long between two pets of the same cat (seconds), how many pets make a friend, what a pet is worth. */
export const REACH = 2.9; // (the cat on a parked car sits in the middle of the roof: from the end of the car it is two and a half metres away)
export const COOLDOWN = 4;
export const FRIEND_AT = 3;
export const LOVE_PER_PET = 0.15;
export const LOVE_PETS = 5;
export const FRIEND_PEACHES = 5;

const cat = (id) => CATS.find((c) => c.id === id) || null;

/** The cat within reach, the nearest one: `where` = { x, z }, `list` = [{ id, x, z }]. -> { id, d } or null */
export function nearestCat(where, list) {
  let best = null;
  for (const c of list || []) {
    if (!cat(c.id)) continue;
    const d = Math.hypot(c.x - where.x, c.z - where.z);
    if (d <= REACH && (!best || d < best.d)) best = { id: c.id, d };
  }
  return best;
}

/** The words on the chip: "Pet the ginger cat", and by name once he is a friend: "Pet Mango". */
export function label(id, pets = 0) {
  const c = cat(id);
  if (!c) return '';
  return pets >= FRIEND_AT ? `Pet ${c.name}` : `Pet the ${c.color} cat`;
}

/**
 * One pet: counts unless it is too soon after the last one. `pets` = how many so far, `since` = seconds since the last pet of this cat (null = never).
 * @returns {{ counted: boolean, pets: number, friend: boolean, love: number }} `friend` = he just became a friend; `love` = what this pet adds
 */
export function pet(pets, since) {
  if (since != null && since < COOLDOWN) return { counted: false, pets, friend: false, love: 0 };
  const n = pets + 1;
  return { counted: true, pets: n, friend: n === FRIEND_AT, love: n <= LOVE_PETS ? LOVE_PER_PET : 0 };
}

/** The numbers kept on the save: { ginger: 2, ... }. How many cats are friends / have been petted at all. */
export const friends = (p) => CAT_IDS.filter((id) => ((p && p.cats && p.cats[id]) || 0) >= FRIEND_AT).length;
export const petted = (p) => CAT_IDS.filter((id) => ((p && p.cats && p.cats[id]) || 0) >= 1).length;
export const nameOf = (id) => (cat(id) || {}).name || '';
