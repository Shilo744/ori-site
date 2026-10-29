// "Ori, Can You...?" — every sound of the ring as a list: what it is called in the sound lab (public/soundlab.html), how to play it on a createFightSfx(), how long to render
// it offline, and what the measurements (scripts/sound-render.mjs) must find: how long it lasts, how loud it is (A-weighted dBFS over its active part), where its energy is.
// `expect` is the design intent in numbers, so the sound can be judged without ears: a punch must have weight (a low band) and snap (a high band), a block must be softer and duller
// than a hit, a bell must ring for seconds, a whoosh must peak at the strike...
//   expect.dur = [min, max] seconds until the sound has fallen 50 dB   expect.loud = [min, max] dBFS(A)   expect.band = [lo Hz, hi Hz, min share]   expect.max = [lo, hi, max share]
//   expect.centroid = [min, max] Hz   expect.peakAt = [min, max] seconds (where the loudest moment is)
//   LOUD[id] = how loud it should feel: the loudest 200 ms, A-weighted, in dBFS (the renderer allows +-4 dB; --suggest prints the trim each sound needs)

const hit = (dmg, extra = {}) => ({ dmg, heavy: dmg >= 13, combo: 1, counter: false, target: 'opp', ...extra });

export const SOUNDS = [
  // ── punches that land ──
  { id: 'hit-jab', group: 'Punches that land', label: 'Jab lands (8 damage)', len: 1.2, play: (s) => s.thud(hit(8)), expect: { dur: [0.1, 0.9], centroid: [300, 1800] } },
  { id: 'hit-cross', group: 'Punches that land', label: 'Cross lands (17)', len: 1.2, play: (s) => s.thud(hit(17)), expect: { dur: [0.25, 1.1], band: [30, 500, 0.35] } },
  { id: 'hit-hook', group: 'Punches that land', label: 'Hook lands (22, combo 3)', len: 1.4, play: (s) => s.thud(hit(22, { combo: 3 })), expect: { dur: [0.3, 1.2], band: [30, 500, 0.35] } },
  { id: 'hit-upper', group: 'Punches that land', label: 'Uppercut lands (31)', len: 1.5, play: (s) => s.thud(hit(31, { combo: 4 })), expect: { dur: [0.35, 1.4], band: [30, 500, 0.35] } },
  { id: 'hit-counter', group: 'Punches that land', label: 'COUNTER lands (33, gold number)', len: 1.5, play: (s) => s.thud(hit(33, { counter: true, combo: 2 })), expect: { dur: [0.35, 1.5], band: [30, 500, 0.35] } },
  { id: 'hit-you', group: 'Punches that land', label: 'Ori takes a hit (12)', len: 1.2, play: (s) => s.thud(hit(12, { target: 'player' })), expect: { dur: [0.1, 1.0] } },
  { id: 'hit-slowmo', group: 'Punches that land', label: 'Hit in slow motion (dull)', len: 1.2, play: (s) => { s.setSlow(true); s.thud(hit(17)); }, expect: { max: [2000, 20000, 0.02], band: [35, 400, 0.5] } },
  // ── punches thrown ──
  { id: 'whoosh-jab', group: 'Punches thrown', label: 'Whoosh: Ori jab (wind-up 0.12 s)', len: 0.6, play: (s) => s.whoosh(0.12, 0.45, true), expect: { dur: [0.1, 0.45], centroid: [600, 5000], peakAt: [0.08, 0.2] } },
  { id: 'whoosh-cross', group: 'Punches thrown', label: 'Whoosh: opponent cross (0.38 s)', len: 0.9, play: (s) => s.whoosh(0.38, 0.8, false), expect: { dur: [0.25, 0.7], centroid: [600, 5000], peakAt: [0.3, 0.46] } },
  { id: 'whoosh-upper', group: 'Punches thrown', label: 'Whoosh: opponent uppercut (0.55 s)', len: 1.1, play: (s) => s.whoosh(0.55, 1.0, false), expect: { dur: [0.4, 0.85], centroid: [500, 5000], peakAt: [0.45, 0.65] } },
  { id: 'dash', group: 'Punches thrown', label: 'Dash', len: 0.7, play: (s) => s.dash(), expect: { dur: [0.12, 0.5], centroid: [400, 4500] } },
  { id: 'feint', group: 'Punches thrown', label: 'Feint (a pulled punch)', len: 0.5, play: (s) => s.feint(), expect: { dur: [0.06, 0.3] } },
  // ── defence ──
  { id: 'block-light', group: 'Defence', label: 'Block: jab on the guard', len: 0.9, play: (s) => s.block(0.9), expect: { dur: [0.08, 0.6], max: [3000, 20000, 0.04] } },
  { id: 'block-heavy', group: 'Defence', label: 'Block: cross on the guard', len: 0.9, play: (s) => s.block(3.4), expect: { dur: [0.1, 0.7], max: [3000, 20000, 0.04] } },
  { id: 'parry', group: 'Defence', label: 'PARRY (bright ting)', len: 1.4, play: (s) => s.parry(), expect: { dur: [0.3, 1.2], centroid: [1200, 6000] } },
  { id: 'perfect', group: 'Defence', label: 'PERFECT dodge (chime + time warp)', len: 1.4, play: (s) => s.perfect(), expect: { dur: [0.3, 1.3], centroid: [700, 5000] } },
  { id: 'guardbreak', group: 'Defence', label: 'Guard broken', len: 1.0, play: (s) => s.guardbreak(), expect: { dur: [0.15, 0.9] } },
  // ── the fight ──
  { id: 'bell-1', group: 'The fight', label: 'Bell x1', len: 4.0, play: (s) => s.bell(1), expect: { dur: [1.5, 4.0], centroid: [800, 6000] } },
  { id: 'bell-2', group: 'The fight', label: 'Bell x2 (FIGHT!)', len: 4.2, play: (s) => s.bell(2), expect: { dur: [1.6, 4.2], centroid: [800, 6000] } },
  { id: 'bell-3', group: 'The fight', label: 'Bell x3 (the end)', len: 4.5, play: (s) => s.bell(3), expect: { dur: [1.8, 4.5], centroid: [800, 6000] } },
  { id: 'ko-opp', group: 'The fight', label: 'K.O. - Moti goes down (then the cheer)', len: 3.6, play: (s) => { s.ko('opp'); }, expect: { dur: [0.7, 3.4] } },
  { id: 'knockdown', group: 'The fight', label: 'Knock-down (DOWN!)', len: 2.0, play: (s) => s.knockdown('opp'), expect: { dur: [0.4, 1.8] } },
  { id: 'count-1', group: 'The fight', label: 'Referee count 1', len: 0.6, play: (s) => s.count(1), expect: { dur: [0.06, 0.5] } },
  { id: 'count-5', group: 'The fight', label: 'Referee count 5', len: 0.6, play: (s) => s.count(5), expect: { dur: [0.06, 0.5] } },
  { id: 'getup', group: 'The fight', label: 'Getting up', len: 1.0, play: (s) => s.getup('opp'), expect: { dur: [0.3, 0.9] } },
  { id: 'fury', group: 'The fight', label: 'Peach Fury', len: 1.2, play: (s) => s.fury(), expect: { dur: [0.4, 1.1] } },
  { id: 'blink', group: 'The fight', label: 'Boss blink (glitch)', len: 0.9, play: (s) => s.blink(), expect: { dur: [0.2, 0.8] } },
  { id: 'lag', group: 'The fight', label: 'Boss buffering', len: 1.0, play: (s) => s.lag(), expect: { dur: [0.2, 0.8] } },
  // ── the crowd ──
  { id: 'gasp', group: 'The crowd', label: 'Crowd: ooh (big hit)', len: 1.4, play: (s) => s.gasp(1), expect: { dur: [0.3, 1.2], centroid: [300, 3500] } },
  { id: 'cheer', group: 'The crowd', label: 'Crowd cheers', len: 3.2, play: (s) => s.cheer(1), expect: { dur: [0.8, 3.0], centroid: [600, 4500] } },
  { id: 'cheer-big', group: 'The crowd', label: 'Crowd goes wild (K.O.)', len: 3.6, play: (s) => s.cheer(1.4), expect: { dur: [1.0, 3.4], centroid: [600, 4500] } },
  { id: 'crowd-low', group: 'The crowd', label: 'Murmur bed, love 10', len: 5, from: 2, play: (s) => s.crowdStart(10), expect: { centroid: [300, 2500] } },
  { id: 'crowd-high', group: 'The crowd', label: 'Murmur bed, love 90', len: 5, from: 2, play: (s) => s.crowdStart(90), expect: { centroid: [300, 2500] } },
  // ── small ones ──
  { id: 'level', group: 'Small ones', label: 'Level up', len: 2.4, play: (s) => s.level(), expect: { dur: [0.8, 2.2], centroid: [700, 5000] } },
  { id: 'tick', group: 'Small ones', label: 'Tick', len: 0.3, play: (s) => s.tick(), expect: { dur: [0.02, 0.2] } },
  { id: 'bag-hit', group: 'Small ones', label: 'Speed bag: smack', len: 0.7, play: (s) => s.bagHit(1), expect: { dur: [0.08, 0.5] } },
  { id: 'bag-glance', group: 'Small ones', label: 'Speed bag: brush', len: 0.4, play: (s) => s.bagGlance(), expect: { dur: [0.02, 0.25] } },
  { id: 'click', group: 'Small ones', label: 'Count-in click', len: 0.3, play: (s) => s.click(true), expect: { dur: [0.02, 0.2] } },
];

