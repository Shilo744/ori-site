// "Ori, Can You...?" — ALL the personal facts, the cast and the place names live here, as plain data (no logic), so they can be edited
// without touching code. Everything that still needs the real fact from Ori is marked `// TODO(real fact)`. Keep the family generic
// ('Mum', 'Auntie') and affectionate: this is a roast with love, never a cruel one.

export const GAME = {
  id: 'favors',
  title: 'Ori, Can You...?',
  tagline: 'The man who does everything. Whatever it is, he said yes.',
};

/** The person. */
export const ORI = {
  name: 'Ori',
  fullName: 'Ori Asher',
  // how he looks (the face is the photo cutout in assets/ori-face.jpg; the rest is built in code from these values)
  look: {
    hair: 0x4a2f1d, // dark brown curls
    tee: 0x16171b, // black crew-neck
    jeans: 0x2c3140,
    shoes: 0xf3f3f1,
    skin: 0xc58f6c,
    chain: 0xd5dae0, // silver rope chain
    earring: 0xe6e9ee, // small silver hoop (his left ear)
    glasses: 0x101114, // black rectangular frames
  },
  // TODO(real fact): the real jobs, hobbies and Perach details — the user will send them; the labels below are placeholders
  jobs: ['Job A (the studio)', 'Job B (the startup)', 'Job C (the side gig)'],
  hobbies: ['Hobby A (the court)', 'Hobby B (the workshop)'],
};

/**
 * Every named place. `kind: 'building'` has a door (interior in T53), `'open'` is a spot in the open air.
 * `tone` picks the facade accent. `sign` is what the shop sign says (kept short: it is painted on a canvas).
 */
export const PLACES = {
  home: { name: "Ori's Place", sign: 'HOME', kind: 'building', tone: '#5b8def', blurb: 'The flat with the desk. Where it all starts.' },
  mum: { name: "Mum's Flat", sign: 'IMA', kind: 'building', tone: '#e07a8f', blurb: 'Third floor, no lift, plastic on the sofa.' },
  auntie: { name: "Auntie's House", sign: 'AUNTIE', kind: 'building', tone: '#e8a24a', blurb: 'Has a garden, a lemon tree and opinions.' },
  cityhall: { name: 'City Hall', sign: 'CITY HALL', kind: 'building', tone: '#8d939c', blurb: 'Take a number. Then take another.' },
  perach: { name: 'Beit Perach', sign: 'BEIT PERACH', kind: 'building', tone: '#43b581', blurb: 'The mentors, the mentees and the whiteboard.' }, // TODO(real fact): the real Perach details
  studio: { name: 'The Studio', sign: 'STUDIO', kind: 'building', tone: '#9b6bff', blurb: 'Job A. A tiny change, due at five.' }, // TODO(real fact)
  startup: { name: 'The Startup', sign: 'LAUNCH', kind: 'building', tone: '#2fb8d8', blurb: 'Job B. Always "one more quick thing".' }, // TODO(real fact)
  sidegig: { name: 'Side Gig Ltd.', sign: 'SIDE GIG', kind: 'building', tone: '#e5625e', blurb: 'Job C. Do not ask.' }, // TODO(real fact)
  cafe: { name: 'Cafe Sababa', sign: 'CAFE SABABA', kind: 'building', tone: '#c98a4b', blurb: 'Coffee is a sprint button.' },
  kiosk: { name: 'Kiosk 24/7', sign: 'KIOSK', kind: 'open', tone: '#f2c14e', blurb: 'Milk, gum, gossip.' },
  busstop: { name: 'Bus Stop 5', sign: 'BUS 5', kind: 'open', tone: '#4a90e2', blurb: 'It is coming. Probably.' },
  park: { name: 'Park & Beach', sign: 'PARK', kind: 'open', tone: '#4caf6a', blurb: 'Lawn, palms, the sea at the end of the street.' },
  court: { name: 'The Court', sign: 'COURT', kind: 'open', tone: '#e77f3c', blurb: 'Hobby A.' }, // TODO(real fact)
  workshop: { name: 'The Workshop', sign: 'WORKSHOP', kind: 'building', tone: '#7a8aa0', blurb: 'Hobby B.' }, // TODO(real fact)
};

