// "Ori, Can You...?" — the DATA of the game around the favours (no logic): the week, the money, the garage upgrades, the cargo, the passengers, the
// things that get lost, the guests of the party. Everything the player READS in Ori's own voice lives in texts.js; what other people say lives here.
// Keep everyone affectionate: a roast with love.

/** The week: five days, then Friday night. Each day is a little harder (more favours, less slack) and the cast is a little crazier. */
export const WEEK = {
  days: 5,
  names: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
  /** Per day: how many favours arrive (x), how much time each leaves (x), the earliest epic tasks, the theme of the day. */
  ramp: [
    { rate: 0.8, slack: 1.18, epic: false, theme: 'A gentle start' },
    { rate: 0.95, slack: 1.1, epic: false, theme: 'The neighbourhood wakes up' },
    { rate: 1.1, slack: 1.0, epic: true, theme: 'Dov challenges you' },
    { rate: 1.25, slack: 0.94, epic: true, theme: 'The Inspector inspects' },
    { rate: 1.4, slack: 0.9, epic: true, theme: 'The day before the party' },
  ],
};

/** Money ("peaches") and what a favour pays. */
export const ECON = {
  start: 40,
  base: { trivial: 14, absurd: 28, epic: 50 },
  /** pay = base x boost x (0.7 + 0.6 quality) x (1 + 0.3 earliness) x relationship (+-10%) ; rounded */
  qualityLow: 0.7,
  qualitySpan: 0.6,
  earlyBonus: 0.3,
  golden: 25, // a golden peach found in the street
  hailTip: 22,
  raceWin: 120,
  raceTry: 35,
  gauntlet: 150,
};

/**
 * Uzi's Garage. `perk` says what each level adds (see economy.js perksFor). Prices are chosen so that a good week buys most but not all.
 */
export const UPGRADES = [
  { id: 'engine', name: 'Engine tune', icon: 'engine', blurb: 'More top speed and more shove off the line.', levels: [{ cost: 90, desc: 'Top speed +9%, pickup +12%' }, { cost: 170, desc: 'Top speed +18%, pickup +24%' }, { cost: 300, desc: 'Top speed +27%, pickup +36%' }] },
  { id: 'tyres', name: 'Grip tyres', icon: 'tyre', blurb: 'Sticks to the road, even when it is wet.', levels: [{ cost: 70, desc: 'More grip, rain bites half as much' }, { cost: 150, desc: 'Even more grip, rain hardly matters' }] },
  { id: 'tank', name: 'Afterburner tank', icon: 'flame', blurb: 'Hold Shift in the car for a bigger burst of flame.', levels: [{ cost: 60, desc: 'Afterburner lasts 4 s' }, { cost: 130, desc: 'Afterburner lasts 6 s' }, { cost: 220, desc: 'Afterburner lasts 8 s' }] },
  { id: 'sneakers', name: 'Springy sneakers', icon: 'shoe', blurb: 'For the favours you do on your own two feet.', levels: [{ cost: 60, desc: 'Sprint tires 20% slower, 6% quicker' }, { cost: 140, desc: 'Sprint tires 40% slower, 12% quicker' }] },
  { id: 'box', name: 'Padded cargo box', icon: 'box', blurb: 'Soft walls for casseroles and ice cream.', levels: [{ cost: 100, desc: 'Bumps and sprinting hurt cargo 35% less' }] },
  { id: 'phone2', name: 'A second phone', icon: 'phone', blurb: 'One more helper from the mentors.', levels: [{ cost: 120, desc: '+1 mentor token' }] },
];

/** What Ori carries. `fragile`: damage multiplier from bumps / sprinting / hard turns. `melt`: seconds until it is gone (0 = it keeps). */
export const CARGO = {
  casserole: { name: 'the casserole', fragile: 1.0, melt: 0, pickup: 'Mum hands over the casserole. It is warm. It is emotional.', drop: 'Auntie takes it with both hands.' },
  icecream: { name: 'the ice cream', fragile: 0.5, melt: 170, pickup: 'The ice cream is in. The clock is ticking!', drop: 'Still cold. Roee is moved.' },
  sunscreen: { name: 'the sunscreen', fragile: 0.35, melt: 0, pickup: 'SPF 50. Not 30.', drop: 'Auntie reads the label. Twice.' },
  printout: { name: 'the printout', fragile: 0.3, melt: 0, pickup: 'One sheet of actual paper.', drop: 'Tamar holds it up to the light.' },
  drill: { name: 'the drill', fragile: 0.4, melt: 0, pickup: 'The borrowed drill, since 2021.', drop: 'Uzi: "I had stopped asking."' },
  stickers: { name: 'the stickers', fragile: 0.3, melt: 0, pickup: 'Maya counts them. Itay is not looking.', drop: 'Counted. Almost all there.' },
  salads: { name: 'the salads', fragile: 0.8, melt: 0, pickup: 'Fourteen salads, fourteen dressings.', drop: 'Fourteen cheers.' },
};