/** The music, rendered offline: `bars` bars at a layer level 0..3 (boss = the hidden fight). */
export const MUSIC = [
  { id: 'music-fight-0', label: 'Fight music, layer 0 (kick, hats, bass)', boss: false, level: 0, bars: 8 },
  { id: 'music-fight-1', label: 'Fight music, layer 1 (+ snare, open hats, stabs)', boss: false, level: 1, bars: 8 },
  { id: 'music-fight-2', label: 'Fight music, layer 2 (+ arp, crash)', boss: false, level: 2, bars: 8 },
  { id: 'music-fight-3', label: 'Fight music, layer 3 (+ lead, fills) - full on', boss: false, level: 3, bars: 8 },
  { id: 'music-boss-1', label: 'Boss music, layer 1 (glitch)', boss: true, level: 1, bars: 8 },
  { id: 'music-boss-3', label: 'Boss music, layer 3 (full glitch)', boss: true, level: 3, bars: 8 },
];

/** The stings after the fight (played through the music bus). */
export const STING_LIST = [
  { id: 'sting-win', label: 'Sting: you win', kind: 'win', len: 3.0 },
  { id: 'sting-lose', label: 'Sting: next time', kind: 'lose', len: 2.4 },
  { id: 'sting-boss', label: 'Sting: the boss falls', kind: 'boss', len: 3.2 },
];

