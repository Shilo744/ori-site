// "Ori, Can You...?" — the career numbers (pure): counted after every fight, saved with the game, shown in the journal.      node scripts/test-favors-career.mjs
import assert from 'node:assert/strict';
import { tallyFight, careerStats } from '../src/game3d/favors/career.js';
import { sanitizeSave } from '../src/game3d/favors/save.js';
import { createCampaign, safeStorage } from '../src/game3d/favors/campaign.js';
import { GOLDEN } from '../src/game3d/favors/play-content.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const mem = () => { const d = {}; return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } }; };
const win = (extra = {}) => ({ winner: 'player', how: 'ko', stats: { perfect: 2, parry: 1, hits: 14, maxCombo: 4, ...extra } });

test('a fight adds to the counters; a knock-out only counts when Ori wins it; the best combo is a maximum, not a sum', () => {
  const p = {};
  tallyFight(p, win());
  assert.deepEqual({ kos: p.kos, perfect: p.perfect, parries: p.parries, landed: p.landed, bestCombo: p.bestCombo }, { kos: 1, perfect: 2, parries: 1, landed: 14, bestCombo: 4 });
  tallyFight(p, { winner: 'opp', how: 'ko', stats: { perfect: 1, parry: 0, hits: 5, maxCombo: 2 } });
  assert.equal(p.kos, 1, 'losing by a knock-out is not a knock-out of his');
  tallyFight(p, { winner: 'player', how: 'time', stats: { perfect: 0, parry: 3, hits: 9, maxCombo: 7 } });
  assert.equal(p.kos, 1, 'a win on points is not a knock-out');
  assert.deepEqual({ perfect: p.perfect, parries: p.parries, landed: p.landed, bestCombo: p.bestCombo }, { perfect: 3, parries: 4, landed: 28, bestCombo: 7 });
  tallyFight(p, win({ maxCombo: 3 }));
  assert.equal(p.bestCombo, 7, 'a lower combo never lowers the best');
});

test('odd results never throw and never take anything away', () => {
  const p = { kos: 3, perfect: 5 };
  for (const bad of [undefined, null, {}, { stats: null }, { winner: 'player', how: 'ko', stats: { perfect: -4, parry: NaN, hits: 'x', maxCombo: Infinity } }]) tallyFight(p, bad);
  assert.ok(p.perfect >= 5 && p.kos >= 3 && Number.isFinite(p.bestCombo) && Number.isFinite(p.landed));
});

test('the journal page: eleven numbers in a fixed order, "-" where nothing happened yet', () => {
  const fresh = careerStats({});
  assert.deepEqual(fresh.map((s) => s.id), ['fights', 'kos', 'perfect', 'parries', 'combo', 'hellos', 'arcade', 'days', 'peaches', 'golden', 'events']);
  assert.equal(fresh.find((s) => s.id === 'combo').value, '-');
  assert.equal(fresh.find((s) => s.id === 'arcade').value, '-');
  assert.equal(fresh.find((s) => s.id === 'fights').value, '0 / 0');
  assert.equal(fresh.find((s) => s.id === 'golden').value, `0 / ${GOLDEN.length}`);
  const p = tallyFight({ hellos: 21, best: { tetris: 1200, '2048': 4096 } }, win());
  const s = careerStats({ boxer: { wins: 7, fights: 9 }, progress: p, day: 4, golden: 3, lifetime: 900 });
  const by = Object.fromEntries(s.map((x) => [x.id, x.value]));
  assert.equal(by.fights, '7 / 9'); assert.equal(by.kos, '1'); assert.equal(by.combo, '4 hits'); assert.equal(by.hellos, '21'); assert.equal(by.days, '4'); assert.equal(by.peaches, '900');
  assert.match(by.arcade, /BLOCKS 1200/); assert.match(by.arcade, /2048 4096/);
  for (const x of s) assert.ok(typeof x.label === 'string' && x.label.length > 2 && typeof x.value === 'string', x.id);
});

test('the counters live in the save: a saved game brings them back, and an import too', () => {
  const st = mem();
  const c = createCampaign({ storage: safeStorage(st), fresh: true });
  tallyFight(c.state.progress, win());
  tallyFight(c.state.progress, win({ maxCombo: 9 }));
  c.save();
  const d = createCampaign({ storage: safeStorage(st) });
  assert.equal(d.state.progress.kos, 2); assert.equal(d.state.progress.perfect, 4); assert.equal(d.state.progress.bestCombo, 9); assert.equal(d.state.progress.landed, 28);
  const e = createCampaign({ storage: safeStorage(mem()), fresh: true });
  assert.ok(e.importCode(c.exportCode()).ok);
  assert.equal(e.state.progress.kos, 2); assert.equal(e.state.progress.bestCombo, 9);
  assert.equal(sanitizeSave({ progress: { kos: -4, bestCombo: 'x' } }).progress.kos, 0, 'junk is clamped');
});

console.log(`${n} career tests passed`);