/** Where the game day starts and ends (game hours) and how long it lasts in real minutes. */
export const DAY = { startHour: 6, endHour: 24, realMinutes: 14 };

/** The relationships that keep the day alive: each runs 0..100 and starts at 60. */
export const REL = { family: 'Family', work: 'Work', perach: 'Perach', city: 'City Hall', friends: 'Friends', hobbies: 'Hobbies', strangers: 'Strangers' };

/** The people who ask. `home` = where they usually are. Names of bosses / clerks are invented (fiction) until the real roles arrive. */
export const CAST = {
  ima: { name: 'Mum', rel: 'family', color: '#e07a8f', home: 'mum' },
  auntie: { name: 'Auntie', rel: 'family', color: '#e8a24a', home: 'auntie' },
  cousin: { name: 'Little Cousin', rel: 'family', color: '#f2a65a', home: 'mum' },
  bossA: { name: 'Gili', role: 'Boss at the studio', rel: 'work', color: '#9b6bff', home: 'studio' }, // TODO(real fact)
  bossB: { name: 'Noam', role: 'CEO of the startup', rel: 'work', color: '#2fb8d8', home: 'startup' }, // TODO(real fact)
  bossC: { name: 'Tamar', role: 'Side-gig client', rel: 'work', color: '#e5625e', home: 'sidegig' }, // TODO(real fact)
  clerk: { name: 'Shoshana', role: 'City Hall clerk', rel: 'city', color: '#8d939c', home: 'cityhall' },
  inspector: { name: 'The Inspector', role: 'Municipal inspector', rel: 'city', color: '#6c7480', home: 'cityhall' },
  maya: { name: 'Maya', role: 'Perach coordinator', rel: 'perach', color: '#43b581', home: 'perach' }, // TODO(real fact)
  yuval: { name: 'Yuval', role: 'Mentee', rel: 'perach', color: '#5cc8a0', home: 'perach' },
  noga: { name: 'Noga', role: 'Mentee', rel: 'perach', color: '#79d08f', home: 'perach' },
  itay: { name: 'Itay', role: 'Mentee', rel: 'perach', color: '#8fd9b5', home: 'perach' },
  moti: { name: 'Moti', role: 'The neighbour', rel: 'friends', color: '#c9a35b', home: 'home' },
  roee: { name: 'Roee', role: 'Best friend', rel: 'friends', color: '#4a90e2', home: 'cafe' },
  albert: { name: 'Albert', role: 'Kiosk owner', rel: 'strangers', color: '#f2c14e', home: 'kiosk' },
  parrot: { name: 'The Parrot Guy', role: 'A stranger with a parrot', rel: 'strangers', color: '#4caf6a', home: 'park' },
  tourist: { name: 'A Tourist', role: 'Visiting', rel: 'strangers', color: '#b07ad8', home: 'busstop' },
  coach: { name: 'Coach', role: 'The court', rel: 'hobbies', color: '#e77f3c', home: 'court' }, // TODO(real fact)
  uzi: { name: 'Uzi', role: 'The workshop', rel: 'hobbies', color: '#7a8aa0', home: 'workshop' }, // TODO(real fact)
  self: { name: 'Ori', role: 'Himself', rel: 'hobbies', color: '#ff9f43', home: 'home' },
};

/**
 * The task templates. Only what is unique is written here; quests.js fills the rest from the tone (trivial / absurd / epic):
 * priority, time allowed, reward and penalty. Optional fields: pri, mins (extra minutes to do it), win [hour, hour] (when it may
 * arrive), fake (it shouts URGENT but is trivial), delegable, then { id, delay } (a follow-up), calm (sitting down lowers the chaos),
 * coffee (it gives the coffee sprint). `doText` = what Ori does there ("E · Unmute the TV").
 */
