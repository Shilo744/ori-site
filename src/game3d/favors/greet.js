// "Ori, Can You...?" — saying hello (PURE data + tiny rules). No conversation: Ori waves, says a word, the other answers in a speech bubble with something that
// sounds like them, and the neighbourhood's love goes up a little. Everything is warm; people are people (a little funny, never mean).

export const HELLOS = ['Hi!', 'Hey there!', 'Shalom!', 'Yalla, hi!', 'Hello!', 'Good to see you!', 'Sababa?', 'Hey hey!'];
/** What they say when Ori has just said hello to them a moment ago. */
export const AGAIN = ['Hello again!', 'We just spoke! (I do not mind)', 'Still here!', 'Ha! Hi again.', 'You are in a good mood!'];

/** One line (or two) for each person of the cast. */
export const BY_CAST = {
  ima: ['Motek! Did you eat?', 'My boy! Wear a jacket!', 'Call me tonight, okay?', 'You look thin. Eat!'],
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

/** The part of the day: it picks the line the people Ori meets most say (the general ones below are for the rest). */
export const bandOf = (hour) => (hour < 10 ? 'morning' : hour < 15 ? 'noon' : hour < 20 ? 'evening' : 'night');

/** One line per part of the day for the people Ori meets most. */
export const BY_TIME = {
  ima: { morning: 'Motek, I made breakfast! Come!', noon: 'Did you eat lunch? Tell me the truth.', evening: 'Dinner is ready. It was ready an hour ago.', night: 'Why are you still up? Sleep, my love.' },
  auntie: { morning: 'Coffee? Cake? Both?', noon: 'Come, I have soup. I always have soup.', evening: 'Sit, sit. I will pour you something sweet.', night: 'So late! Take a piece of cake for the road.' },
  moti: { morning: 'Ori! The drill is quiet today. Suspicious.', noon: 'Hot, no? My fan makes a noise. Look?', evening: 'Sunset! My roof has the best view.', night: 'Late... I heard a noise. Probably the cat.' },
  roee: { morning: 'Bro, coffee. Now. Please.', noon: 'Lunch? I know a place. I always know a place.', evening: 'Let us do something tonight. Anything!', night: 'Still up? Same. Tell me everything.' },
  albert: { morning: 'Fresh milk, fresh gossip!', noon: 'Gum? On the house, always.', evening: 'Closing soon. Take a snack, it is on me.', night: 'Open late, just for you, Ori.' },
  shilo: { morning: 'Morning! Did the build pass?', noon: 'Lunch break. Do not tell the sprint.', evening: 'Still compiling... and still smiling.', night: 'A late deploy? Bold. I like it.' },
  coach: { morning: 'Early training! I like the spirit!', noon: 'Eat well, hit well, kid.', evening: 'The ring lights look good at this hour.', night: 'Rest up, champ. Tomorrow we fight.' },
  dov: { morning: 'Race you to the corner? Go!', noon: 'Fastest delivery of the day, right here.', evening: 'Golden hour: the best time to sprint.', night: 'Night rides are the best rides.' },
  maya: { morning: 'Good morning, Ori! The kids ask about you!', noon: 'Lunch with the kids? They would love it.', evening: 'Long day, and your smile still helps.', night: 'Go rest, Ori. You did so much.' },
};

/** What they say when they like him a lot (their circle's hearts are high, or the whole neighbourhood loves him): a little extra warmth. */
export const FOND = {
  ima: ['The whole street talks about you. I pretend not to know why.', 'My son the hero. Sit, eat.'],
  auntie: ['You are my favourite. Do not tell the cousins.', 'The cake is for you. Only you.'],
  cousin: ['You are the coolest! The coolest!', 'When I grow up I want your curls!'],
  bossA: ['Honestly? You make the team better.', 'Take the afternoon. You earned it.'],
  bossB: ['Between us: the launch is for you.', 'You are the secret feature!'],
  bossC: ['Best invoice I ever got was from you.', 'I recommend you to everybody!'],
  clerk: ['For you I will find a form with no stamp.', 'Ori! A smile at my window. Thank you.'],
  inspector: ['Entirely in order. Delightfully so.', 'I wrote the word excellent on your file.'],
  maya: ['You changed things here, you know.', 'The kids drew you. You have a cape.'],
  yuval: ['I got a 90! Because of you!', 'You are the best mentor ever!'],
  noga: ['Nature is fun when you are there!', 'Can you come every week? Please?'],
  itay: ['You found me! I wanted you to.', 'I hide better when you are near.'],
  moti: ['Best neighbour on the street. Do not tell the others.', 'My door is always open for you.'],
  roee: ['Brother. For real. Thank you.', 'Everything is better with you around.'],
  albert: ['For you, the good gum. Hidden shelf.', 'Ori! My favourite customer!'],
  parrot: ['Ori! Ori! Ori! (he means it)', 'Best human! Best human!'],
  tourist: ['Everyone here is so kind. You most of all.', 'I will tell my whole family about you!'],
  coach: ['You fight with heart, kid. Proud of you.', 'The ring is better with you in it.'],
  uzi: ['Anything for you. The garage is yours.', 'Your car is my favourite, you know.'],
  dov: ['Fair race, friend. Always.', 'You make me faster. Unfair, but true.'],
  shilo: ['This game has a great hero. Just saying.', 'You are the best thing in this repo.'],
};

const MORNING = ['Good morning, Ori!', 'Early bird!', 'Morning! Coffee?'];
const NOON = ['Ori! Have you eaten?', 'Hot today, no?', 'Lunchtime vibes!'];
const EVENING = ['Beautiful evening, no?', 'Evening, Ori! Look at that sky.', 'Golden hour!'];
const NIGHT = ['Late night hero!', 'Go home soon! Or not.', 'Night owl!'];
const ANY = ['Hi, Ori!', 'Shalom!', 'Nice day, huh?', 'Great curls today!', 'Ori! Always a smile.', 'Hello there!'];

const pick = (list, seed) => list[Math.abs(seed | 0) % list.length];

/** What the other person says back. `id` = a cast id ('moti') or 'stranger:7'; `first` = it is the first hello for a while; `rel` = their circle's hearts (0..100), `love` = the whole neighbourhood's (0..100). */
export function replyFor(id, { hour = 12, seed = 1, first = true, rel = 60, love = 0 } = {}) {
  if (!first) return pick(AGAIN, seed);
  const list = BY_CAST[id];
  if (list) {
    const dice = (k) => ((((Math.abs(seed | 0) + k) * 2654435761) >>> 0) % 1000) / 1000; // (a cheap, steady dice for this seed; each choice has its own)
    if ((rel >= 72 || love >= 50) && FOND[id] && dice(11) < 0.3) return pick(FOND[id], Math.abs(seed | 0) >> 2);
    const timed = BY_TIME[id] && BY_TIME[id][bandOf(hour)];
    if (timed && dice(97) < 0.4) return timed;
    return pick(list, seed);
  }
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
