// "Ori, Can You...?" — the Sababa Cup, a car racing league (PURE) [experimental] (Shilo's own idea): a ladder of seven rivals, each a person Ori knows with a car to match, from a neighbour's hatchback to Uzi's Beast. The race itself is the
// existing lap round the neighbourhood (missions.js raceMission, started as a quest from the board in Uzi's workshop); this file says who, how fast, what a win pays, and how driving earns XP and a driver level. A win pays the prize
// and the rival's XP and opens the next one (a rematch pays half); a loss pays a little XP and a kind word. The driver level opens the harder rivals and sharpens the car a little (the garage's upgrades, bought with peaches, do the rest).

/** The ladder. `aLat` = his grip in a turn (m/s²: how fast he carries a corner), `block` = how hard he defends his line against a car behind (0..1), `error` = how often he slips (0..1). `speed` = his pace on a straight in the old city lap (m/s; a cup gives its own); `prize` = peaches for a win; `xp` = driver XP for a win (a loss pays 30 % of it); `need` = the driver level needed to line up; `car` = what he drives (props-cars kind + colour). */
export const RIVALS = [
  { id: 'moti', name: 'Moti', title: 'The neighbour, in the family hatchback', color: '#e8c36a', rel: 'friends', car: { kind: 'hatch', color: 0xe8c36a }, speed: 13, aLat: 24, block: 0.1, error: 0.5, prize: 40, xp: 30, need: 1, line: 'I will go easy on you. Mostly.' },
  { id: 'albert', name: 'Albert', title: 'Kiosk 24/7, in the kiosk van', color: '#7fb6ff', rel: 'strangers', car: { kind: 'van', color: 0x7fb6ff }, speed: 14.5, aLat: 26, block: 0.2, error: 0.4, prize: 55, xp: 38, need: 1, line: 'Milk, gum, and now a very fast van.' },
  { id: 'roee', name: 'Roee', title: 'Best friend, in the cafe delivery car', color: '#c98a4b', rel: 'friends', car: { kind: 'hatch', color: 0x4a90e2 }, speed: 16, aLat: 28, block: 0.35, error: 0.3, prize: 75, xp: 46, need: 2, line: 'The slower one buys the coffee. I will say it was a joke.' },
  { id: 'dov', name: 'Dov', title: 'The courier, in the little red hatch', color: '#ff7a59', rel: 'strangers', car: { kind: 'hatch', color: 0xe94f3d }, speed: 17.5, aLat: 30, block: 0.5, error: 0.2, prize: 100, xp: 56, need: 2, line: 'You know my streets. I know them better.' },
  { id: 'maya', name: 'Maya', title: 'Perach coordinator, in the minivan', color: '#43b581', rel: 'perach', car: { kind: 'van', color: 0x43b581 }, speed: 19, aLat: 31, block: 0.6, error: 0.15, prize: 130, xp: 66, need: 3, line: 'Safest driver in town. Also the fastest minivan.' },
  { id: 'bossB', name: 'Noam', title: 'The CEO, in the electric sedan', color: '#2fb8d8', rel: 'work', car: { kind: 'sedan', color: 0x2fb8d8 }, speed: 20.5, aLat: 33, block: 0.7, error: 0.1, prize: 170, xp: 80, need: 4, line: 'Disrupting the lap record. Quietly.' },
  { id: 'uzi', name: 'Uzi', title: 'The mechanic, in the Beast', color: '#9b6bff', rel: 'hobbies', car: { kind: 'ori', color: 0x9b6bff }, speed: 22, aLat: 36, block: 0.9, error: 0.04, prize: 240, xp: 100, need: 5, line: 'I built your car. I built mine better.' },
];
export const RIVAL_IDS = RIVALS.map((r) => r.id);
/** Driver XP at which each driver level starts (level 1 at 0). */
export const LEVEL_XP = [0, 50, 130, 240, 380, 560, 780];
export const MAX_LEVEL = LEVEL_XP.length;
/** The top-speed bonus of the car per driver level above the first (x1.015 each). */
export const TOP_PER_LEVEL = 0.015;
/** A loss pays this part of the XP (and a few peaches); a win over somebody already beaten pays this part of the prize and the XP. */
export const LOSS_XP = 0.3;
export const LOSS_PRIZE = 10;
export const REMATCH = 0.5;

const rival = (id) => RIVALS.find((r) => r.id === id) || null;
export const rivalOf = rival;

/** The driver level for some XP, how far into it, and what the next one needs. */
export function levelOf(xp) {
  const x = Math.max(0, Math.floor(Number(xp) || 0));
  let level = 1;
  while (level < MAX_LEVEL && x >= LEVEL_XP[level]) level++;
  const from = LEVEL_XP[level - 1];
  const to = level >= MAX_LEVEL ? null : LEVEL_XP[level];
  return { level, xp: x, from, to, pct: to == null ? 100 : Math.round(((x - from) / (to - from)) * 100) };
}

