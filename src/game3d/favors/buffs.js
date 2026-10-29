// "Ori, Can You...?" — food for the next fight (PURE) [experimental]: the places that have something to eat give Ori a little help in the ring, once, for the next fight of the day (Mum's soup, Auntie's tea, the kiosk's gum, a
// Perach snack, Roee's espresso). A bite is a small thing: every help is a multiplier of 1.1 to 1.35 on one or two of the boxer's numbers (see boxer.js statsFor), it lasts for ONE fight and is gone at the end of the day.

/**
 * `effect` multiplies the boxer's stats for that fight: maxHp (health), maxSt (breath), dmg (punch power), speed (feet), atk (how quick the hands are), regen (how fast the breath comes back).
 * `use` = the prop in the room that gives it (interiors.js): 'food:soup' ..., or the cafe's coffee counter and Perach's snack table that were already there.
 */
export const FOODS = {
  soup: { id: 'soup', place: 'mum', use: 'food:soup', name: "Mum's chicken soup", line: 'Eat, eat, you are too thin.', tag: 'more health', effect: { maxHp: 1.25 } },
  tea: { id: 'tea', place: 'auntie', use: 'food:tea', name: "Auntie's lemon tea", line: 'With honey. Of course.', tag: 'the breath comes back faster', effect: { regen: 1.35 } },
  gum: { id: 'gum', place: 'kiosk', use: 'food:gum', name: 'Kiosk gum', line: 'Minty. The hands feel quicker.', tag: 'quicker hands', effect: { atk: 1.1 } },
  snack: { id: 'snack', place: 'perach', use: 'snack', name: 'A Perach snack', line: 'The mentors swear by it.', tag: 'harder punches', effect: { dmg: 1.1 } },
  espresso: { id: 'espresso', place: 'cafe', use: 'coffee', name: "Roee's espresso", line: 'A tiny cup, a big kick.', tag: 'quicker feet, more breath', effect: { speed: 1.08, maxSt: 1.1 } },
};
export const FOOD_IDS = Object.keys(FOODS);
const has = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(FOODS, id); // (not 'constructor')
/** The most any one stat can be helped (the tests hold every food to it). */
export const MAX_BOOST = 1.35;

/** The food a room prop gives: 'food:soup' -> 'soup'; the cafe's 'coffee' -> 'espresso'; Perach's 'snack' -> 'snack'; anything else null. */
export function foodOfUse(use) {
  if (typeof use !== 'string') return null;
  if (use === 'coffee') return 'espresso';
  if (use === 'snack') return 'snack';
  const m = /^food:([a-z]+)$/.exec(use);
  return m && has(m[1]) ? m[1] : null;
}

/** The boxer's stats with the food in them (a new object; nothing is ever lowered; `food` null = as they were). */
export function applyBuff(stats, food) {
  const out = { ...stats };
  const e = food && food.effect;
  if (!e) return out;
  for (const k of Object.keys(e)) {
    if (typeof out[k] !== 'number') continue;
    const m = Math.min(MAX_BOOST, Math.max(1, e[k]));
    out[k] = k === 'maxHp' || k === 'maxSt' ? Math.round(out[k] * m) : out[k] * m;
  }
  return out;
}

/** What he is carrying: the food of today, or null (a food from yesterday is gone). `fed` = { id, day } from the save. */
export const fedFor = (fed, day) => (fed && typeof fed === 'object' && fed.day === day && has(fed.id) ? FOODS[fed.id] : null);

/** Is this the id of a food? (for the save) */
export const isFood = has;

/** One line for the menu and the journal: "Mum's chicken soup: more health". */
export const fedLine = (food) => (food ? `${food.name}: ${food.tag}` : '');
