// "Ori, Can You...?" — saying hello (PURE data + tiny rules). No conversation: Ori waves, says a word, the other answers in a speech bubble with something that
// sounds like them, and the neighbourhood's love goes up a little. Everything is warm; people are people (a little funny, never mean).

export const HELLOS = ['Hi!', 'Hey there!', 'Shalom!', 'Yalla, hi!', 'Hello!', 'Good to see you!', 'Sababa?', 'Hey hey!'];
/** What they say when Ori has just said hello to them a moment ago. */
export const AGAIN = ['Hello again!', 'We just spoke! (I do not mind)', 'Still here!', 'Ha! Hi again.', 'You are in a good mood!'];

/** One line (or two) for each person of the cast. */
export const BY_CAST = {
  ima: ['Habibi! Did you eat?', 'My boy! Wear a jacket!', 'Call me tonight, okay?', 'You look thin. Eat!'],
  auntie: ['Ori, sweetheart! Lemons?', 'Come, sit! I made cake.', 'So handsome! So thin!'],
  cousin: ['Ori! Watch what I can do!', 'Can I hold your phone?'],
  bossA: ['Hey Ori! Quick sync?', 'Is the logo bigger yet?'],
  bossB: ['Ori! We launch in an hour. Maybe!', 'Say "AI" for me!'],
  bossC: ['Did you send the invoice?', 'Ori! Perfect timing.'],
  clerk: ['Take a number, please.', 'Form 17? Or 18?'],
  inspector: ['Hmm. Carry on. Kindly.', 'I am watching. Warmly.'],
  maya: ['Ori! The kids missed you!', 'Have a minute? Say yes!'],
  yuval: ['Ori! I got a 62!', 'The dog ate my homework again.'],
  noga: ['Ori, nature is boring!', 'Is it the 5 or the 6?'],
  itay: ['Shh! I am hiding!', 'You did not see me.'],
  moti: ['Ori! Got a screw?', 'Hi hi hi! Got forty minutes?'],
  roee: ['Bro! Coffee?', 'Ori! My day... where do I start?'],
  albert: ['Gum? On the house.', 'Milk, gum, gossip. Pick two.'],
  parrot: ['He says hi too!', 'Pretty boy! (the parrot)'],
  tourist: ['Hi! Where is the good hummus?', 'Hello! What a city!'],
  coach: ['Ready for a round, kid?', 'The ring is waiting for you!'],
  uzi: ['The garage is open, Ori!', 'Bring the drill back!'],
  dov: ['Race you later!', 'Try to keep up, Ori!'],
  shilo: ['Hey! Did you push to main?', 'Compiling... hello, world!', 'You found me. Nice.', 'Coffee first. Bugs after.'],
};

const MORNING = ['Good morning, Ori!', 'Early bird!', 'Morning! Coffee?'];
const NOON = ['Ori! Have you eaten?', 'Hot today, no?', 'Lunchtime vibes!'];
const EVENING = ['Beautiful evening, no?', 'Evening, Ori! Look at that sky.', 'Golden hour!'];
const NIGHT = ['Late night hero!', 'Go home soon! Or not.', 'Night owl!'];
const ANY = ['Hi, Ori!', 'Shalom!', 'Nice day, huh?', 'Great curls today!', 'Ori! Always a smile.', 'Hello there!'];

const pick = (list, seed) => list[Math.abs(seed | 0) % list.length];

/** What the other person says back. `id` = a cast id ('moti') or 'stranger:7'; `first` = it is the first hello for a while. */
export function replyFor(id, { hour = 12, seed = 1, first = true } = {}) {
  if (!first) return pick(AGAIN, seed);
  const list = BY_CAST[id];
  if (list) return pick(list, seed);
  const timed = hour < 10 ? MORNING : hour < 15 ? NOON : hour < 20 ? EVENING : NIGHT;
  return pick([...ANY, ...timed], seed);
}
export const helloFor = (seed = 1) => pick(HELLOS, seed);

/** How much love a hello gives: named neighbours more than passers-by; nothing for a repeat. */
export function loveFor(id, first) {
  if (!first) return 0;
  return id.startsWith('stranger') ? 0.8 : 2;
}
export const HELLO_COOLDOWN = 40; // seconds before the same person counts again