/** What the car gets from the driver: a small bonus to the top speed (a multiplier, 1 at level 1). */
export const topBonus = (xp) => 1 + TOP_PER_LEVEL * (levelOf(xp).level - 1);

/** What a win is worth against this rival: a rematch (he is beaten already) pays half. */
const stakes = (r, beaten) => ({ prize: Math.round(r.prize * (beaten ? REMATCH : 1)), xp: Math.round(r.xp * (beaten ? REMATCH : 1)) });

/**
 * The board: one row per rival with where he stands for this driver. `won` = { id: true }.
 * state: 'won' (beaten, a star), 'next' (open: the one to race, or an older one to race again), 'locked' (needs the one before beaten, or a higher driver level).
 * `win` = what a win pays now (peaches and XP).
 */
export function board(xp, won = {}) {
  const lv = levelOf(xp).level;
  return RIVALS.map((r, i) => {
    const before = i === 0 || !!won[RIVALS[i - 1].id];
    const open = before && lv >= r.need;
    const beaten = !!won[r.id];
    const why = !before ? `Beat ${RIVALS[i - 1].name} first` : lv < r.need ? `Driver level ${r.need}` : '';
    return { ...r, n: i + 1, open, beaten, state: beaten ? 'won' : open ? 'next' : 'locked', why, win: stakes(r, beaten) };
  });
}

/** After a race: the XP and the prize it gave, whether it won, and the new level (and if that is a step up). `place` 1 = a win; `beaten` = he was beaten before (a rematch). */
export function result(xp, id, place, beaten = false) {
  const r = rival(id);
  if (!r) return null;
  const win = place === 1;
  const s = stakes(r, beaten);
  const gained = win ? s.xp : Math.round(r.xp * LOSS_XP);
  const after = levelOf(xp + gained);
  return { win, xp: gained, prize: win ? s.prize : LOSS_PRIZE, level: after.level, up: after.level > levelOf(xp).level, total: xp + gained };
}

/** The quest template of a rival (content.js adds these to its list): the existing race mission with his speed, his name, his car and the prize. `optional`: a race he chose and did not run costs nothing (quests.js). */
export const templateOf = (r) => ({
  id: `league-${r.id}`, rel: r.rel, giver: r.id, at: 'workshop', verb: 'handle', tone: 'trivial', setpiece: true, optional: true, rewardBoost: 0.1,
  title: `The Sababa Cup: race ${r.name}`, body: `${r.title}. One lap round the neighbourhood. ${r.line}`, doText: `Race ${r.name}`, win: [15, 19], mech: 'race', mins: 240,
  mp: { rival: r.speed, who: r.name, prize: r.prize, consolation: LOSS_PRIZE, car: r.car },
});
export const leagueTemplates = () => RIVALS.map(templateOf);
/** 'league-moti' -> 'moti'; anything else null. */
export const leagueIdOf = (tplId) => (typeof tplId === 'string' && /^league-[A-Za-z0-9]+$/.test(tplId) && rival(tplId.slice(7)) ? tplId.slice(7) : null);

// ───────────────────────── the cups out of town (Shilo: "tracks that are not inside the city, and not only one against one") ─────────────────────────
/** A cup: a whole field of rivals at once on a track far from the city (tracks.js). The PLACE decides the prize and the XP (arrays by place; a place beyond them pays the last / a consolation).
 * `need` = the driver level, `after` = the event or rival to have beaten first. */
export const EVENTS = [
  { id: 'speedway', name: 'Sababa Speedway', title: 'Two laps against four, out of town', track: 'speedway', laps: 2, rivals: ['moti', 'albert', 'roee', 'dov'], paces: [19, 20, 21, 22], need: 1, after: null, color: '#e5484d', prizes: [150, 90, 55, 30, 15], xp: [90, 60, 40, 25, 15], line: 'Tyres, flags and a very loud grandstand. Watch for cones and oil.' },
  { id: 'harbor', name: 'Old Port Sprint', title: 'Two laps against four, between the cranes', track: 'harbor', laps: 2, rivals: ['albert', 'roee', 'dov', 'maya'], paces: [21, 22.5, 24, 25.5], need: 2, after: 'speedway', color: '#ff8a3d', prizes: [230, 140, 85, 50, 25], xp: [120, 80, 55, 35, 20], line: 'Tight corners, tyre walls and a lot of containers.' },
  { id: 'coast', name: 'Coast Road Cup', title: 'Two laps against five, by the sea', track: 'coast', laps: 2, rivals: ['roee', 'dov', 'maya', 'bossB', 'uzi'], paces: [22, 23, 24, 25, 26], need: 3, after: 'speedway', color: '#2fb8d8', prizes: [320, 190, 120, 70, 40, 20], xp: [180, 120, 80, 55, 35, 20], line: 'The long way round, with the windows down.' },
  { id: 'ridge', name: 'Ridge Run', title: 'Two laps against six, up in the hills', track: 'ridge', laps: 2, rivals: ['albert', 'roee', 'dov', 'maya', 'bossB', 'uzi'], paces: [21, 22.5, 24, 25.5, 27, 28.5], need: 5, after: 'coast', color: '#f2c14e', prizes: [480, 290, 180, 110, 70, 40, 20], xp: [260, 170, 120, 85, 60, 40, 25], line: 'Hairpins, boulders and the whole town watching from below.' },
];
export const EVENT_IDS = EVENTS.map((e) => e.id);
export const eventOf = (id) => EVENTS.find((e) => e.id === id) || null;
const ord = (n) => ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th'][n] || `${n}th`;
const evPay = (e) => `1st ${e.prizes[0]} · 2nd ${e.prizes[1]} · 3rd ${e.prizes[2]} peaches`;

