// "Ori, Can You...?" — the inside of the buildings as DATA (PURE: no three, no DOM). Every place with a door has a room: its size, its look, the
// furniture (kind, position, rotation, size), the people who stand in it, and what Space does at each prop. interior3d.js builds the 3D from this;
// the tests check that everything fits, nothing blocks the door and every prop and person can be reached.
//   Room frame: x → east, z → south, the door is in the middle of the SOUTH wall (z = +d/2). rot = degrees about y; 0 faces +z (the door),
//   90 faces +x, 180 faces -z (the back wall), 270 faces -x.
import { box, createCollisionWorld } from './collide.js';
import { PLAYER_R } from './map.js';

export const WALL_H = 3.3;
export const DOOR_W = 1.5;
export const INTERIOR_ORIGIN = { x: 900, z: 0, step: 70 }; // the rooms hang far away from the street, one after the other

/** Footprint (w, d, metres) of each kind of furniture at rot 0. `solid: false` = you can walk over it (a rug) / it hangs on the wall. */
export const KINDS = {
  sofa: { w: 2.2, d: 0.95 }, armchair: { w: 0.95, d: 0.95 }, coffeeTable: { w: 1.1, d: 0.6 }, table: { w: 1.8, d: 0.9 }, chair: { w: 0.45, d: 0.45 },
  bed: { w: 2.0, d: 1.6 }, wardrobe: { w: 1.6, d: 0.6 }, shelf: { w: 1.6, d: 0.4 }, tv: { w: 1.5, d: 0.45 }, fridge: { w: 0.8, d: 0.75 },
  counter: { w: 3, d: 0.75 }, plant: { w: 0.7, d: 0.7 }, tree: { w: 0.9, d: 0.9 }, lamp: { w: 0.4, d: 0.4 }, rug: { w: 3, d: 2, solid: false },
  photos: { w: 4.6, d: 0.06, solid: false }, desk: { w: 1.6, d: 0.8 }, bench: { w: 4, d: 0.5 }, queue: { w: 0.7, d: 0.6 }, board: { w: 3, d: 0.1, solid: false },
  display: { w: 2, d: 0.1, solid: false }, rack: { w: 1.1, d: 0.4 }, cooler: { w: 0.45, d: 0.45 }, foosball: { w: 1.4, d: 0.8 }, beanbag: { w: 1, d: 1 },
  stool: { w: 0.4, d: 0.4 }, round: { w: 0.85, d: 0.85 }, bench2: { w: 2.2, d: 0.55 }, workbench: { w: 2.6, d: 0.8 }, pegboard: { w: 2.4, d: 0.08, solid: false },
  cabinet: { w: 1.0, d: 0.5 }, glassCase: { w: 1.4, d: 0.5 }, serverRack: { w: 0.7, d: 0.7 }, crates: { w: 0.9, d: 0.9 }, window: { w: 1.6, d: 0.1, solid: false },
  poster: { w: 1.1, d: 0.05, solid: false }, kioskShelf: { w: 1.6, d: 0.45 }, espresso: { w: 0.9, d: 0.6 }, standing: { w: 1.4, d: 0.7 }, pot: { w: 0.8, d: 0.8 },
};

const R = (n) => Math.round(n * 100) / 100;
/** The axis-aligned footprint of an item (rotated in 90-degree steps): { x0, z0, x1, z1 }. */
export function footprint(it) {
  const k = KINDS[it.k];
  let w = it.w ?? k.w;
  let d = it.d ?? k.d;
  if (((it.rot || 0) / 90) % 2 !== 0) [w, d] = [d, w];
  return { x0: R(it.x - w / 2), z0: R(it.z - d / 2), x1: R(it.x + w / 2), z1: R(it.z + d / 2) };
}

