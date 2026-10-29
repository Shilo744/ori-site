// "Ori, Can You...?" — who fights in the ring (data only). The ladder: five neighbours, each with a way of fighting you have to learn, and then somebody
// nobody knew about. `ai` is how he moves and thinks: react (seconds he needs to see a punch), block / dodge (how often he reads yours), range, patterns (the
// punches he throws in a row), rest (seconds he pauses between flurries), punish (how often he hits you when you are open), feint (how often he fakes a punch
// and throws it a beat later: a dash at the first wind-up is wasted), blink (he teleports), lag.
// Everything said by people here is warm and a little funny: it is a friendly gym.

export const LADDER = [
  {
    id: 'moti', cast: 'moti', name: 'Moti', title: 'The Neighbour', hp: 230, dmg: 0.9, speed: 0.78, atk: 0.8, st: 90,
    ai: { tell: 1.9, react: 0.6, block: 0.06, dodge: 0.04, range: 1.5, patterns: [['jab'], ['jab'], ['cross'], ['jab', 'cross']], rest: [0.9, 1.7], punish: 0.25 },
    reward: { xp: 48, peaches: 30, love: 3 }, need: { love: 0 },
    pre: ['Gentle, okay? I have a bad back.', 'I will go easy on you! Mostly.'], win: 'Oh! You are quick! Good for you, Ori.', lose: 'Ha! That is what forty minutes of chatting does to a man.',
  },
  {
    id: 'albert', cast: 'albert', name: 'Albert', title: 'Kiosk 24/7', hp: 330, dmg: 1.25, speed: 0.72, atk: 0.78, st: 110,
    ai: { tell: 1.6, react: 0.5, block: 0.12, dodge: 0.03, range: 1.55, patterns: [['cross'], ['cross'], ['hook'], ['jab', 'cross']], rest: [1.0, 1.8], punish: 0.35 },
    reward: { xp: 70, peaches: 45, love: 3 }, need: { love: 0 },
    pre: ['Slow and heavy, my friend. Slow and heavy.', 'Every bag I carry is a rep.'], win: 'Respect! Gum is on the house.', lose: 'That is for the milk you never bought!',
  },
  {
    id: 'inspector', cast: 'inspector', name: 'The Inspector', title: 'By the Book', hp: 390, dmg: 1.1, speed: 0.92, atk: 1.0, st: 120,
    ai: { tell: 1.35, react: 0.3, block: 0.5, dodge: 0.08, range: 1.45, patterns: [['jab', 'jab'], ['jab', 'cross'], ['cross']], rest: [0.7, 1.3], punish: 0.7 },
    reward: { xp: 95, peaches: 60, love: 4 }, need: { love: 8 },
    pre: ['Please keep your punches within regulation.', 'This is a routine inspection. Of your face.'], win: 'Everything is in order. Barely. Stamped.', lose: 'A warning. Only a warning.',
  },
  {
    id: 'dov', cast: 'dov', name: 'Dov', title: 'The Courier', hp: 360, dmg: 1.0, speed: 1.55, atk: 1.3, st: 120,
    ai: { tell: 1.2, react: 0.26, block: 0.12, dodge: 0.32, feint: 0.22, range: 1.45, patterns: [['jab', 'jab', 'jab'], ['jab', 'cross'], ['jab', 'jab', 'cross'], ['cross']], rest: [0.5, 1.0], punish: 0.5 },
    reward: { xp: 125, peaches: 80, love: 4 }, need: { love: 16 },
    pre: ['Try to keep up!', 'I deliver faster than you can dodge!'], win: 'Whoa. I did not see that coming. Literally.', lose: 'Special delivery: a knockout!',
  },
  {
    id: 'coach', cast: 'coach', name: 'Coach', title: 'The Champion', hp: 560, dmg: 1.25, speed: 1.05, atk: 1.12, st: 140,
    ai: { tell: 1.1, react: 0.22, block: 0.34, dodge: 0.22, feint: 0.28, range: 1.5, patterns: [['jab', 'jab', 'cross'], ['jab', 'cross', 'hook'], ['cross', 'hook'], ['jab', 'jab', 'jab', 'upper'], ['hook']], rest: [0.5, 1.0], punish: 0.75 },
    reward: { xp: 190, peaches: 120, love: 6 }, need: { love: 30 },
    pre: ['The whole neighbourhood is watching, kid.', 'Show me everything you learned.'], win: 'That is MY student!', lose: 'Back to the bag. You will get there.',
  },
];

/** The one nobody knows exists. He only shows up after the champion falls. */
export const BOSS = {
  id: 'shilo', cast: 'shilo', name: 'Shilo', title: 'The Developer', hidden: true, hp: 460, dmg: 1.2, speed: 2.7, atk: 2.1, st: 150,
  ai: { react: 0.12, block: 0.12, dodge: 0.5, blink: true, lag: 1.0, tell: 1, feint: 0.3, range: 1.35, patterns: [['jab', 'jab', 'jab', 'cross', 'hook'], ['jab', 'cross', 'jab', 'cross'], ['jab', 'jab', 'upper'], ['cross', 'hook', 'cross']], rest: [0.35, 0.8], punish: 0.9 },
  reward: { xp: 420, peaches: 400, love: 12 }, need: { champion: true },
  pre: ['You found me. I wrote this place.', 'No one gets this far. Let me see if the code holds.'],
  win: 'Compile error: you are too good. Respect.', lose: 'git push --force. Try again!',
};

export const FIGHTERS = [...LADDER, BOSS];
export const fighter = (id) => FIGHTERS.find((f) => f.id === id) || null;

/** Is this fighter open to Ori right now? `prog` = the boxer record ({ beaten: [ids] }) and `love` the neighbourhood's love (0..100). Returns { open, why }. */
export function availability(f, prog, love) {
  const beaten = prog.beaten || [];
  if (f.hidden) return beaten.includes('coach') ? { open: true, why: '' } : { open: false, why: 'hidden' };
  const i = LADDER.indexOf(f);
  if (i > 0 && !beaten.includes(LADDER[i - 1].id)) return { open: false, why: `Beat ${LADDER[i - 1].name} first` };
  if (love < (f.need.love || 0)) return { open: false, why: `Needs ${f.need.love} love` };
  return { open: true, why: '' };
}

/** The next fighter Ori can take: the first open one he has not beaten (the boss once the champion has fallen). */
export function nextFight(prog, love) {
  const beaten = prog.beaten || [];
  for (const f of FIGHTERS) if (!beaten.includes(f.id) && availability(f, prog, love).open) return f;
  return null;
}