/** The loudness hierarchy of the ring (dBFS, A-weighted, loudest 200 ms): the K.O. and the bell are the biggest things, a jab is small, a block softer than the blow, the whoosh is a warning under the blow, the crowd bed a whisper. */
export const LOUD = {
  'hit-jab': -25.5, 'hit-cross': -24.5, 'hit-hook': -22.5, 'hit-upper': -20.5, 'hit-counter': -20, 'hit-you': -24.5, 'hit-slowmo': -25,
  'whoosh-jab': -33, 'whoosh-cross': -28, 'whoosh-upper': -26, dash: -29, feint: -35,
  'block-light': -28, 'block-heavy': -26, parry: -22, perfect: -24, guardbreak: -22,
  'bell-1': -18, 'bell-2': -16.5, 'bell-3': -16.5, 'ko-opp': -17, knockdown: -20.5, 'count-1': -28, 'count-5': -26, getup: -30, fury: -25, blink: -27, lag: -32,
  gasp: -28, cheer: -26, 'cheer-big': -24, 'crowd-low': -50, 'crowd-high': -42,
  level: -24, tick: -38, 'bag-hit': -26, 'bag-glance': -40, click: -34,
  'music-fight-0': -38, 'music-fight-1': -31, 'music-fight-2': -30, 'music-fight-3': -29, 'music-boss-1': -31.5, 'music-boss-3': -29.5,
  'sting-win': -24, 'sting-lose': -28, 'sting-boss': -24,
};