/** The cups for the board, numbered 1, 2, 3... state: 'won' (he came first once), 'next' (open), 'locked' (says why). */
export function eventBoard(xp, won = {}) {
  const lv = levelOf(xp).level;
  return EVENTS.map((e, i) => {
    const beaten = !!won[e.id];
    const done = !e.after || !!won[e.after];
    const open = lv >= e.need && done;
    const why = !done ? `Beat ${rival(e.after) ? rival(e.after).name : (eventOf(e.after) || { name: e.after }).name} first` : lv < e.need ? `Driver level ${e.need}` : '';
    return { ...e, n: i + 1, event: true, open, beaten, state: beaten ? 'won' : open ? 'next' : 'locked', why, pay: evPay(e), win: { prize: e.prizes[0], xp: e.xp[0] }, field: e.rivals.length + 1 };
  });
}

/** After a cup: the XP and the prize of the place he came in, whether he won, and the new level. */
export function eventResult(xp, id, place) {
  const e = eventOf(id);
  if (!e) return null;
  const p = Math.max(1, Math.floor(Number(place) || e.rivals.length + 1));
  const gained = e.xp[p - 1] ?? Math.round(e.xp[e.xp.length - 1] * 0.5);
  const after = levelOf(xp + gained);
  return { win: p === 1, place: p, field: e.rivals.length + 1, xp: gained, prize: e.prizes[p - 1] ?? LOSS_PRIZE, level: after.level, up: after.level > levelOf(xp).level, total: xp + gained };
}
/** What he is told when it is over: "Second of five" and so on. */
export const placeLine = (name, place, field) => (place === 1 ? `you won the ${name}!` : `${ord(place)} of ${field} at the ${name}.`);

export const eventTemplate = (e) => ({
  id: `cup-${e.id}`, rel: 'hobbies', giver: 'uzi', at: 'workshop', verb: 'handle', tone: 'trivial', setpiece: true, optional: true, rewardBoost: 0.1,
  title: `The Sababa Cup: ${e.name}`, body: `${e.title}. ${e.line}`, doText: `Race the ${e.name}`, win: [15, 19], mech: 'race', mins: 300,
  mp: { track: e.track, laps: e.laps, cup: e.name, rivals: e.rivals.map((id, k) => ({ who: rival(id).name, speed: e.paces[k], aLat: rival(id).aLat, block: rival(id).block, error: rival(id).error, car: rival(id).car })), prizes: e.prizes, consolation: LOSS_PRIZE },
});
export const eventTemplates = () => EVENTS.map(eventTemplate);
/** 'cup-speedway' -> 'speedway'; anything else null. */
export const eventIdOf = (tplId) => (typeof tplId === 'string' && tplId.startsWith('cup-') && eventOf(tplId.slice(4)) ? tplId.slice(4) : null);

// ───────────────────────── the Sababa Open: a night of three fights in the ring (boxing) ─────────────────────────
/** Three fights in one night: the three strongest fighters he can face, one after the other; each starts with what was left plus `heal`; the whole night pays a purse and a trophy. */
export const OPEN = { id: 'open', name: 'Sababa Open', title: 'Three fights in one night, in the ring', color: '#ff6a3d', line: 'Gloves on: the whole card, one after the other.', purse: { peaches: 150, xp: 80 }, heal: 0.4, labels: ['QUARTER-FINAL', 'SEMI-FINAL', 'FINAL'] };
/** The row of the night on the board (after the cups): open when he can face three fighters. */
export const openRow = (avail) => ({ ...OPEN, n: EVENTS.length + 1, event: true, ring: true, open: !!avail, beaten: false, state: avail ? 'next' : 'locked', why: 'Climb the ladder at The Ring first', pay: `Three fights · +${OPEN.purse.peaches} peaches and a trophy for the night`, win: { prize: OPEN.purse.peaches, xp: OPEN.purse.xp }, field: 4 });
