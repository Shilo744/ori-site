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

/** The passers-by that fill the streets (T51: just walkers; the cast with names arrives with the quests). */
export const CROWD = { count: 40 };