/** The rooms. `use` = what Space does at a prop (toast text, or a verb the game knows: 'coffee', 'number', 'sit'), `say` = the toast. */
export const ROOMS = {
  home: {
    w: 9, d: 7, floor: 'wood', wall: '#efe9e0', accent: '#5b8def', mood: 'warm', hum: 'quiet',
    items: [
      { k: 'rug', x: 0, z: -0.4, c: '#8aa5d6' }, { k: 'sofa', x: -2.4, z: -2.5, rot: 0, c: '#6d86b8' }, { k: 'coffeeTable', x: -2.4, z: -1.4, c: '#c9a57a' },
      { k: 'desk', x: 2.9, z: -2.9, rot: 0, c: '#d9cdb8', screen: true, work: true, say: 'The desk. The portfolio glows softly.' }, { k: 'chair', x: 2.9, z: -2.0, rot: 180, c: '#2b2e38' },
      { k: 'shelf', x: 0.4, z: -3.2, c: '#caa87e', stuff: 'trophies' }, { k: 'plant', x: -4.0, z: -3.0 }, { k: 'plant', x: 4.0, z: 2.6 },
      { k: 'bed', x: 3.2, z: 1.0, rot: 270, c: '#e8e3da', sheet: '#7fa0d8' }, { k: 'lamp', x: 1.6, z: -3.0 },
      { k: 'poster', x: -4.44, z: -1.0, rot: 90, art: 0, say: 'A poster of a place he has not been to yet. Yet.' }, { k: 'window', x: 0, z: -3.44, rot: 0, sill: true },
    ],
    npcs: [],
  },
  mum: {
    w: 9, d: 7, floor: 'wood', wall: '#f1dfd0', accent: '#e07a8f', mood: 'warm', hum: 'quiet',
    items: [
      { k: 'rug', x: -1.6, z: -0.4, c: '#b46a5a' }, { k: 'sofa', x: -2.0, z: -2.5, rot: 0, c: '#c9a98a', plastic: true, use: 'sit', say: 'Squeak. The plastic cover has protected this sofa since 1994.' },
      { k: 'coffeeTable', x: -2.0, z: -1.3, c: '#7a5a3c', doily: true }, { k: 'tv', x: -2.0, z: 1.4, rot: 180, c: '#3a2f28', doily: true },
      { k: 'photos', x: 0.2, z: -3.44, rot: 0, count: 40, say: 'Forty photos of Ori. Baby Ori, camp Ori, graduation Ori. She has a favourite.' },
      { k: 'glassCase', x: 3.7, z: -1.0, rot: 270, cups: true, say: 'The good cups. For guests. Nobody has ever been allowed to use them.' },
      { k: 'table', x: 2.4, z: 1.4, rot: 0, c: '#d9c3a0', pot: true, use: 'food:soup', say: 'A pot of chicken soup. It is already served, somehow.' },
      { k: 'chair', x: 1.6, z: 0.6, rot: 0, c: '#8a5a3a' }, { k: 'chair', x: 3.2, z: 0.6, rot: 0, c: '#8a5a3a' }, { k: 'chair', x: 1.6, z: 2.2, rot: 180, c: '#8a5a3a' }, { k: 'chair', x: 3.2, z: 2.2, rot: 180, c: '#8a5a3a' },
      { k: 'fridge', x: 3.9, z: -2.7, rot: 270, c: '#e9e9e4', magnets: true, say: 'Magnets from every country Mum has not visited.' }, { k: 'plant', x: -4.0, z: 2.6 },
      { k: 'window', x: 3.0, z: -3.44, rot: 0, sill: true },
    ],
    npcs: [{ id: 'ima', x: 0.9, z: 0.0, rot: 200, work: true }],
  },
  auntie: {
    w: 10, d: 7, floor: 'tile', wall: '#f4ecd2', accent: '#e8a24a', mood: 'warm', hum: 'quiet',
    items: [
      { k: 'sofa', x: -2.6, z: -2.6, rot: 0, c: '#d6a85a' }, { k: 'armchair', x: 0.2, z: -2.4, rot: 20, c: '#a8c070' }, { k: 'coffeeTable', x: -1.4, z: -1.2, c: '#a8845a' },
      { k: 'tree', x: 4.0, z: 2.4, lemon: true, use: 'food:tea', say: 'A lemon tree, indoors. It has opinions about the sunshine.' }, { k: 'cabinet', x: 4.3, z: -2.6, rot: 270, c: '#ccb28a', router: true, use: 'router', say: 'The router, behind the lemon jam. Found it.' },
      { k: 'table', x: -2.2, z: 1.6, c: '#d6c4a0' }, { k: 'chair', x: -3.0, z: 0.8 }, { k: 'chair', x: -1.4, z: 0.8 }, { k: 'tv', x: 2.4, z: 0.6, rot: 90, c: '#5a4a3a' },
      { k: 'plant', x: -4.4, z: -3.0 }, { k: 'window', x: -1.0, z: -3.44, rot: 0, sill: true }, { k: 'rug', x: -1.0, z: 0.4, c: '#d98b5a' },
    ],
    npcs: [{ id: 'auntie', x: 1.4, z: 0.6, rot: 180, work: true }],
  },
  cityhall: {
    w: 17, d: 12, floor: 'terrazzo', wall: '#dfe3e8', accent: '#8d939c', mood: 'cool', hum: 'hall',
    items: [
      { k: 'queue', x: -6.4, z: 3.4, rot: 0, use: 'number', say: 'You take number 85.', work: true }, { k: 'display', x: 0, z: -5.85, rot: 0, now: 84 },
      { k: 'counter', x: -4.2, z: -3.9, rot: 0, w: 4, window: true }, { k: 'counter', x: 0.4, z: -3.9, rot: 0, w: 4, window: true }, { k: 'counter', x: 5.0, z: -3.9, rot: 0, w: 4, window: true },
      { k: 'bench', x: -2.4, z: 0.6, rot: 0, w: 6.5 }, { k: 'bench', x: 4.4, z: 0.6, rot: 0, w: 5 }, { k: 'rack', x: 7.0, z: 3.2, rot: 270, forms: true, say: 'Forms 1 to 40. Form 17 needs form 18.' },
      { k: 'rack', x: 7.0, z: 4.6, rot: 270, forms: true }, { k: 'plant', x: -7.6, z: -5.2 }, { k: 'plant', x: 7.6, z: -5.2 }, { k: 'cooler', x: 6.9, z: 1.4 },
      { k: 'poster', x: -8.44, z: -1.0, rot: 90, art: 1 }, { k: 'poster', x: 8.44, z: -1.0, rot: 270, art: 2 }, { k: 'window', x: -8.44, z: 2, rot: 90, sill: true }, { k: 'window', x: 8.44, z: -2, rot: 270, sill: true },
    ],
    npcs: [{ id: 'clerk', x: 0.4, z: -5.0, rot: 0, work: true }, { id: 'inspector', x: 5.0, z: -5.0, rot: 0 }],
  },
  perach: {
    w: 12, d: 8, floor: 'wood', wall: '#e9f1e6', accent: '#43b581', mood: 'warm', hum: 'chatter',
    items: [
      { k: 'board', x: 0, z: -3.9, rot: 0, scribble: true, say: 'The whiteboard. Half of it says "ideas". The other half says "snacks".' }, { k: 'table', x: -3.4, z: -0.6, rot: 0, w: 2.4, d: 1.1 },
      { k: 'chair', x: -4.2, z: -1.5 }, { k: 'chair', x: -2.6, z: -1.5 }, { k: 'chair', x: -4.2, z: 0.3, rot: 180 }, { k: 'chair', x: -2.6, z: 0.3, rot: 180 },
      { k: 'table', x: 3.0, z: 1.2, w: 2.4, d: 1.1, snacks: true, use: 'snack', say: 'A snack. Perach runs on snacks.' }, { k: 'round', x: 3.8, z: -1.0, c: '#e3d29a' },
      { k: 'stool', x: 3.2, z: -1.0 }, { k: 'stool', x: 4.4, z: -1.0 }, { k: 'beanbag', x: 4.6, z: 2.4, c: '#e5625e' }, { k: 'beanbag', x: 3.4, z: 3.0, c: '#4a90e2' },
      { k: 'shelf', x: -5.7, z: 1.8, rot: 90, stuff: 'books' }, { k: 'plant', x: 5.4, z: -3.3 }, { k: 'poster', x: 5.94, z: -0.4, rot: 270, art: 3 }, { k: 'window', x: -3.2, z: -3.94, rot: 0, sill: true }, { k: 'window', x: 3.2, z: -3.94, rot: 0, sill: true },
    ],
    npcs: [{ id: 'maya', x: -1.2, z: -2.4, rot: 160, work: true }, { id: 'noga', x: 2.4, z: 3.0, rot: 200 }],
  },
  studio: {
    w: 13, d: 9, floor: 'concrete', wall: '#ece9f6', accent: '#9b6bff', mood: 'cool', hum: 'office',
    items: [
      { k: 'desk', x: -4.2, z: -2.6, rot: 0, screen: true, c: '#f2f0f8' }, { k: 'desk', x: -1.8, z: -2.6, rot: 0, screen: true, c: '#f2f0f8' }, { k: 'desk', x: 0.6, z: -2.6, rot: 0, screen: true, c: '#f2f0f8' },
      { k: 'desk', x: -4.2, z: 0.6, rot: 180, screen: true, c: '#f2f0f8' }, { k: 'desk', x: -1.8, z: 0.6, rot: 180, screen: true, c: '#f2f0f8', work: true, say: 'A tiny change. Due at five.' },
      { k: 'chair', x: -4.2, z: -1.7, rot: 180 }, { k: 'chair', x: -1.8, z: -1.7, rot: 180 }, { k: 'chair', x: 0.6, z: -1.7, rot: 180 }, { k: 'chair', x: -4.2, z: -0.3 }, { k: 'chair', x: -1.8, z: -0.3 },
      { k: 'board', x: 4.2, z: -4.4, rot: 0, scribble: true, mood: true, say: 'A mood board. The mood is: purple.' }, { k: 'table', x: 4.0, z: 0.6, w: 2.6, d: 1.2 }, { k: 'chair', x: 3.0, z: 1.6, rot: 180 }, { k: 'chair', x: 5.0, z: 1.6, rot: 180 },
      { k: 'sofa', x: 4.6, z: 3.4, rot: 180, c: '#7a5ec8' }, { k: 'plant', x: -5.9, z: -3.8 }, { k: 'plant', x: 5.9, z: -3.8 }, { k: 'cooler', x: 6.0, z: 2.0 },
      { k: 'window', x: -2.2, z: -4.44, rot: 0, sill: true }, { k: 'window', x: 1.8, z: -4.44, rot: 0, sill: true },
    ],
    npcs: [{ id: 'bossA', x: 1.6, z: 1.8, rot: 220, work: true }],
  },
  startup: {
    w: 13, d: 9, floor: 'wood', wall: '#e2f0f6', accent: '#2fb8d8', mood: 'cool', hum: 'office',
    items: [
      { k: 'standing', x: -4.4, z: -3.0, rot: 0, screen: true, c: '#cfd8dc', use: 'arcade', say: 'The office computer. It has games on it!' }, { k: 'standing', x: -2.4, z: -3.0, rot: 0, screen: true, c: '#cfd8dc' }, { k: 'standing', x: -0.4, z: -3.0, rot: 0, screen: true, c: '#cfd8dc', work: true, say: 'One more quick thing. Always one more.' },
      { k: 'standing', x: 1.6, z: -3.0, rot: 0, screen: true, c: '#cfd8dc' }, { k: 'foosball', x: 4.2, z: 0.8, rot: 90 }, { k: 'beanbag', x: -4.6, z: 1.6, c: '#2fb8d8' }, { k: 'beanbag', x: -3.2, z: 2.8, c: '#ffb25b' },
      { k: 'poster', x: 6.44, z: -2.6, rot: 270, art: 4, say: 'A rocket. Pointing up. Always up.' }, { k: 'board', x: 3.6, z: -4.4, rot: 0, scribble: true }, { k: 'serverRack', x: 5.8, z: -3.8 },
      { k: 'cooler', x: 6.0, z: 3.0 }, { k: 'plant', x: -5.9, z: -3.9 }, { k: 'table', x: -0.2, z: 1.6, w: 2.4, d: 1.1, c: '#e5d8bf' }, { k: 'stool', x: -1.2, z: 2.5 }, { k: 'stool', x: 0.8, z: 2.5 },
      { k: 'window', x: -6.44, z: 0, rot: 90, sill: true },
    ],
    npcs: [{ id: 'bossB', x: 2.6, z: -1.2, rot: 200, work: true }, { id: 'shilo', x: -3.3, z: -1.7, rot: 25 }],
  },
  sidegig: {
    w: 9, d: 7, floor: 'concrete', wall: '#f1e3e0', accent: '#e5625e', mood: 'cool', hum: 'office',
    items: [
      { k: 'desk', x: -2.4, z: -2.6, rot: 0, screen: true, c: '#b9a98f', work: true, say: 'Do not ask.' }, { k: 'chair', x: -2.4, z: -1.7, rot: 180 }, { k: 'cabinet', x: 0.4, z: -3.1, c: '#9aa3ab' }, { k: 'cabinet', x: 1.6, z: -3.1, c: '#9aa3ab' },
      { k: 'cabinet', x: 2.8, z: -3.1, c: '#9aa3ab' }, { k: 'crates', x: 3.5, z: 1.4, c: '#c9a27a' }, { k: 'crates', x: 3.7, z: 2.5, c: '#c9a27a' }, { k: 'cooler', x: -3.9, z: 1.6 },
      { k: 'plant', x: -3.9, z: -3.0 }, { k: 'table', x: -1.6, z: 1.2, w: 1.6, d: 0.9 }, { k: 'window', x: -0.4, z: -3.44, rot: 0, sill: true },
    ],
    npcs: [{ id: 'bossC', x: 0.4, z: 0.2, rot: 200, work: true }],
  },
  cafe: {
    w: 13, d: 9, floor: 'wood', wall: '#f3e4d2', accent: '#c98a4b', mood: 'warm', hum: 'chatter',
    items: [
      { k: 'counter', x: 2.0, z: -2.6, rot: 0, w: 6, glass: true, use: 'coffee', say: 'A fresh espresso. Sprint button engaged.', work: true }, { k: 'counter', x: -2.6, z: -2.4, rot: 0, w: 1.5, d: 0.7, use: 'coffeejob', say: 'The order pad: Roee needs a hand.' }, { k: 'espresso', x: 4.4, z: -3.3, rot: 0 }, { k: 'shelf', x: -1.8, z: -4.2, w: 4, stuff: 'cups' },
      { k: 'round', x: -4.6, z: 0.4, c: '#c9a57a' }, { k: 'round', x: -2.2, z: 1.4, c: '#c9a57a' }, { k: 'round', x: 1.8, z: 0.6, c: '#c9a57a' }, { k: 'round', x: 4.2, z: 1.8, c: '#c9a57a' },
      { k: 'stool', x: -5.3, z: 0.4 }, { k: 'stool', x: -3.9, z: 0.4 }, { k: 'stool', x: -2.9, z: 1.4 }, { k: 'stool', x: -1.5, z: 1.4 }, { k: 'stool', x: 1.1, z: 0.6 }, { k: 'stool', x: 2.5, z: 0.6 }, { k: 'stool', x: 3.5, z: 1.8 }, { k: 'stool', x: 4.9, z: 1.8 },
      { k: 'sofa', x: -5.1, z: -3.4, rot: 0, c: '#b5683a' }, { k: 'plant', x: 6.0, z: 3.5 }, { k: 'plant', x: -6.0, z: 3.5 }, { k: 'window', x: -6.44, z: -0.5, rot: 90, sill: true }, { k: 'window', x: 6.44, z: 0.5, rot: 270, sill: true },
      { k: 'lamp', x: -6.0, z: -1.6 },
    ],
    npcs: [{ id: 'roee', x: 2.8, z: -3.6, rot: 0, work: true }, { id: 'stranger:21', x: -1.6, z: 0.4, rot: 120 }],
  },
  kiosk: {
    w: 5.4, d: 4.6, floor: 'tile', wall: '#fbf3c8', accent: '#f2c14e', mood: 'warm', hum: 'quiet',
    items: [
      { k: 'kioskShelf', x: -1.7, z: -1.9, rot: 0, stuff: 'candy' }, { k: 'kioskShelf', x: 0.2, z: -1.9, rot: 0, stuff: 'drinks' }, { k: 'counter', x: 1.0, z: 0.5, rot: 90, w: 2.4, d: 0.6, work: true, use: 'food:gum', say: 'The stamp is here. Milk, gum, gossip.' },
      { k: 'fridge', x: -2.2, z: 0.2, rot: 90, c: '#d7e8f2', say: 'Cold milk. Always cold.' }, { k: 'poster', x: 2.64, z: -1.4, rot: 270, art: 5 },
    ],
    npcs: [{ id: 'albert', x: 1.9, z: 0.5, rot: 270, work: true }],
  },
  workshop: {
    w: 11, d: 7.5, floor: 'concrete', wall: '#e3e6ea', accent: '#7a8aa0', mood: 'cool', hum: 'hum',
    items: [
      { k: 'workbench', x: -2.6, z: -3.1, rot: 0, c: '#b58a58', tools: true, work: true, say: 'The borrowed drill goes right here.' }, { k: 'pegboard', x: -2.6, z: -3.7, rot: 0, tools: true },
      { k: 'workbench', x: 2.4, z: -3.1, rot: 0, c: '#b58a58', tools: true }, { k: 'crates', x: 4.6, z: 1.0, c: '#c9a27a' }, { k: 'crates', x: 4.6, z: 2.4, c: '#c9a27a' }, { k: 'shelf', x: -5.2, z: 0.6, rot: 90, stuff: 'parts' },
      { k: 'shelf', x: -5.2, z: 2.2, rot: 90, stuff: 'parts' }, { k: 'table', x: -0.6, z: 1.6, w: 2.2, d: 1.0, c: '#a9b0b8' }, { k: 'counter', x: -5.1, z: -1.7, rot: 90, w: 1.4, d: 0.7, use: 'league', say: 'The Sababa Cup board: seven rivals, one lap round the neighbourhood.' }, { k: 'poster', x: -5.44, z: -1.7, rot: 90, art: 4 }, { k: 'counter', x: 3.0, z: -0.8, rot: 0, w: 1.5, d: 0.7, use: 'parcel', say: "Uzi's parcels: somebody is waiting for one!" }, { k: 'plant', x: 5.0, z: -3.0 }, { k: 'window', x: 5.44, z: -0.5, rot: 270, sill: true },
    ],
    npcs: [{ id: 'uzi', x: 0.6, z: -1.6, rot: 190, work: true }],
  },
};

