// "Ori, Can You...?" — the achievements (PURE) [experimental]: things worth being proud of, each one read off the counters the game already keeps (hellos, fights, love, ...).
// Nothing here is ever taken away: once a trophy is earned its id goes on the save (`progress.trophies`) and stays, whatever the counters do later.
import { CAST } from './content.js';
import { GAMES } from './arcade.js';
import { count as stampCount, STAMPS } from './stamps.js';
import { count as giftCount, GIFT_IDS } from './gifts.js';
import { friends as catFriends, petted as catPetted } from './cats.js';
import { RIVAL_IDS, EVENT_IDS } from './league.js';

/** The named people Ori can meet (everybody in the cast but himself). */
export const CAST_IDS = Object.keys(CAST).filter((id) => id !== 'self');

const n = (v) => (Number.isFinite(v) ? v : 0);
const met = (c) => CAST_IDS.filter((id) => n(c.p[`hi_${id}`]) > 0).length;
const beaten = (id) => (c) => (c.b.beaten || []).includes(id) ? 1 : 0;
const arcadeBest = (id) => (c) => n((c.p.best || {})[id]);
const playedAll = (c) => GAMES.filter((g) => n((c.p.best || {})[g.id]) > 0).length;

/** `have(ctx)` -> a number to compare with `need`. ctx = { p: progress, b: boxer, love, day, golden (how many found), lifetime (peaches earned in all) }. `shape` = which little badge shape it wears. */
export const TROPHIES = [
  { id: 'hello1', name: 'First hello', how: 'Say hello to somebody (H)', line: 'You waved. They waved back.', shape: 'heart', color: '#ff7a9a', need: 1, have: (c) => n(c.p.hellos) },
  { id: 'hello10', name: 'Friendly face', how: 'Say hello 10 times', line: 'The street smiles when you pass.', shape: 'heart', color: '#ff7a9a', need: 10, have: (c) => n(c.p.hellos) },
  { id: 'hello40', name: 'Mayor of hello', how: 'Say hello 40 times', line: 'Everybody knows your name by now.', shape: 'heart', color: '#ff4d8d', need: 40, have: (c) => n(c.p.hellos) },
  { id: 'everybody', name: 'Met everybody', how: 'Say hello to every named person', line: 'Every one of them, by name.', shape: 'star', color: '#ffb25b', need: CAST_IDS.length, have: met },
  { id: 'office', name: 'Hi, Shilo', how: 'Visit the office and say hi to Shilo', line: 'He was compiling. He waved anyway.', shape: 'bolt', color: '#4fd1ff', need: 1, have: (c) => n(c.p.shiloHi) },
  { id: 'ring', name: 'Found The Ring', how: 'Walk up to the court and see the ring', line: 'Gloves, ropes and a bell.', shape: 'ring', color: '#ff8a5b', need: 1, have: (c) => n(c.p.ringSeen) },
  { id: 'win1', name: 'First win', how: 'Win a fight', line: 'The first one is always sweet.', shape: 'star', color: '#ffb25b', need: 1, have: (c) => n(c.b.wins) },
  { id: 'win10', name: 'Ten wins', how: 'Win 10 fights', line: 'A proper boxer now.', shape: 'star', color: '#ff9f43', need: 10, have: (c) => n(c.b.wins) },
  { id: 'ko1', name: 'Lights out', how: 'Win a fight by a knock-out', line: 'Down, a count, and that was that.', shape: 'bolt', color: '#ff6b6b', need: 1, have: (c) => n(c.p.kos) },
  { id: 'ko5', name: 'Knock-out artist', how: 'Win 5 fights by knock-out', line: 'Five times the crowd gasped.', shape: 'bolt', color: '#ff6b6b', need: 5, have: (c) => n(c.p.kos) },
  { id: 'perfect1', name: 'Perfect!', how: 'Dash through a punch at the last moment', line: 'Time slowed down just for you.', shape: 'diamond', color: '#7de3ff', need: 1, have: (c) => n(c.p.perfect) },
  { id: 'perfect10', name: 'Slow-motion hero', how: 'Ten perfect dodges', line: 'The punches look like they are waving.', shape: 'diamond', color: '#7de3ff', need: 10, have: (c) => n(c.p.perfect) },
  { id: 'parry5', name: 'Parry master', how: 'Parry 5 punches (guard up just in time)', line: 'A little push and they stumble.', shape: 'shield', color: '#8ff0c0', need: 5, have: (c) => n(c.p.parries) },
  { id: 'flawless', name: 'Untouchable', how: 'Win a fight without being hit', line: 'Not a scratch. Not even a wrinkle.', shape: 'shield', color: '#8ff0c0', need: 1, have: (c) => n(c.p.flawless) },
  { id: 'combo6', name: 'Combo!', how: 'Land a combo of 6 hits', line: 'Jab, jab, cross, and more.', shape: 'bolt', color: '#ffd24d', need: 6, have: (c) => n(c.p.bestCombo) },
  { id: 'champion', name: 'The champion falls', how: 'Beat Coach, the champion', line: 'He shook your hand. Hard.', shape: 'star', color: '#ffd24d', need: 1, have: beaten('coach') },
  { id: 'boss', name: 'Out of the lights', how: 'Beat the one who waits in the ring', line: 'He buffered. You did not.', shape: 'diamond', color: '#b58cff', need: 1, have: beaten('shilo') },
  { id: 'level5', name: 'Level 5', how: 'Reach boxer level 5', line: 'The uppercut is yours now.', shape: 'ring', color: '#ff8a5b', need: 5, have: (c) => n(c.b.level) },
  { id: 'level10', name: 'Top of the ladder', how: 'Reach boxer level 10', line: 'Peach Fury, any time.', shape: 'ring', color: '#ff7a59', need: 10, have: (c) => n(c.b.level) },
  { id: 'love25', name: 'Liked', how: 'Make the neighbourhood love you (25)', line: 'People nod when they see you.', shape: 'heart', color: '#ff7a9a', need: 25, have: (c) => n(c.love) },
  { id: 'love50', name: 'Loved', how: 'Love of the neighbourhood: 50', line: 'People wave from windows.', shape: 'heart', color: '#ff5f8a', need: 50, have: (c) => n(c.love) },
  { id: 'love100', name: 'Beloved', how: 'Love of the neighbourhood: 100', line: 'They would throw you a parade. They might.', shape: 'heart', color: '#ff3b7a', need: 100, have: (c) => n(c.love) },
  { id: 'golden6', name: 'Peach hunter', how: 'Find 6 golden peaches', line: 'They hum when you are close.', shape: 'peach', color: '#ffd24d', need: 6, have: (c) => n(c.golden) },
  { id: 'golden12', name: 'Golden orchard', how: 'Find all 12 golden peaches', line: 'Not one left on the trees.', shape: 'peach', color: '#ffc21a', need: 12, have: (c) => n(c.golden) },
  { id: 'drive1', name: 'Road trip', how: 'Drive a kilometre in his car', line: 'The car says thank you. Quietly.', shape: 'ring', color: '#9bb4ff', need: 1000, have: (c) => n(c.p.driven) },
  { id: 'arcade3', name: 'Office champion', how: 'Play every game on the office computer', line: 'Work can wait. Mostly.', shape: 'diamond', color: '#7fffb0', need: GAMES.length, have: playedAll },
  { id: 'blocks1000', name: 'Block party', how: 'Score 1000 in BLOCKS', line: 'The lines just kept clearing.', shape: 'diamond', color: '#7fffb0', need: 1000, have: arcadeBest('tetris') },
  { id: 'snake300', name: 'Peach eater', how: 'Score 300 in SNAKE', line: 'Long, green and very happy.', shape: 'peach', color: '#7fffb0', need: 300, have: arcadeBest('snake') },
  { id: 'days3', name: 'Three days in', how: 'Live three days in the neighbourhood', line: 'It already feels like home.', shape: 'ring', color: '#ffb25b', need: 3, have: (c) => Math.max(0, n(c.day) - 1) },
  { id: 'saved500', name: 'Saving up', how: 'Earn 500 peaches in all', line: 'A very peachy pocket.', shape: 'peach', color: '#ff9f43', need: 500, have: (c) => n(c.lifetime) },
  { id: 'story', name: 'A tree of his own', how: 'Follow the clues all the way to the park', line: 'The neighbours planted it for you.', shape: 'peach', color: '#ffb25b', need: 1, have: (c) => n(c.p.storyEnd) },
  { id: 'barista', name: 'Barista', how: 'Serve 12 customers in one Coffee Rush', line: 'Roee wants to hire you. Properly.', shape: 'ring', color: '#c98a4b', need: 12, have: (c) => n(c.p.cafeBestServed) },
  { id: 'courier', name: 'Courier', how: 'Deliver 3 parcels for Uzi', line: 'Dov says you are almost as fast as him.', shape: 'bolt', color: '#9bb4ff', need: 3, have: (c) => n(c.p.parcels) },
  { id: 'wishes5', name: 'Wish granted', how: 'Finish 5 of the daily wishes', line: 'Small wishes, one after another.', shape: 'peach', color: '#ffd24d', need: 5, have: (c) => n(c.p.wishDone) },
  { id: 'fullday', name: 'A full day', how: 'Finish all three wishes of one day', line: 'Three out of three. What a day.', shape: 'heart', color: '#ff9fc4', need: 1, have: (c) => n(c.p.wishDays) },
  { id: 'events4', name: 'Town regular', how: 'Enjoy 4 of the little events of the city', line: 'The street feels like your living room.', shape: 'star', color: '#7de3ff', need: 4, have: (c) => n(c.p.evCount) },
  { id: 'explorer', name: 'Explorer', how: 'Collect 10 stamps in the stamp book', line: 'You know every door by now.', shape: 'ring', color: '#9bb4ff', need: 10, have: (c) => stampCount(c.p) },
  { id: 'gifts5', name: 'Dear to the neighbours', how: 'Receive 5 gifts from the neighbours', line: 'They keep a little something for you.', shape: 'heart', color: '#ff9f5b', need: 5, have: (c) => giftCount(c.p) },
  { id: 'giftsall', name: 'Everybody\'s friend', how: 'Receive a gift from all 21 neighbours', line: 'Your pockets are full of kindness.', shape: 'star', color: '#ffd24d', need: GIFT_IDS.length, have: (c) => giftCount(c.p) },
  { id: 'purr', name: 'First purr', how: 'Pet a street cat (Space next to it)', line: 'Small, serious and very warm.', shape: 'heart', color: '#ffc58a', need: 1, have: (c) => catPetted(c.p) },
  { id: 'catperson', name: 'Cat person', how: 'Make friends with all three street cats', line: 'They wait for you by the bench.', shape: 'star', color: '#ffb26b', need: 3, have: (c) => catFriends(c.p) },
  { id: 'cup1', name: 'Sababa Cup rookie', how: 'Win a race of the Sababa Cup', line: 'The first trophy is for the garage wall.', shape: 'bolt', color: '#7fb6ff', need: 1, have: (c) => EVENT_IDS.filter((k) => (c.p.leagueWon || {})[k]).length },
  { id: 'openchamp', name: 'Sababa Open champion', how: 'Win the three fights of the Sababa Open in one night', line: 'One night, three gloves, one very loud cheer.', shape: 'star', color: '#ff6a3d', need: 1, have: (c) => n(c.p.openWins) },
  { id: 'roadtrip', name: 'Road tripper', how: 'Win a cup out of town', line: 'A long drive, a short trophy shelf.', shape: 'bolt', color: '#2fb8d8', need: 1, have: (c) => EVENT_IDS.filter((k) => (c.p.leagueWon || {})[k]).length },
  { id: 'cupall', name: 'Champion of the Cup', how: 'Win every cup out of town', line: 'Uzi takes a photo for the wall.', shape: 'star', color: '#9b6bff', need: EVENT_IDS.length, have: (c) => EVENT_IDS.filter((k) => (c.p.leagueWon || {})[k]).length },
  { id: 'photographer', name: 'Photographer', how: 'Take photos in 5 different places (V)', line: 'The neighbourhood looks good on film.', shape: 'ring', color: '#ffd9a0', need: 5, have: (c) => Object.keys(c.p.photoPlaces || {}).filter((k) => c.p.photoPlaces[k]).length },
  { id: 'stampbook', name: 'Full stamp book', how: 'Collect all 14 stamps, the open places too', line: 'Every door, the bus stop and the sea.', shape: 'star', color: '#ff9f43', need: STAMPS.length, have: (c) => stampCount(c.p) },
];

/** Every trophy with where it stands: [{ id, name, how, line, shape, color, need, have (capped at need), done }]. `earned` = the ids already on the save (they stay earned). */
export function evaluate(ctx, earned = []) {
  const got = new Set(earned);
  return TROPHIES.map((t) => {
    const have = Math.max(0, t.have(ctx));
    const done = got.has(t.id) || have >= t.need;
    return { id: t.id, name: t.name, how: t.how, line: t.line, shape: t.shape, color: t.color, need: t.need, have: done ? t.need : Math.min(t.need, have), done };
  });
}

/** The trophies that are done now but not on the save yet. */
export function newTrophies(ctx, earned = []) {
  const got = new Set(earned);
  return evaluate(ctx, earned).filter((t) => t.done && !got.has(t.id));
}
