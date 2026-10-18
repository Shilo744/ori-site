// "Compliment" — Ori can compliment anyone (PURE). The line is built from what the person really looks like (their spec) or from who they are,
// so it is always specific, and they always react warmly. Returns the exchange: what Ori says, how they answer, how it lands.
//   { topic, ori, reply, emo, hearts, hint }   hearts = relationship gain (1-3), hint = sometimes a little tip (a quest lead), else null
import { mulberry32 } from '../../rng.js';

const pick = (rnd, a) => a[Math.floor(rnd() * a.length) % a.length];

/** What can be admired: each topic knows if it applies (`when(spec, id)`), what Ori says and how they answer. */
const TOPICS = [
  { key: 'hair-curly', when: (s) => s.hair && s.hair.style === 'curly', ori: ['Your curls are unreal. Do they have a secret?', 'Those curls deserve their own postcode.'], reply: ['Water, patience and a lot of conditioner. Thank you!', 'Ha! A fellow curl person. We are a club, you know.'] },
  { key: 'hair', when: (s) => s.hair && s.hair.style !== 'bald' && s.hair.style !== 'curly', ori: ['Your hair looks great today.', 'That hairstyle suits you so well.'], reply: ['Really? I almost changed it this morning. Now I will not.', 'You are sweet. New haircut, you noticed!'] },
  { key: 'bald', when: (s) => s.hair && s.hair.style === 'bald', ori: ['Honestly, that is a great look. So confident.'], reply: ['Confident is the only choice! Thank you, my friend.'] },
  { key: 'glasses', when: (s) => !!s.glasses, ori: ['Your glasses are great. They suit your face perfectly.', 'Those frames are a real find.'], reply: ['I spent an hour choosing them. Finally, somebody noticed!', 'My sister helped me pick. I will tell her.'] },
  { key: 'colour', when: (s) => s.outfit && s.outfit.topColor, ori: ['That colour looks fantastic on you.', 'You wear that shirt so well.'], reply: ['You think? It is my lucky shirt.', 'Thank you, it made me smile when I put it on.'] },
  { key: 'moustache', when: (s) => s.facialHair && (s.facialHair.moustache || s.facialHair.goatee), ori: ['Excellent facial hair. Very well kept.'], reply: ['Twenty minutes every morning. Worth it. Thank you!'] },
  { key: 'earring', when: (s) => !!s.hoop, ori: ['I love that earring.'], reply: ['Thank you! A gift from a friend. It brings me luck.'] },
  { key: 'chain', when: (s) => !!s.chain, ori: ['Nice chain. It really suits you.'], reply: ['Thanks! Had it for years. It gets compliments, now and then.'] },
  { key: 'kid', when: (s) => s.age === 'kid', ori: ['You are so cool. Great style!', 'High five. You are awesome.'], reply: ['I KNOW! Thank you!', 'Hehe. You are cool too. Nice hair.'] },
  { key: 'elder', when: (s) => s.age === 'elder', ori: ['You have the kindest smile on this street.', 'Whatever you are doing, it works. You look wonderful.'], reply: ['Oh, stop. ...Do not stop. Say it again.', 'Sixty years of practice, my dear. Thank you.'] },
  { key: 'smile', when: () => true, ori: ['You have a great smile. It made my morning.', 'You seem like someone who makes every room better.'], reply: ['Well! That is the nicest thing I have heard all week.', 'You are very kind. You made me smile again, look.'] },
];

/** Who they are, by id (the cast): a compliment that fits their life, and sometimes a tip. */
const PERSONAL = {
  ima: { topic: 'cooking', ori: ['Mum, nobody makes soup like you. Nobody.'], reply: ['Of course not! It is the secret ingredient. Love. And a little chicken fat.'], hearts: 3 },
  auntie: { topic: 'garden', ori: ['Your lemon tree is the pride of the street.'], reply: ['Thirty years I watered her. She says thank you.'], hearts: 3, hint: "Auntie: the wifi router is in the cupboard, next to the lemon jam." },
  clerk: { topic: 'work', ori: ['Shoshana, you run this place like a perfect clock.'], reply: ['Hm. It is nice when somebody sees it.'], hearts: 3, hint: 'Shoshana: the kiosk stamps form 18 before 15:00.' },
  moti: { topic: 'pet', ori: ['Moti, your plants are thriving. Even the one on the stairs.'], reply: ['That one is called Gandalf. Do not tell the others.'], hearts: 2 },
  roee: { topic: 'friend', ori: ['Roee, you make hard days easy. Thanks for being around.'], reply: ['Stop, you will make me cry into the espresso.'], hearts: 3 },
  albert: { topic: 'kiosk', ori: ['Your kiosk has everything. And a really good atmosphere.'], reply: ['Every day I say: milk, gum, gossip. Today, you get the gossip free.'], hearts: 2, hint: 'Albert says the City Hall stamp lady has a soft spot for kind visitors.' },
  maya: { topic: 'work', ori: ['Maya, the mentors are lucky to have you.'], reply: ['You are all lucky to have each other. And I take the credit.'], hearts: 3 },
  tourist: { topic: 'visit', ori: ['Your sense of adventure is amazing. Great trip choice.'], reply: ['Thank you! Best decision of my year. This city is friendly.'], hearts: 2 },
};

/**
 * @param {object} spec the person's spec (specs.js; plain data)
 * @param {string} [id] their cast id, if any
 * @param {number} [seed] picks between variants
 */
export function complimentFor(spec, id = '', seed = 1) {
  const rnd = mulberry32((seed >>> 0) || 1);
  const personal = PERSONAL[id];
  if (personal && rnd() < 0.7) {
    return { topic: personal.topic, ori: pick(rnd, personal.ori), reply: pick(rnd, personal.reply), emo: 'love', hearts: personal.hearts, hint: personal.hint || null };
  }
  const fits = TOPICS.filter((t) => t.key !== 'smile' && t.when(spec || {}));
  const t = fits.length ? pick(rnd, fits) : TOPICS[TOPICS.length - 1];
  return {
    topic: t.key, ori: pick(rnd, t.ori), reply: pick(rnd, t.reply),
    emo: rnd() < 0.5 ? 'proud' : rnd() < 0.5 ? 'love' : 'smile',
    hearts: 1 + Math.floor(rnd() * 2),
    hint: rnd() < 0.18 ? 'A neighbour says: Cafe Sababa makes a free espresso for anyone who helps with a chair.' : null,
  };
}

/** Every line the generator can say (tests lint them for positivity). */
export const ALL_COMPLIMENT_LINES = [
  ...TOPICS.flatMap((t) => [...t.ori, ...t.reply]),
  ...Object.values(PERSONAL).flatMap((p) => [...p.ori, ...p.reply, ...(p.hint ? [p.hint] : [])]),
];
export const ORI_COMPLIMENT_LINES = [...TOPICS.flatMap((t) => t.ori), ...Object.values(PERSONAL).flatMap((p) => p.ori)];