/** Places that can be entered. */
export const ENTERABLE = Object.keys(ROOMS);

/** Where room `id` hangs in the world (its centre). */
export function originOf(id) {
  const i = ENTERABLE.indexOf(id);
  return { x: INTERIOR_ORIGIN.x + i * INTERIOR_ORIGIN.step, z: INTERIOR_ORIGIN.z };
}

/** The walls and the furniture as world colliders for a room (the camera ignores them: `noCam`). */
export function collidersOf(id) {
  const r = ROOMS[id];
  const o = originOf(id);
  const out = [];
  const T = 0.5;
  const hw = r.w / 2;
  const hd = r.d / 2;
  const add = (x0, z0, x1, z1) => out.push(Object.assign(box(o.x + x0, o.z + z0, o.x + x1, o.z + z1), { noCam: true }));
  add(-hw - T, -hd - T, hw + T, -hd); // north
  add(-hw - T, -hd, -hw, hd); // west
  add(hw, -hd, hw + T, hd); // east
  add(-hw - T, hd, -DOOR_W / 2, hd + T); // south, left of the door
  add(DOOR_W / 2, hd, hw + T, hd + T); // south, right of the door
  add(-DOOR_W / 2, hd + 0.35, DOOR_W / 2, hd + T); // the threshold: you leave with a key or by walking into the mat
  for (const it of r.items) {
    const k = KINDS[it.k];
    if (k.solid === false || it.k === 'chair' || it.k === 'stool') continue; // chairs and stools are small enough to squeeze past: skip
    const f = footprint(it);
    add(f.x0, f.z0, f.x1, f.z1);
  }
  for (const n of r.npcs) add(n.x - 0.28, n.z - 0.28, n.x + 0.28, n.z + 0.28);
  return out;
}

