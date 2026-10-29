// "Ori, Can You...?" — the money and the week (pure): pay, the garage, perks, the save slot, the party.      node scripts/test-favors-economy.mjs
import assert from 'node:assert/strict';
import { createEconomy, perksFor, payFor } from '../src/game3d/favors/economy.js';
import { createCampaign, guestsFor, partyLine } from '../src/game3d/favors/campaign.js';
import { UPGRADES, WEEK, ECON, GUESTS, PARTY_LINES } from '../src/game3d/favors/play-content.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const mem = () => { const d = {}; return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; }, removeItem: (k) => { delete d[k]; } }; };
import { safeStorage } from '../src/game3d/favors/campaign.js';

test('pay grows with the tone, the quality and being early; a good relationship adds a little', () => {
  const t = (tone, doneAt = 600) => ({ tone, deadline: 700, window: 200, doneAt });
  const trivial = payFor(t('trivial'), 1).total;
  const epic = payFor(t('epic'), 1).total;
  assert.ok(trivial >= 14 && epic > trivial * 2.5, `${trivial} ${epic}`);
  assert.ok(payFor(t('absurd'), 1).total > payFor(t('absurd'), 0.2).total);
  assert.ok(payFor(t('absurd', 520), 0.8).total > payFor(t('absurd', 690), 0.8).total, 'earlier pays more');
  assert.ok(payFor(t('absurd'), 0.8, { rel: 100 }).total >= payFor(t('absurd'), 0.8, { rel: 20 }).total);
  assert.ok(payFor(t('trivial', 9999), 0).total >= 1, 'always at least a peach');
});

test('perks: nothing bought = no change; every level adds something real', () => {
  const p0 = perksFor({});
  assert.deepEqual([p0.top, p0.accel, p0.grip, p0.cargo, p0.mentors, p0.tank, p0.drain, p0.sprint], [1, 1, 1, 1, 0, 2.5, 1, 1]);
  const all = perksFor(Object.fromEntries(UPGRADES.map((u) => [u.id, u.levels.length])));
  assert.ok(all.top > 1.2 && all.accel > 1.3 && all.grip > 1.2 && all.tank >= 8 && all.cargo < 0.7 && all.mentors === 1 && all.drain < 0.7 && all.sprint > 1.1 && all.rainGrip < p0.rainGrip / 1.4);
  assert.ok(perksFor({ engine: 99 }).top === perksFor({ engine: 3 }).top, 'levels are capped');
});

test('the garage: buying costs peaches, level by level, and refuses politely when poor or maxed', () => {
  const e = createEconomy({ peaches: 100 });
  assert.equal(e.buy('engine').ok, true);
  assert.equal(e.peaches, 10);
  assert.equal(e.level('engine'), 1);
  const poor = e.buy('engine');
  assert.ok(!poor.ok && poor.why === 'poor' && poor.need > 0);
  e.earn(1000, 'test');
  while (e.buy('engine').ok);
  assert.equal(e.level('engine'), 3);
  assert.equal(e.buy('engine').why, 'maxed');
  assert.equal(e.next('engine'), null);
  assert.ok(e.canBuy('tank'));
  const total = UPGRADES.reduce((a, u) => a + u.levels.reduce((b, l) => b + l.cost, 0), 0);
  assert.ok(total > 1200 && total < 2400, `the garage costs ${total} in all`);
  assert.equal(e.buy('nothing').ok, false);
});

test('the day book: earnings by kind, reset each day; the affordable upgrade is suggested', () => {
  const e = createEconomy({ peaches: 40 });
  e.earn(30, 'favour'); e.earn(12, 'tip'); e.earn(25, 'golden');
  assert.deepEqual(e.breakdown(), { favour: 30, tip: 12, golden: 25 });
  assert.equal(e.todayTotal, 67);
  assert.ok(e.affordable() && e.affordable().cost <= e.peaches);
  e.newDay();
  assert.equal(e.todayTotal, 0);
  assert.equal(createEconomy({ peaches: 5 }).affordable(), null);
});

