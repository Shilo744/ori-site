// "Ori, Can You...?" — Ori the boxer (PURE): levels, what each level gives, which moves it unlocks. XP comes from fights (and a little from training);
// nothing is ever taken away. The numbers feed boxing.js (the fight itself).
export const MAX_LEVEL = 10;

/** XP to climb from `level` to the next one. */
export const xpToNext = (level) => 60 + 40 * (level - 1) + 5 * (level - 1) ** 2;

/** The body of a boxer of this level (a fresh boxer is Lv 1). */
export function statsFor(level = 1) {
  const l = Math.max(1, Math.min(MAX_LEVEL, level)) - 1;
  return {
    level: l + 1,
    maxHp: 180 + 20 * l,
    maxSt: 100 + 7 * l,
    dmg: 1 + 0.075 * l, // punch power
    speed: 1 + 0.025 * l, // how quick he moves
    atk: 1 + 0.03 * l, // how quick his hands are
    regen: 1 + 0.05 * l, // how fast the breath comes back
    unlocks: unlocksAt(l + 1),
  };
}

/** The moves of Ori by the level that opens them (the keys: J jab, K cross, hold L / Shift guard, Space dash; the rest come from the combinations). */
export const MOVE_LIST = [
  { id: 'jab', lv: 1, name: 'Jab', how: 'J' },
  { id: 'cross', lv: 1, name: 'Cross', how: 'K' },
  { id: 'block', lv: 1, name: 'Guard', how: 'Hold L or Shift' },
  { id: 'dash', lv: 1, name: 'Dash', how: 'Space' },
  { id: 'combo', lv: 2, name: 'Hook finisher', how: 'J, J, then K' },
  { id: 'counter', lv: 3, name: 'Counter', how: 'Dash just before a punch lands, then K' },
  { id: 'upper', lv: 4, name: 'Uppercut', how: 'J, J, J, then K' },
  { id: 'fury', lv: 6, name: 'Peach Fury', how: 'F when the meter glows' },
];
export const unlocksAt = (level) => Object.fromEntries(MOVE_LIST.map((m) => [m.id, level >= m.lv]));

/**
 * Adds XP to a boxer record { xp, level }: returns { level, xp, gained: [levels reached], moves: [newly opened moves] }.
 * `xp` counts only inside the current level (so the bar can be drawn straight from it).
 */
export function gainXp(rec, amount) {
  let { xp, level } = rec;
  const before = level;
  xp += Math.max(0, Math.round(amount));
  const gained = [];
  while (level < MAX_LEVEL && xp >= xpToNext(level)) { xp -= xpToNext(level); level++; gained.push(level); }
  if (level >= MAX_LEVEL) xp = Math.min(xp, xpToNext(MAX_LEVEL) - 1);
  rec.xp = xp;
  rec.level = level;
  const moves = MOVE_LIST.filter((m) => m.lv > before && m.lv <= level);
  return { level, xp, gained, moves };
}

export const xpProgress = (rec) => (rec.level >= MAX_LEVEL ? 1 : rec.xp / xpToNext(rec.level));