/** Where Ori appears when he walks in: just inside the door, facing the room (heading = atan2(dx, dz), north = π). */
export function spawnOf(id) {
  const r = ROOMS[id];
  const o = originOf(id);
  return { x: o.x, z: o.z + r.d / 2 - 1.15, heading: Math.PI };
}

/** The door's exit zone (world): standing here, G / Space leaves. */
export function exitOf(id) {
  const r = ROOMS[id];
  const o = originOf(id);
  return { x: o.x, z: o.z + r.d / 2 - 0.1, r: 1.5 };
}

/** What can be used: props with `use` / `say` / `work`, and the people. Returns [{ i, kind, x, z, use, say, work, who? }] in WORLD coordinates. */
export function spotsOf(id) {
  const r = ROOMS[id];
  const o = originOf(id);
  const out = [];
  r.items.forEach((it, i) => { if (it.use || it.say || it.work) out.push({ i, kind: it.k, x: o.x + it.x, z: o.z + it.z, use: it.use || null, say: it.say || null, work: !!it.work, reach: 1.9 + Math.max(KINDS[it.k].w, KINDS[it.k].d) * 0.25 }); });
  r.npcs.forEach((n, i) => out.push({ i, kind: 'person', who: n.id, x: o.x + n.x, z: o.z + n.z, use: null, say: null, work: !!n.work, reach: 2.2 }));
  return out;
}

/** Pure check: the cells of the room that Ori can reach from the door (grid 0.25 m) — the tests use it to be sure nothing is walled off. */
export function reachable(id) {
  const r = ROOMS[id];
  const o = originOf(id);
  const world = createCollisionWorld(collidersOf(id), 4);
  const s = spawnOf(id);
  const step = 0.25;
  const key = (i, j) => `${i},${j}`;
  const seen = new Set();
  const i0 = Math.round((s.x - o.x) / step);
  const j0 = Math.round((s.z - o.z) / step);
  const start = [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1]].map(([a, b]) => [i0 + a, j0 + b]).find(([i, j]) => !world.blocked(o.x + i * step, o.z + j * step, PLAYER_R)) || [i0, j0];
  const todo = [start];
  const cells = [];
  while (todo.length) {
    const [i, j] = todo.pop();
    const k = key(i, j);
    if (seen.has(k)) continue;
    seen.add(k);
    const x = o.x + i * step;
    const z = o.z + j * step;
    if (Math.abs(x - o.x) > r.w / 2 + 0.2 || Math.abs(z - o.z) > r.d / 2 + 0.2) continue;
    if (world.blocked(x, z, PLAYER_R)) continue;
    cells.push([x, z]);
    todo.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  return { cells, world };
}