/** The people who need a ride. mood: rushed (the tip melts with time), nervous (hates bumps and speed), sightseer (wants to see something on the way), chatty (likes a relaxed pace). */
export const PASSENGERS = {
  rushed: [
    { name: 'A man with a suitcase', say: 'The train leaves in ten minutes! Ten! Go go go!' },
    { name: 'A bride (nearly late)', say: 'Everyone is waiting. Drive like you mean it!' },
  ],
  nervous: [
    { name: 'A nervous grandma', say: 'Slowly, dear. I bruise like a peach.' },
    { name: 'A man holding a cake', say: 'It is a three-layer cake. Please. Gently.' },
  ],
  sightseer: [
    { name: 'A tourist with a map', say: 'Show me the real city! The park, then the cafe, then wherever!' },
    { name: 'A photographer', say: 'The light is perfect. Pass the park first, please?' },
  ],
  chatty: [
    { name: 'A very chatty neighbour', say: 'So! Do you drive at this speed ALL the time? I have thoughts.' },
    { name: 'A retired teacher', say: 'Not too fast, not too slow. A conversation speed.' },
  ],
};

/** Things that get lost and the zone to search. `clue` is what the person tells Ori. */
export const FIND_KINDS = {
  cat: { name: 'Pishi the cat', zone: 'park', clue: 'She likes the shade near the fountain... or the trees... or wherever you are not looking.', found: 'Pishi! She was napping on a bench.' },
  itay: { name: 'Itay', zone: 'park', clue: 'He said he is behind something big and green.', found: 'Found you, Itay! Best hiding spot ever.' },
  homework: { name: "Yuval's homework", zone: 'promenade', clue: 'It blew away on the promenade. It is sort of... flapping.', found: 'The homework! A little sandy, entirely there.' },
};

/** The parrot. */
export const CHASE_KINDS = {
  parrot: { name: 'the parrot', speed: 4.6, burst: 1.55, zone: 'park', caught: 'Got him! He says your name. Twice.' },
  hat: { name: "the tourist's hat", speed: 4.0, burst: 1.5, zone: 'promenade', caught: 'The hat! The wind never stood a chance.' },
};

/** Lists: items and the shops that sell them. The first shop of an item may be sold out (a detour). */
export const LISTS = {
  milk: { to: null, items: [{ name: 'Milk', shops: ['kiosk', 'cafe'] }, { name: 'Eggs', shops: ['kiosk', 'workshop'] }, { name: 'A cake (for tomorrow)', shops: ['cafe', 'kiosk'] }] },
  party: { to: null, items: [{ name: 'Balloons', shops: ['kiosk', 'workshop'] }, { name: 'Lemonade', shops: ['cafe', 'kiosk'] }, { name: 'String lights', shops: ['workshop', 'kiosk'] }, { name: 'A big cake', shops: ['cafe'] }] },
  gift: { to: null, items: [{ name: 'A plant', shops: ['park', 'kiosk'] }, { name: 'A card', shops: ['kiosk'] }] },
  pizza: { to: null, items: [{ name: 'Margherita x13', shops: ['cafe', 'kiosk'] }, { name: 'Vegan x2', shops: ['cafe'] }, { name: 'Crust-only x1', shops: ['kiosk', 'cafe'] }] },
};

/** The courier race: the loop of crossings (world x, z), and how fast Dov rides on each day (m/s). Every pair differs in only one coordinate: he stays on the roads. */
export const RACE = {
  loop: [[-15, 5], [-95, 5], [-95, -75], [-15, -75], [65, -75], [65, 85], [-15, 85], [-95, 85], [-95, 5], [-15, 5]],
  rival: [15.5, 16.5, 18.5, 19.5, 21],
  radius: 9,
  countdown: 3,
};