export const TEMPLATES = [
  // ── Family ──
  { id: 'mum-remote', rel: 'family', giver: 'ima', at: 'mum', verb: 'fix', tone: 'trivial', fake: true, title: 'URGENT!!! Come NOW', body: 'The TV is broken!!! (The remote is on mute. It is always on mute.)', doText: 'Unmute the TV', win: [7, 21.5] },
  { id: 'mum-bread', rel: 'family', giver: 'ima', at: 'kiosk', verb: 'shop', tone: 'trivial', title: 'Bring bread', body: 'Not that bread. The OTHER bread. You know the one.', doText: 'Buy the other bread', win: [7, 19] },
  { id: 'mum-bulb', rel: 'family', giver: 'ima', at: 'mum', verb: 'fix', tone: 'trivial', title: 'One light bulb, that is all', body: 'Someone said they would do it. That was in 2019. I am not saying who.', doText: 'Change the bulb', win: [8, 20] },
  { id: 'mum-phone', rel: 'family', giver: 'ima', at: 'mum', verb: 'chat', tone: 'absurd', title: 'Teach me the phone (again)', body: 'How do I send a photo? And what is this "cloud" - is it raining on my pictures?', doText: 'Explain the cloud', win: [9, 20], delegable: false },
  { id: 'mum-casserole', rel: 'family', giver: 'ima', at: 'mum', verb: 'carry', tone: 'absurd', title: 'Deliver this to Auntie', body: 'It is a casserole. It is heavy. It is emotional. Do not tilt.', doText: 'Pick up the casserole', win: [9, 16], then: { id: 'auntie-verdict', delay: 25 } },
  { id: 'auntie-verdict', rel: 'family', giver: 'auntie', at: 'auntie', verb: 'chat', tone: 'absurd', title: 'Auntie has thoughts on the casserole', body: 'She tasted it. She has... a few thoughts. Come, sit, hear them.', doText: 'Hear the thoughts' },
  { id: 'auntie-lemons', rel: 'family', giver: 'auntie', at: 'auntie', verb: 'handle', tone: 'trivial', title: 'Pick the lemons', body: 'They are "almost ready". They have been almost ready since 2017. It is a matter of principle.', doText: 'Pick the lemons', win: [8, 18] },
  { id: 'auntie-wifi', rel: 'family', giver: 'auntie', at: 'auntie', verb: 'fix', tone: 'absurd', title: 'The internet is gone', body: 'Facebook disappeared! (The cable is just unplugged. It was the cat.)', doText: 'Plug the cable in', win: [9, 21] },
  { id: 'auntie-wedding', rel: 'family', giver: 'auntie', at: 'auntie', verb: 'chat', tone: 'epic', title: 'The wedding photos (all 400)', body: 'Only 400! I already deleted the blurry ones. Sit. Ask about the dress.', doText: 'Admire photo 212', win: [10, 19] },
  { id: 'cousin-bus', rel: 'family', giver: 'cousin', at: 'busstop', verb: 'escort', tone: 'trivial', title: 'Take the little cousin to the bus', body: 'He knows the way. He wants YOU to know that he knows the way.', doText: 'Walk him to the stop', win: [7, 18] },
  { id: 'mum-sofa', rel: 'family', giver: 'ima', at: 'mum', verb: 'assemble', tone: 'epic', title: 'Move the sofa (third floor, no lift)', body: 'Just a few centimetres. To the left. No, my left. Other left.', doText: 'Shove the sofa', win: [9, 18] },
  { id: 'mum-flowers', rel: 'family', giver: 'ima', at: 'kiosk', verb: 'shop', tone: 'trivial', title: 'Flowers for Shabbat', body: 'Any flowers. Not THOSE flowers. You know which.', doText: 'Pick flowers (not those)', win: [10, 17] },

  // ── Work: the studio, the startup, the side gig ──
  { id: 'a-tiny', rel: 'work', giver: 'bossA', at: 'studio', verb: 'handle', tone: 'epic', title: 'Tiny change: redo everything by 17:00', body: 'It is a small tweak. Just the logo, the colours, the product and the name.', doText: 'Redo everything', win: [8.5, 14], pri: 3 },
  { id: 'a-logo', rel: 'work', giver: 'bossA', at: 'studio', verb: 'fix', tone: 'absurd', title: 'Make the logo bigger', body: 'Bigger. A bit more. Now smaller. Actually, go back to the first one.', doText: 'Nudge the logo', win: [9, 16.5] },
  { id: 'a-sync', rel: 'work', giver: 'bossA', at: 'studio', verb: 'chat', tone: 'absurd', title: 'Quick sync (45 minutes)', body: 'No agenda. Bring snacks. We will find the agenda together.', doText: 'Nod at the right moments', win: [9, 16] },
  { id: 'a-salads', rel: 'work', giver: 'bossA', at: 'cafe', verb: 'shop', tone: 'trivial', title: 'Pick up the team lunch', body: 'Fourteen salads. Fourteen different dressings. Fourteen opinions.', doText: 'Collect the salads', win: [11, 14] },
  { id: 'b-launch', rel: 'work', giver: 'bossB', at: 'startup', verb: 'handle', tone: 'epic', title: 'We launch in an hour (we have not started)', body: 'Is the thing working? Which thing? THE thing. Why is it blue?', doText: 'Press the big red launch button', win: [9, 15.5], pri: 3 },
  { id: 'b-demo', rel: 'work', giver: 'bossB', at: 'startup', verb: 'chat', tone: 'epic', title: 'The investors are here: you are the demo', body: 'Smile. Say "AI" every ten seconds. Do not mention Tuesday.', doText: 'Say "AI" with confidence', win: [10, 16] },
  { id: 'b-bug', rel: 'work', giver: 'bossB', at: 'startup', verb: 'fix', tone: 'absurd', title: 'A tiny bug: the app only works on Tuesdays', body: 'On Wednesdays it is a feature. Please make it a feature on Tuesdays too.', doText: 'Fix Tuesday', win: [9, 17] },
  { id: 'b-oat', rel: 'work', giver: 'bossB', at: 'cafe', verb: 'shop', tone: 'trivial', title: 'An oat flat white for the CEO', body: 'The oat is non-negotiable. The temperature is also non-negotiable.', doText: 'Order the oat flat white', win: [8, 17] },
  { id: 'b-standup', rel: 'work', giver: 'bossB', at: 'startup', verb: 'chat', tone: 'trivial', title: 'Stand-up (it is a sit-down)', body: 'Two minutes. Everyone talks for six.', doText: 'Say "no blockers"', win: [8.5, 17] },
  { id: 'c-invoice', rel: 'work', giver: 'bossC', at: 'sidegig', verb: 'handle', tone: 'absurd', title: 'Send the invoice (again)', body: 'I never got it. Check my spam. Then the spam of my spam.', doText: 'Hand over the invoice', win: [9, 17] },
  { id: 'c-banner', rel: 'work', giver: 'bossC', at: 'sidegig', verb: 'assemble', tone: 'epic', title: 'A banner by lunch', body: 'Like the last one but different. Same, but fresh. You know.', doText: 'Build the banner', win: [8.5, 12.5] },
  { id: 'c-print', rel: 'work', giver: 'bossC', at: 'sidegig', verb: 'carry', tone: 'trivial', title: 'Print this and bring it by hand', body: 'Yes, in 2025. Yes, on paper. Yes, I know.', doText: 'Deliver the printout', win: [9, 17.5] },

  // ── Perach & Beit Perach ──
  { id: 'p-homework', rel: 'perach', giver: 'yuval', at: 'perach', verb: 'chat', tone: 'trivial', title: 'Yuval lost his homework', body: 'The dog ate it. We do not have a dog. He says it is a "new" dog.', doText: 'Find the homework', win: [13, 19] },
  { id: 'p-whiteboard', rel: 'perach', giver: 'maya', at: 'perach', verb: 'assemble', tone: 'absurd', title: 'Set up the whiteboard for tonight', body: 'The markers are somewhere. Probably with the homework.', doText: 'Hang the whiteboard', win: [13, 18] },
  { id: 'p-pizza', rel: 'perach', giver: 'maya', at: 'kiosk', verb: 'shop', tone: 'absurd', title: 'Pizza for the mentors (13 of them)', body: 'Two vegans, one "mostly", one who only eats the crust.', doText: 'Order thirteen pizzas', win: [13, 18.5] },
  { id: 'p-nature', rel: 'perach', giver: 'noga', at: 'park', verb: 'escort', tone: 'absurd', title: 'Walk Noga to the park for "nature"', body: 'She says nature is boring. You are about to prove her wrong.', doText: 'Find a bird', win: [14, 18.5] },
  { id: 'p-form', rel: 'perach', giver: 'maya', at: 'perach', verb: 'handle', tone: 'absurd', title: 'Form 3B for Perach', body: 'Needs one tiny stamp from City Hall. Tiny. Just a stamp.', doText: 'Fill in form 3B', win: [8.5, 12], then: { id: 'city-stamp', delay: 5 } },
  { id: 'p-speech', rel: 'perach', giver: 'maya', at: 'perach', verb: 'chat', tone: 'epic', title: 'A motivational speech, in five minutes', body: 'Tell them they can do anything. Including long division.', doText: 'Give the speech', win: [14, 19] },
  { id: 'p-hide', rel: 'perach', giver: 'itay', at: 'park', verb: 'handle', tone: 'epic', title: 'Itay is hiding in the park (for real)', body: 'It started as a game. Nobody remembers who is seeking.', doText: 'Find Itay', win: [14, 18.5] },
  { id: 'p-stickers', rel: 'perach', giver: 'maya', at: 'perach', verb: 'carry', tone: 'trivial', title: 'Hand out the stickers', body: 'Itay ate half of them. Count again.', doText: 'Give out stickers', win: [13, 19] },
  { id: 'p-sixty-two', rel: 'perach', giver: 'yuval', at: 'perach', verb: 'chat', tone: 'trivial', title: 'Yuval got a 62!', body: 'That is a PASS! Make it a big deal. A BIG deal. Confetti if you have any.', doText: 'Cheer very loudly', win: [14, 20], rewardBoost: 1.6 },
  { id: 'p-bus', rel: 'perach', giver: 'noga', at: 'busstop', verb: 'escort', tone: 'trivial', title: 'Put Noga on the right bus', body: 'It is the 5. It is always the 5. She will say it is the 6.', doText: 'Point at the 5', win: [15, 20] },

  // ── City Hall (it closes at 15:00; the tasks arrive in the morning) ──
  { id: 'city-queue', rel: 'city', giver: 'clerk', at: 'cityhall', verb: 'queue', tone: 'epic', title: 'Take a number', body: 'You are number 412. Now serving: 17. Please remain calm.', doText: 'Take a number and wait', win: [7, 12] },
  { id: 'city-17-18', rel: 'city', giver: 'clerk', at: 'cityhall', verb: 'handle', tone: 'absurd', title: 'Form 17 requires form 18', body: 'Form 18 requires form 17. Please proceed.', doText: 'Proceed', win: [7, 12.5] },
  { id: 'city-stamp', rel: 'city', giver: 'clerk', at: 'cityhall', verb: 'queue', tone: 'absurd', title: 'The stamp for Perach', body: 'The stamp is the wrong colour. We only have the right colour on Thursdays.', doText: 'Get the right-coloured stamp', win: [7, 12.5] },
  { id: 'city-arnona', rel: 'city', giver: 'clerk', at: 'cityhall', verb: 'handle', tone: 'epic', title: 'Arnona (it never ends)', body: 'Pay now. Or later, with interest. With feelings.', doText: 'Pay the Arnona', win: [7, 12] },
  { id: 'city-ticket', rel: 'city', giver: 'inspector', at: 'cityhall', verb: 'handle', tone: 'absurd', title: 'Appeal the parking ticket', body: 'It was a scooter. Scooters do not park. They "rest".', doText: 'File the appeal', win: [7, 12.5] },
  { id: 'city-word', rel: 'city', giver: 'inspector', at: 'cityhall', verb: 'chat', tone: 'trivial', title: 'The inspector wants a word', body: 'Just one word. It is a long word. Bring a chair.', doText: 'Hear the word', win: [7, 13] },
  { id: 'city-cactus', rel: 'city', giver: 'clerk', at: 'cityhall', verb: 'handle', tone: 'absurd', title: 'A permit for the balcony cactus', body: 'It is a cactus. It is two centimetres tall. It is "a structure".', doText: 'Defend the cactus', win: [7, 12.5] },
  { id: 'city-break', rel: 'city', giver: 'clerk', at: 'cityhall', verb: 'queue', tone: 'trivial', title: 'The clerk is on a 15-minute break', body: 'Since 11:00. Wait politely. Then wait louder.', doText: 'Wait. Politely.', win: [9, 13] },
  { id: 'city-bins', rel: 'city', giver: 'inspector', at: 'home', verb: 'handle', tone: 'trivial', title: 'Take the bins out', body: 'Today is Tuesday. The bins go out on Wednesday. Do it anyway, it is a long story.', doText: 'Roll the bins out', win: [7, 12] },
  { id: 'city-survey', rel: 'city', giver: 'clerk', at: 'kiosk', verb: 'chat', tone: 'trivial', title: 'A municipal survey (47 questions)', body: 'How satisfied are you? Please rate your satisfaction with your satisfaction.', doText: 'Answer "very"', win: [7, 12.5] },

  // ── Friends, neighbours and strangers ──
  { id: 's-parrot', rel: 'strangers', giver: 'parrot', at: 'park', verb: 'carry', tone: 'absurd', title: 'Hold my parrot (just for a second)', body: 'He bites. Not hard. Only when you stop talking. He knows your name now.', doText: 'Hold the parrot', win: [9, 20] },
  { id: 's-hummus', rel: 'strangers', giver: 'tourist', at: 'busstop', verb: 'chat', tone: 'trivial', title: 'Directions to "the good hummus"', body: 'Everyone has an opinion. You will have to choose one. Choose carefully.', doText: 'Point towards the hummus', win: [9, 21] },
  { id: 's-ikea', rel: 'friends', giver: 'moti', at: 'home', verb: 'assemble', tone: 'absurd', title: "Help Moti with a wardrobe (he has 'no screws left')", body: 'There were screws. There were definitely screws. Bring screws.', doText: 'Find a screw', win: [9, 20] },
  { id: 's-hi', rel: 'friends', giver: 'moti', at: 'home', verb: 'chat', tone: 'trivial', title: 'Say hi to the neighbour', body: 'Just hi. Not the forty-minute version. (It will be the forty-minute version.)', doText: 'Say hi (briefly)', win: [8, 21] },
  { id: 's-roee', rel: 'friends', giver: 'roee', at: 'cafe', verb: 'chat', tone: 'epic', title: 'Roee needs to talk', body: 'It is about a girl. Then a dog. Then taxes. Bring an ear and a sandwich.', doText: 'Listen to Roee', win: [10, 21.5] },
  { id: 's-gift', rel: 'friends', giver: 'roee', at: 'kiosk', verb: 'shop', tone: 'absurd', title: 'A birthday gift (the birthday is in ten minutes)', body: 'Something thoughtful. Something quick. Something that is not gum.', doText: 'Find a gift (not gum)', win: [10, 21] },
  { id: 's-bagel', rel: 'strangers', giver: 'tourist', at: 'cafe', verb: 'escort', tone: 'absurd', title: "A tourist wants 'the real Tel Aviv'", body: 'Not the beach. Not the museum. A real bagel. And a cat. And a life lesson.', doText: 'Show the real Tel Aviv', win: [9, 20] },
  { id: 's-cat', rel: 'strangers', giver: 'parrot', at: 'park', verb: 'handle', tone: 'epic', title: 'Find the lost cat', body: 'She answers to Pishi, Kitty and, sometimes, Yossi.', doText: 'Call "Yossi"', win: [9, 19] },
  { id: 's-nokia', rel: 'strangers', giver: 'tourist', at: 'cafe', verb: 'fix', tone: 'trivial', title: 'My phone is at 2% - a charger?', body: 'It is a Nokia. It has a very particular charger. Everybody has one. Look around.', doText: 'Find the charger', win: [9, 21] },
  { id: 's-milk', rel: 'friends', giver: 'moti', at: 'kiosk', verb: 'shop', tone: 'trivial', title: 'Buy milk', body: 'Just milk. And eggs. And a cake. For "tomorrow". Which is a Thursday.', doText: 'Buy the milk (and more)', win: [8, 20] },
  { id: 's-stroller', rel: 'strangers', giver: 'tourist', at: 'busstop', verb: 'carry', tone: 'absurd', title: 'Carry the stroller up the steps', body: 'The baby is asleep. So: ninja mode. One squeak and it starts over.', doText: 'Lift in ninja mode', win: [9, 21] },
  { id: 's-photo', rel: 'strangers', giver: 'tourist', at: 'park', verb: 'chat', tone: 'trivial', title: 'Take our family photo', body: 'Fourteen people, one camera, forty tries. "One more, I blinked."', doText: 'Say "cheese"', win: [9, 20] },

  // ── Hobbies and errands ──
  { id: 'h-court', rel: 'hobbies', giver: 'coach', at: 'court', verb: 'handle', tone: 'absurd', title: 'Fill in for the 3-on-3 (we are two)', body: 'You do not have to be good. You have to be there. You are not tall. Come anyway.', doText: 'Take the shot', win: [16, 22] },
  { id: 'h-bike', rel: 'hobbies', giver: 'uzi', at: 'workshop', verb: 'fix', tone: 'absurd', title: 'Fix the bike before they notice', body: 'It is not your bike. It is not their bike. It is "the" bike.', doText: 'Tighten the thing', win: [14, 21] },
  { id: 'h-drill', rel: 'hobbies', giver: 'uzi', at: 'workshop', verb: 'carry', tone: 'trivial', title: 'Return the borrowed drill', body: 'You borrowed it in 2021. He has stopped asking. That is worse.', doText: 'Return the drill', win: [13, 21] },
  { id: 'h-ball', rel: 'hobbies', giver: 'coach', at: 'kiosk', verb: 'shop', tone: 'trivial', title: 'A new ball (the old one is on a roof)', body: 'It has been on that roof since spring. It has a life there now.', doText: 'Buy a ball', win: [15, 21] },
  { id: 'h-sunset', rel: 'hobbies', giver: 'self', at: 'park', verb: 'chat', tone: 'trivial', calm: true, title: 'Sit for three minutes (it counts as a task)', body: 'Look at the sea. Do nothing. Do it properly.', doText: 'Sit on the bench', win: [17.5, 20.5], rewardBoost: 1.2 },
  { id: 'h-coffee', rel: 'hobbies', giver: 'self', at: 'cafe', verb: 'shop', tone: 'trivial', coffee: true, title: 'A proper coffee', body: 'You deserve it. The sprint button is a cup.', doText: 'Drink the coffee', win: [7, 21] },
  { id: 'e-package', rel: 'friends', giver: 'moti', at: 'kiosk', verb: 'handle', tone: 'absurd', title: "Collect a package for Moti", body: 'ID required. The ID is in his other pocket. His other pocket is in his other jacket.', doText: 'Show some ID', win: [9, 19] },
  { id: 'e-ice-cream', rel: 'friends', giver: 'roee', at: 'cafe', verb: 'carry', tone: 'epic', title: 'Deliver the ice cream before it melts', body: 'It is August. It is Tel Aviv. You have eleven minutes.', doText: 'Run, run, run', win: [12, 17], mins: 25, rewardBoost: 1.5 },
  { id: 'e-leaflets', rel: 'hobbies', giver: 'coach', at: 'busstop', verb: 'handle', tone: 'trivial', title: 'Stick the court poster on the bus stop', body: 'Nobody reads posters. Put it where nobody will read it with style.', doText: 'Stick the poster', win: [10, 20] },
  { id: 'e-sunscreen', rel: 'family', giver: 'ima', at: 'park', verb: 'carry', tone: 'trivial', title: 'Bring Auntie her sunscreen at the park', body: 'SPF 50. Not 30. She will know. She always knows.', doText: 'Hand over the sunscreen', win: [10, 16] },
];

/** The three quick replies on the phone; each is one of these keys (see quests.js for what they do). */
export const REPLIES = {
  yes: ['On my way!', 'Yalla, coming.', 'Sababa, on it.', 'Be right there.'],
  later: ['Give me a bit?', 'Soon, I promise.', 'After this one.'],
  no: ["Can't today, sorry.", 'Not now - really sorry.', 'Next week?'],
};

/** What the day was worth: the rank for a score. */
export const RANKS = [
  { min: 0, title: 'Barely Awake' },
  { min: 450, title: 'A Helpful Neighbour' },
  { min: 1000, title: "Everyone's Favourite" },
  { min: 1600, title: 'The Guy Who Does Everything' },
  { min: 2300, title: 'Pillar of the Neighbourhood' },
  { min: 3000, title: 'Legend. Please Sleep.' },
];

/** The passers-by that fill the streets (T51: just walkers; the cast with names arrives with the quests). */
export const CROWD = { count: 40 };
