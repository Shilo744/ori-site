// "Ori, Can You...?" — what is where (PURE data): the stars of the map (the ring, the office computer, the garage, the cafe: the places where something happens) and one
// short line for every place. They are shown on the minimap, in the big map (M) and under "G Go inside" at a door, so nobody has to wander around guessing which
// shop has something special. The words are warm and short; the persona test reads them.

/** The places with a real feature. `icon` is drawn by map2d.js (ring, arcade, garage, coffee). */
export const LANDMARKS = [
  { place: 'court', icon: 'ring', short: 'RING', name: 'The Ring', what: 'Fight the neighbours: jab, guard, dash, level up', color: '#ff6a3d' },
  { place: 'startup', icon: 'arcade', short: 'OFFICE', name: 'The Startup', what: 'Shilo works here, and the office computer has games', color: '#1aa6c8' },
  { place: 'workshop', icon: 'garage', short: 'GARAGE', name: "Uzi's Garage", what: 'Upgrades, parcels, Sababa Cup races', color: '#6f7f99' },
  { place: 'cafe', icon: 'coffee', short: 'CAFE', name: 'Cafe Sababa', what: 'An espresso at the counter: a burst of speed', color: '#b8793a' },
];

/** The car races (the Sababa Cup) on the map: a chequered flag at the start line, and a row in the big map's list that leads to the board, which is in the garage. */
export const CUP = { icon: 'flag', short: 'RACES', name: 'The Sababa Cup', what: "Car races, out of town: end of the main road, R", color: '#e5484d' };

/** His car on the map: it shows while it is parked; a click on it in the big map makes the beam and the arrow lead to it. */
export const CAR = { icon: 'car', short: 'CAR', name: "Ori's car", what: 'Parked where he left it. Press F next to it to get in', color: '#6a5cff' };

/** One line for every place of content.js: what is there. */
export const PLACE_LINES = {
  home: "Ori's flat - the desk where it all started",
  mum: 'Mum is here - and the plastic sofa',
  auntie: 'Auntie, a lemon tree and the router',
  cityhall: 'Take a number - the Inspector is around',
  perach: 'Maya, Noga and a table of snacks',
  studio: 'Job A: the boss with the tiny changes',
  startup: 'Shilo works here, and the office computer has games',
  sidegig: 'Job C: do not ask',
  cafe: 'An espresso at the counter: a burst of speed',
  kiosk: 'Albert: milk, gum and gossip',
  busstop: 'Bus 5 - it is coming. Probably',
  park: 'Lawn, palms and the sea. Golden peaches hide around here',
  court: 'THE RING - fight the neighbours',
  workshop: "Uzi's Garage - upgrades, parcels and the Sababa Cup",
};

export const lineFor = (id) => PLACE_LINES[id] || '';
export const landmarkOf = (place) => LANDMARKS.find((l) => l.place === place) || null;