/** The Inspector's inspection: four little trials in a row. */
export const GAUNTLET = {
  inspection: [{ verb: 'queue', tone: 'trivial' }, { verb: 'handle', tone: 'absurd' }, { verb: 'chat', tone: 'absurd', params: { likes: 'polite', prompts: ['Good morning. Your papers?', 'And the stamp?', 'And your opinion of the city?'] } }, { verb: 'assemble', tone: 'epic' }],
};

/** Who comes to Sababa Night (Friday): each relationship sends its people when the hearts are high enough. */
export const GUESTS = [
  { id: 'ima', name: 'Mum', rel: 'family', min: 40, line: 'Mum brought the casserole (she always does).' },
  { id: 'auntie', name: 'Auntie', rel: 'family', min: 55, line: 'Auntie brought lemons. They are almost ready.' },
  { id: 'noam', name: 'Noam', rel: 'work', min: 50, line: 'Noam brought a cake and a new slide deck.' },
  { id: 'gili', name: 'Gili', rel: 'work', min: 62, line: 'Gili says it is perfect. Maybe the logo could be bigger.' },
  { id: 'inspector', name: 'The Inspector', rel: 'city', min: 48, line: 'The Inspector approves the party (stamp included).' },
  { id: 'maya', name: 'Maya and the mentees', rel: 'perach', min: 50, line: 'Maya and the kids made a banner. It has glitter.' },
  { id: 'moti', name: 'Moti', rel: 'friends', min: 45, line: 'Moti brought the wardrobe (do not ask).' },
  { id: 'roee', name: 'Roee', rel: 'friends', min: 58, line: 'Roee brought ice cream and a sandwich, in that order.' },
  { id: 'parrot', name: 'The Parrot Guy (and the parrot)', rel: 'strangers', min: 52, line: 'The parrot says your name. Everyone cheers.' },
  { id: 'coach', name: 'Coach and the court crew', rel: 'hobbies', min: 52, line: 'Coach brought a ball (a new one).' },
];

/** The closing line by party size (how many guests came out of ten). */
export const PARTY_LINES = [
  [0, 'A tiny party - and still the nicest one: everyone who came felt like family.'],
  [4, 'A cosy party! The small ones are the best ones.'],
  [7, 'A great party! The whole street is dancing.'],
  [10, 'FULL HOUSE! The whole neighbourhood is here, and they are all singing your name.'],
];

/** The golden peaches hidden in the neighbourhood: world x, z, and a hint. */
export const GOLDEN = [
  [-132, -120, 'on the sand, far north'], [-132, 60, 'by the umbrellas'], [-108, 140, 'the end of the promenade'], [-60, -128, 'behind the park trees'],
  [-55, -100, 'in the park, near the fountain'], [-28, -128, 'a quiet corner of the north street'], [30, -78, 'on the north street'], [65, -120, 'up the east avenue'],
  [100, -110, 'by the court'], [128, -20, 'the east edge'], [65, 120, 'down the east avenue'], [-60, 128, 'the south-west corner'],
];

/** Little settings for the verbs of single favours: the shelf to search (shop) and how the person likes to be spoken to (chat). */
export const VERB_PARAMS = {
  'mum-bread': { aisle: 'bread' }, 'mum-flowers': { aisle: 'flowers' }, 's-gift': { aisle: 'gift' }, 'h-ball': { aisle: 'ball' }, 'b-oat': { aisle: 'coffee' }, 'h-coffee': { aisle: 'coffee' }, 'a-salads': { aisle: 'salads' },
  'n-snack': { aisle: 'bread' },
  'mum-phone': { likes: 'warm' }, 'auntie-wedding': { likes: 'excited' }, 'auntie-verdict': { likes: 'polite' }, 'b-demo': { likes: 'confident' }, 'b-standup': { likes: 'confident' }, 'p-speech': { likes: 'excited' },
  'p-sixty-two': { likes: 'excited' }, 's-roee': { likes: 'warm' }, 's-hi': { likes: 'polite' }, 's-hummus': { likes: 'excited' }, 's-photo': { likes: 'excited' }, 'city-word': { likes: 'polite' }, 'city-survey': { likes: 'polite' },
  'n-chat': { likes: 'excited' }, 'n-moon': { likes: 'warm' }, 'a-sync': { likes: 'confident' }, 'h-sunset': { likes: 'warm' },
};
/** How each family likes to be spoken to by default. */
export const LIKES = { family: 'warm', work: 'confident', perach: 'excited', city: 'polite', friends: 'warm', strangers: 'excited', hobbies: 'confident' };