test('the week: five days, hearts and money carry over, a save slot, a fresh week on request', () => {
  const store = mem();
  const c = createCampaign({ storage: safeStorage(store) });
  assert.equal(c.day, 1);
  assert.equal(c.dayName, 'Sunday');
  c.eco.earn(200, 'favour'); c.eco.buy('engine');
  c.pickGolden(2); c.pickGolden(2);
  assert.equal(c.state.golden.length, 1);
  const sum = c.summarize({ helped: 9, rank: 'A Helpful Neighbour', score: 500, bestStreak: 4 }, { relNow: { family: 75, work: 50, perach: 60, city: 60, friends: 60, hobbies: 60, strangers: 60 } });
  assert.equal(sum.earned, 200);
  assert.equal(sum.delta.family, 15);
  assert.equal(sum.delta.work, -10);
  assert.ok(!sum.last);
  c.advance();
  assert.equal(c.day, 2);
  const again = createCampaign({ storage: safeStorage(store) });
  assert.equal(again.day, 2);
  assert.equal(again.state.rel.family, 75);
  assert.equal(again.eco.level('engine'), 1);
  assert.deepEqual(again.state.golden, [2]);
  assert.notEqual(c.daySeed(), (c.advance(), c.daySeed()), 'each day has its own seed');
  assert.equal(c.finale, false, 'the days go on (no last day) unless the week is switched back on');
  c.state.endless = false;
  for (let i = 0; i < 10; i++) c.advance();
  assert.ok(c.finale && c.day === WEEK.days + 1);
  c.reset();
  assert.equal(c.day, 1);
  assert.equal(c.eco.level('engine'), 0);
  assert.equal(createCampaign({ storage: safeStorage(store), fresh: false }).day, 1, 'the save was cleared');
  assert.equal(createCampaign({ storage: { read() { throw new Error('x'); }, write() {}, clear() {} }, fresh: true }).day, 1);
  assert.equal(safeStorage({ getItem() { throw new Error('blocked'); } }).read(), null, 'blocked storage never throws');
});

test('Sababa Night: kind weeks fill the house, a cold week still gets a warm line', () => {
  const warm = Object.fromEntries(['family', 'work', 'perach', 'city', 'friends', 'hobbies', 'strangers'].map((k) => [k, 90]));
  const cold = Object.fromEntries(Object.keys(warm).map((k) => [k, 5]));
  assert.equal(guestsFor(warm).filter((g) => g.came).length, GUESTS.length);
  assert.ok(guestsFor(cold).filter((g) => g.came).length <= 1);
  assert.ok(guestsFor({ ...cold, family: 80 }).some((g) => g.id === 'ima' && g.came));
  assert.ok(guestsFor(cold, 12).filter((g) => g.came).length >= guestsFor(cold, 0).filter((g) => g.came).length, 'golden peaches never hurt');
  for (const [, line] of PARTY_LINES) assert.ok(line.length < 120);
  assert.match(partyLine(10), /FULL HOUSE/);
  assert.ok(partyLine(0).length > 10);
  const c = createCampaign({ storage: safeStorage(mem()), fresh: true });
  const p = c.party();
  assert.ok(p.of === GUESTS.length && p.came > 3, `default hearts bring ${p.came}`);
  assert.ok(ECON.start > 0);
});

test('the life of Ori: love is clamped 0..100, XP levels the boxer, counters count, everything is saved and comes back', () => {
  const store = mem();
  const c = createCampaign({ storage: safeStorage(store) });
  assert.equal(c.state.love, 0);
  assert.equal(c.addLove(30), 30);
  assert.equal(c.addLove(500), 70, 'it stops at 100');
  assert.equal(c.addLove(-500), -100, 'and at 0');
  c.addLove(40);
  const r = c.addXp(100);
  assert.equal(r.level, 2);
  assert.deepEqual(r.moves.map((m) => m.id), ['combo']);
  assert.equal(c.bump('hellos'), 1); c.bump('hellos', 2);
  c.state.boxer.beaten.push('moti');
  c.save();
  const d = createCampaign({ storage: safeStorage(store) });
  assert.equal(d.state.love, 40);
  assert.equal(d.state.boxer.level, 2);
  assert.deepEqual(d.state.boxer.beaten, ['moti']);
  assert.equal(d.state.progress.hellos, 3);
  d.reset();
  assert.equal(d.state.love, 0); assert.equal(d.state.boxer.level, 1); assert.equal(d.state.progress.hellos, 0);
});

console.log(`${n} economy tests passed`);
