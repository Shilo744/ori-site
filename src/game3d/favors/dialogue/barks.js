// Barks: the short things people call out when Ori walks past (PURE). Warm, a little funny, never mean.
import { mulberry32 } from '../../rng.js';

const pick = (rnd, a) => a[Math.floor(rnd() * a.length) % a.length];

const GENERAL = ['Ori! My friend!', 'Hey, Ori! Looking good!', 'Ori! Big smile today!', 'Shalom, Ori!', 'There he is!', 'Ori, you always look like you are on a mission!', 'Great curls today, Ori!'];
const MORNING = ['Good morning, Ori! Coffee is on me later.', 'Early bird! Good morning, Ori!'];
const NOON = ['Ori! Have you eaten? Come, there is plenty!', 'Lunchtime, Ori! The falafel is on fire.'];
const EVENING = ['Ori! Beautiful evening, no?', 'Evening, Ori! Look at that sky.'];
const NIGHT = ['Ori! Late night hero!', 'Go home soon, hero! Or not. You are glowing.'];
const FRIENDS = ['Ori! Grab a coffee after?', 'My favourite helper!', 'Ori! You owe me a game, you know.'];
const FAMILY = ['Ori! Call your mother. She is proud already.', 'Ori, motek! Family dinner Friday!'];
const STRANGER = ['Hi! You look like someone who knows the way!', 'Nice day, huh?', 'Hello there! Great glasses!'];

/** One bark for a speaker group. `rel` = 'friends' | 'family' | ... | null, `hour` 0-24. */
export function barkFor({ rel = null, hour = 12, seed = 1 } = {}) {
  const rnd = mulberry32((seed >>> 0) || 1);
  const time = hour < 10 ? MORNING : hour < 15 ? NOON : hour < 20 ? EVENING : NIGHT;
  const pool = [...GENERAL, ...(rel === 'friends' ? FRIENDS : rel === 'family' ? FAMILY : rel === 'strangers' || !rel ? STRANGER : []), ...time];
  return pick(rnd, pool);
}

export const ALL_BARKS = [...GENERAL, ...MORNING, ...NOON, ...EVENING, ...NIGHT, ...FRIENDS, ...FAMILY, ...STRANGER];
