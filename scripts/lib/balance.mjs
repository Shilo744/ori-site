// "Ori, Can You...?" — the balance lab's engine (pure sim, no browser): plays many bouts with scripted bots and tabulates win rate, fight length, knock-downs and damage per
// opponent x level x bot. Used by scripts/balance-lab.mjs (the report) and by test-favors-boxing.mjs (the difficulty must climb with the ladder and fall with the levels).
import { createBout, botInput } from '../../src/game3d/favors/boxing.js';
import { LADDER, BOSS } from '../../src/game3d/favors/fight-content.js';
import { mulberry32 } from '../../src/game3d/rng.js';

const DT = 1 / 60;
/** The two kinds of player: one who reads the wind-ups and guards, and one who only mashes the punch keys. */
export const BOTS = { careful: { skill: 0.75, aggression: 0.6 }, masher: { mash: true, aggression: 1.4 } };
export const OPPONENTS = [...LADDER, BOSS];

/** One bout to its end (or `max` seconds): { won, time, how, downs (the player's knock-downs), taken (damage the player took) }. */
export function playBout(opp, level, bot, seed, max = 120) {
  const b = createBout({ level, opp, seed });
  const rnd = mulberry32(seed * 977 + 3);
  for (let t = 0; t < max && !b.over; t += DT) { b.update(DT, botInput(b, rnd, bot)); b.drain(); }
  const r = b.result;
  return { won: !!r && r.winner === 'player', time: r ? r.time : max, how: r ? r.how : 'time', downs: b.P.downs, taken: b.stats.taken };
}

/** `runs` bouts of one cell: { win (0..1), time (seconds, wins only), ko (0..1 of the wins), downs, taken }. */
export function runCell(opp, level, botName, runs) {
  let w = 0; let t = 0; let ko = 0; let downs = 0; let taken = 0;
  for (let s = 1; s <= runs; s++) {
    const r = playBout(opp, level, BOTS[botName], s);
    if (r.won) { w++; t += r.time; if (r.how === 'ko') ko++; }
    downs += r.downs; taken += r.taken;
  }
  return { win: w / runs, time: w ? t / w : 0, ko: w ? ko / w : 0, downs: downs / runs, taken: taken / runs };
}

/** { opponents: [ids], levels, bots, cells: { bot: { opp: { level: cell } } } } */
export function runGrid({ runs = 12, levels = [1, 3, 5, 8, 10], bots = Object.keys(BOTS), opponents = OPPONENTS } = {}) {
  const cells = {};
  for (const bot of bots) {
    cells[bot] = {};
    for (const o of opponents) { cells[bot][o.id] = {}; for (const lv of levels) cells[bot][o.id][lv] = runCell(o, lv, bot, runs); }
  }
  return { opponents: opponents.map((o) => o.id), levels, bots, cells, runs };
}

/**
 * The difficulty must make sense: at one level a later opponent never beats the player's bot clearly more often than an earlier one (`ladder`), and
 * one opponent never gets clearly harder as the player levels up (`level`). `tol` = the win rate it may wobble by (a few bouts per cell are noise).
 */
export function violations(grid, tol = 0.2) {
  const out = [];
  for (const bot of grid.bots) {
    for (const lv of grid.levels) {
      for (let i = 1; i < grid.opponents.length; i++) {
        const a = grid.cells[bot][grid.opponents[i - 1]][lv].win; const b = grid.cells[bot][grid.opponents[i]][lv].win;
        if (b > a + tol) out.push({ kind: 'ladder', bot, level: lv, easier: grid.opponents[i], than: grid.opponents[i - 1], from: a, to: b });
      }
    }
    for (const o of grid.opponents) {
      for (let j = 1; j < grid.levels.length; j++) {
        const a = grid.cells[bot][o][grid.levels[j - 1]].win; const b = grid.cells[bot][o][grid.levels[j]].win;
        if (b < a - tol) out.push({ kind: 'level', bot, opp: o, from: grid.levels[j - 1], to: grid.levels[j], was: a, now: b });
      }
    }
  }
  return out;
}

const pct = (v) => `${Math.round(v * 100)}%`;
/** The report: one table per bot (rows = opponents, columns = levels: win rate, average time of the wins, knock-downs suffered). */
export function toMarkdown(grid, viol = []) {
  const L = [`# Balance lab (${grid.runs} bouts per cell, seeds 1..${grid.runs}, pure sim)`, '', 'Each cell: win rate / average length of the wins / knock-downs the player suffers per bout. "careful" reads wind-ups, guards and counters; "masher" only hits the punch keys.', ''];
  for (const bot of grid.bots) {
    L.push(`## ${bot}`, '', `| opponent | ${grid.levels.map((l) => `Lv ${l}`).join(' | ')} |`, `|---|${grid.levels.map(() => '---').join('|')}|`);
    for (const o of grid.opponents) L.push(`| ${o} | ${grid.levels.map((lv) => { const c = grid.cells[bot][o][lv]; return `${pct(c.win)} / ${c.win ? `${c.time.toFixed(0)}s` : '-'} / ${c.downs.toFixed(1)}`; }).join(' | ')} |`);
    L.push('');
  }
  L.push(viol.length ? `## Odd spots (${viol.length})` : '## Odd spots: none', '');
  for (const v of viol) L.push(v.kind === 'ladder' ? `- ${v.bot} at Lv ${v.level}: ${v.easier} is EASIER than ${v.than} (${pct(v.to)} vs ${pct(v.from)})` : `- ${v.bot}: ${v.opp} gets HARDER from Lv ${v.from} to Lv ${v.to} (${pct(v.was)} -> ${pct(v.now)})`);
  return `${L.join('\n')}\n`;
}
