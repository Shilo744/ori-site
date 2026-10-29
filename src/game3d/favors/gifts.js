// "Ori, Can You...?" — gifts from the neighbours (PURE) [experimental]: the hello + love loop pays back. Somebody Ori keeps saying hello to (on enough different days) hands him a small gift in their own voice:
// a lucky coin, a jar of jam, a paper plane. One gift each, twenty-one in all; they are kept in a collection on the journal's Achievements page and each one adds a little love. What counts is DAYS: a hello on
// a game day is one day (more hellos the same day are a pleasure, not a day), so a gift cannot be farmed by pressing H every minute.
import { CAST } from './content.js';

/** What each person gives, and after how many days of hellos (`at`: family and friends 2, the others 3, the bosses 4, the inspector 5). */
export const GIFTS = {
  ima: { name: 'A knitted scarf', line: 'It is thirty degrees. Take it anyway.', at: 2 },
  auntie: { name: 'A jar of lemon jam', line: 'From the tree that has opinions.', at: 2 },
  cousin: { name: 'A drawing of a peach', line: 'It has legs. It is running.', at: 2 },
  bossA: { name: 'A gold star sticker', line: 'For the thing nobody asked for and you did anyway.', at: 4 },
  bossB: { name: 'A startup t-shirt', line: 'One size fits nobody. Wear it with pride.', at: 4 },
  bossC: { name: 'A thank-you card', line: 'Three lines and a very long signature.', at: 4 },
  clerk: { name: 'Number 1', line: 'The lowest number she has ever given out.', at: 3 },
  inspector: { name: 'A clean bill of health', line: 'Stamped. In red. Frame it.', at: 5 },
  maya: { name: 'A Perach badge', line: 'Mentor of the day. The pin is a bit crooked.', at: 3 },
  yuval: { name: 'A paper plane', line: 'It flew almost to the end of the room.', at: 3 },
  noga: { name: 'A friendship bracelet', line: 'Blue and orange, tied with great care.', at: 3 },
  itay: { name: 'A trading card', line: 'The rare one. He does not know it is rare.', at: 3 },
  shilo: { name: 'A tiny golden peach', line: 'Teammate to teammate. Do not tell anyone.', at: 4 },
  dov: { name: 'A bike bell', line: 'Ding. Now you are fast too.', at: 3 },
  moti: { name: 'A lucky coin', line: 'Found it in the street in 1998. Keep it.', at: 2 },
  roee: { name: 'A bag of coffee beans', line: 'His best. Do not tell the other customers.', at: 2 },
  albert: { name: 'A stick of gum', line: 'On the house. The stamp is still extra.', at: 3 },
  parrot: { name: 'A green feather', line: 'He says it is lucky. The parrot looks unsure.', at: 3 },
  tourist: { name: 'A postcard', line: 'From a place that is a lot like here.', at: 3 },
  coach: { name: 'A pair of hand wraps', line: 'Washed. Almost.', at: 3 },
  uzi: { name: 'A shiny spanner', line: 'Polished with a sock. Keep it away from the cars.', at: 3 },
};
export const GIFT_IDS = Object.keys(GIFTS);
/** What each gift adds to the love of the neighbourhood. */
export const LOVE = 0.5;

const has = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(GIFTS, id);
/** On how many different game days he has said hello to this person. */
const days = (p, id) => { const g = p && p.gdays && p.gdays[id]; return g ? Math.max(0, Math.floor(Number(g.n) || 0)) : 0; };

/** A hello on game day `day`: counts as a new day when it is not the day already counted. Changes `p.gdays`; true when a new day was counted. */
export function noteHello(p, id, day) {
  if (!p || !has(id)) return false;
  const g = ((p.gdays ||= {})[id] ||= { n: 0, d: 0 });
  if (g.d === day) return false;
  g.n += 1;
  g.d = day;
  return true;
}

/** The gift this person gives now, or null (not one of them, already given, or not enough days of hellos yet). `p` = progress. */
export function giftDue(p, id) {
  if (!has(id)) return null;
  if (p && p.gifts && p.gifts[id]) return null;
  return days(p, id) >= GIFTS[id].at ? { id, ...GIFTS[id], who: (CAST[id] || {}).name || id } : null;
}

/** How many gifts he has. */
export const count = (p) => GIFT_IDS.filter((id) => p && p.gifts && p.gifts[id]).length;

/** The collection for the journal: every giver, what they give, how far along (days of hellos / needed) and whether it is his. */
export function collection(p) {
  return GIFT_IDS.map((id) => ({ id, who: (CAST[id] || {}).name || id, name: GIFTS[id].name, line: GIFTS[id].line, at: GIFTS[id].at, have: Math.min(days(p, id), GIFTS[id].at), got: !!(p && p.gifts && p.gifts[id]) }));
}
