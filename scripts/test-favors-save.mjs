// "Ori, Can You...?" — the save slot (pure): the versioned schema, the sanitiser (garbage in, a safe save out), the v1 -> v2 migration, the save code (export / import),
// a storage that never throws and says what went wrong, and the campaign on top of it.      node scripts/test-favors-save.mjs
import assert from 'node:assert/strict';
import { sanitizeSave, encodeSave, decodeSave, safeStorage, describeSave, SAVE_VERSION, SAVE_KEY, CODE_ERRORS } from '../src/game3d/favors/save.js';
import { createCampaign } from '../src/game3d/favors/campaign.js';
import { WEEK, GOLDEN, UPGRADES, ECON } from '../src/game3d/favors/play-content.js';
import { REL } from '../src/game3d/favors/content.js';
import { MAX_LEVEL, xpToNext } from '../src/game3d/favors/boxer.js';
import { mulberry32 } from '../src/game3d/rng.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const mem = (seed) => { const d = { ...(seed || {}) }; return { d, getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } }; };
const quota = () => { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; return e; };

// a late-game save, as the game writes it
const rich = () => sanitizeSave({
  day: 4, seed: 7, love: 63.5, golden: [0, 2, 5],
  rel: { family: 90, work: 71, perach: 55, city: 40, friends: 88, hobbies: 60, strangers: 77 },
  wins: { race: 1, inspection: 2 },
  history: [{ day: 1, earned: 120, helped: 5, score: 410 }, { day: 2, earned: 150, helped: 6, score: 520 }],
  boxer: { xp: 40, level: 5, beaten: ['moti', 'roee', 'dov'], fights: 9, wins: 7, reveal: true },
  progress: { hellos: 21, shiloHi: 3, arcade: 4, arcadeBest: 1200, ringSeen: 1, goalsDone: ['hello', 'ringfind', 'office'], tips: { wind: true, tired: true }, best: { snake: 310, memory: 90 } },
  eco: { peaches: 333, owned: { engine: 2, tyres: 1 }, lifetime: 900, spent: 480 },
});

test('a nearly empty object becomes a complete starting save', () => {
  const s = sanitizeSave({});
  assert.equal(s.version, SAVE_VERSION);
  assert.equal(s.day, 1); assert.equal(s.seed, 1); assert.equal(s.love, 0);
  assert.deepEqual(Object.keys(s.rel).sort(), Object.keys(REL).sort());
  assert.ok(Object.values(s.rel).every((v) => v === 60));
  assert.deepEqual(s.boxer, { xp: 0, level: 1, beaten: [], fights: 0, wins: 0, reveal: false });
  assert.equal(s.eco.peaches, ECON.start);
  assert.deepEqual(s.eco.owned, {});
  assert.equal(s.progress.hellos, 0); assert.deepEqual(s.progress.goalsDone, []);
});

test('anything that is not an object is no save', () => {
  for (const bad of [null, undefined, 0, 5, 'x', '{}', [], [1], true, () => 1]) assert.equal(sanitizeSave(bad), null, String(bad));
});

test('numbers are clamped, junk falls back to the starting values', () => {
  const s = sanitizeSave({ day: 99, seed: -3, love: 1e9, rel: { family: 150, work: -5, perach: NaN, city: 'abc', friends: '70', hobbies: null }, boxer: { level: 99, xp: 1e9, fights: -4, wins: 'many' }, eco: { peaches: -50, lifetime: Infinity, spent: 'x' } });
  assert.equal(s.day, WEEK.days + 1); assert.equal(s.seed, 1); assert.equal(s.love, 100);
  assert.equal(s.rel.family, 100); assert.equal(s.rel.work, 0); assert.equal(s.rel.perach, 60); assert.equal(s.rel.city, 60); assert.equal(s.rel.friends, 70); assert.equal(s.rel.hobbies, 60); assert.equal(s.rel.strangers, 60);
  assert.equal(s.boxer.level, MAX_LEVEL); assert.equal(s.boxer.xp, xpToNext(MAX_LEVEL) - 1); assert.equal(s.boxer.fights, 0); assert.equal(s.boxer.wins, 0);
  assert.equal(s.eco.peaches, 0); assert.equal(s.eco.lifetime, 0); assert.equal(s.eco.spent, 0);
  assert.equal(sanitizeSave({ day: 0 }).day, 1);
  assert.equal(sanitizeSave({ day: '3' }).day, 3, 'a number written as text is fine');
  assert.equal(sanitizeSave({ boxer: { level: 3, xp: 5000 } }).boxer.xp, xpToNext(3) - 1, 'xp stays inside its level');
  assert.equal(sanitizeSave({ eco: { peaches: Infinity } }).eco.peaches, ECON.start, 'a value that is not finite is dropped');
});

test('lists are cleaned: golden peaches, history, ids', () => {
  const s = sanitizeSave({ golden: [0, 0, 3, 'x', -1, 9999, 2.5, null, GOLDEN.length - 1, GOLDEN.length], history: Array.from({ length: 90 }, (_, i) => ({ day: i, earned: 10, helped: 1, score: 5 })).concat([null, 7, 'x']), boxer: { beaten: ['moti', 'moti', 'bad id!', 5, '__proto__', 'dov'] }, progress: { goalsDone: ['hello', 'hello', 7, 'x y', 'office'] } });
  assert.deepEqual(s.golden, [0, 3, GOLDEN.length - 1]);
  assert.equal(s.history.length, 60);
  assert.ok(s.history.every((h) => h.day >= 1 && h.day <= WEEK.days + 1));
  assert.deepEqual(s.boxer.beaten, ['moti', 'dov']);
  assert.deepEqual(s.progress.goalsDone, ['hello', 'office']);
});

test('upgrades: only the garage\'s own, never above their last level', () => {
  const s = sanitizeSave({ eco: { owned: { engine: 99, tyres: -2, tank: 1.4, box: 1, nonsense: 3 } } });
  const engine = UPGRADES.find((u) => u.id === 'engine');
  assert.equal(s.eco.owned.engine, engine.levels.length);
  assert.equal(s.eco.owned.tyres, undefined); assert.equal(s.eco.owned.nonsense, undefined);
  assert.equal(s.eco.owned.tank, 1); assert.equal(s.eco.owned.box, 1);
});

test('the arcade\'s best scores survive (a game called 2048 starts with a digit)', () => {
  const s = sanitizeSave({ progress: { best: { tetris: 1200, '2048': 4096, 'bad key': 5, '__proto__': 7 }, arcade: 3 } });
  assert.deepEqual(s.progress.best, { tetris: 1200, '2048': 4096 });
  assert.deepEqual(decodeSave(encodeSave(s)).save.progress.best, { tetris: 1200, '2048': 4096 });
});

test('everything the game keeps on `progress` survives a save, a read and a save code (the speed bag\'s drill of the day too)', () => {
  const progress = { hellos: 4, shiloHi: 1, arcade: 2, arcadeBest: 300, goalsDone: ['hello', 'ringfind'], tips: { wind: true, tired: true }, best: { tetris: 900, '2048': 2048, snake: 120 }, train: { day: 3, n: 2 }, ringSeen: 1, kos: 2, perfect: 5, parries: 1, landed: 40, bestCombo: 6, flawless: 1, driven: 1234.5, hi_moti: 2, hi_bossA: 1, trophies: ['hello1', 'win1'], seen: { mum: true, cafe: true }, stamps: { cafe: true, park: true }, fed: { id: 'soup', day: 3 }, photos: 3, photoPlaces: { cafe: true, street: true }, gifts: { moti: true }, gdays: { moti: { n: 2, d: 5 }, roee: { n: 1, d: 4 } }, cats: { ginger: 2, tuxedo: 3 }, leagueWon: { moti: true, albert: true }, driverXp: 120, leagueRaces: 3, evCount: 3, evDay: 2, evDone: { band: true, lunch: true }, wish: { day: 3, list: ['hello:4', 'drive:600', 'win:1'], base: { hellos: 2, driven: 100 }, done: { hello: true }, places: { cafe: true }, bonus: true }, wishLog: [3, 1, 0], wishDone: 4, wishDays: 1 };
  const a = sanitizeSave({ day: 3, progress });
  assert.deepEqual(a.progress, { ...progress, goalsDone: ['hello', 'ringfind'] });
  assert.deepEqual(sanitizeSave(a).progress, a.progress, 'twice is the same');
  assert.deepEqual(decodeSave(encodeSave(a)).save.progress, a.progress, 'through a save code');
  assert.equal(sanitizeSave({ progress: { train: 'x' } }).progress.train, undefined);
  const bad = sanitizeSave({ progress: { wish: { day: -5, list: ['hello:4', 'nope!', 7, 'drive:600', 'a:1', 'win:1', 'ko:1'], base: { hellos: 'x', driven: 10 }, done: { hello: 1, 'bad key': true }, places: 5, bonus: 'yes' }, wishLog: [9, -2, 'x', 2] } }).progress;
  assert.deepEqual(bad.wish, { day: 0, list: ['hello:4', 'drive:600', 'win:1'], base: { driven: 10 }, done: { hello: true }, places: {}, bonus: false }, 'a garbled wish state is made safe');
  assert.deepEqual(bad.wishLog, [3, 0, 0, 2]);
  assert.deepEqual(sanitizeSave({ progress: { wishLog: Array.from({ length: 40 }, () => 2) } }).progress.wishLog.length, 14, 'two weeks of stickers');
  assert.deepEqual(sanitizeSave({ progress: { train: { day: -4, n: 'many' } } }).progress.train, { day: 1, n: 0 });
});

test('unknown fields are dropped, counters with odd names too; nothing can pollute Object', () => {
  const evil = JSON.parse('{"__proto__": {"polluted": true}, "evil": 1, "day": 2, "progress": {"__proto__": {"polluted2": true}, "hellos": 4, "bad key": 5, "ringSeen": 1, "name": "x", "nested": {"a": 1}}, "wins": {"constructor": 1, "race": 2, "x y": 3}}');
  const s = sanitizeSave(evil);
  assert.equal(s.evil, undefined); assert.equal(s.day, 2);
  assert.equal(s.progress.hellos, 4); assert.equal(s.progress.ringSeen, 1);
  assert.equal(s.progress['bad key'], undefined); assert.equal(s.progress.name, undefined); assert.equal(s.progress.nested, undefined);
  assert.equal(s.wins.race, 2); assert.equal(s.wins['x y'], undefined);
  assert.equal({}.polluted, undefined); assert.equal({}.polluted2, undefined);
});

test('sanitising twice changes nothing, and 400 random pieces of garbage never throw', () => {
  const rnd = mulberry32(2026);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const junk = (depth = 0) => {
    const t = Math.floor(rnd() * 9);
    if (t === 0) return null; if (t === 1) return rnd() * 1e12 - 5e11; if (t === 2) return pick(['', 'x', '7', 'moti', '-1', '1e3']); if (t === 3) return pick([NaN, Infinity, -Infinity]);
    if (t === 4) return rnd() < 0.5; if (t === 5 && depth < 3) return Array.from({ length: Math.floor(rnd() * 5) }, () => junk(depth + 1));
    if (t >= 6 && depth < 3) { const o = {}; for (const k of ['day', 'rel', 'golden', 'history', 'seed', 'wins', 'love', 'boxer', 'progress', 'eco', 'family', 'level', 'xp', 'owned', 'engine', 'peaches', 'hellos', 'goalsDone', 'tips', 'best', 'beaten', 'x']) if (rnd() < 0.3) o[k] = junk(depth + 1); return o; }
    return 0;
  };
  for (let i = 0; i < 400; i++) {
    const a = sanitizeSave(junk());
    if (a === null) continue;
    assert.deepEqual(sanitizeSave(a), a, `run ${i}`);
    assert.ok(a.day >= 1 && a.day <= WEEK.days + 1 && a.love >= 0 && a.love <= 100 && a.boxer.level >= 1 && a.boxer.level <= MAX_LEVEL && a.eco.peaches >= 0, `run ${i}`);
    assert.ok(Object.values(a.rel).every((v) => v >= 0 && v <= 100));
  }
});

test('the first format (no stamp) and a newer one are both read', () => {
  const v1 = { day: 3, rel: { family: 80 }, love: 20, boxer: { xp: 10, level: 2, beaten: ['moti'], fights: 2, wins: 1, reveal: false }, eco: { peaches: 90, owned: {}, lifetime: 200, spent: 110 } };
  const a = sanitizeSave(v1);
  assert.equal(a.version, SAVE_VERSION); assert.equal(a.day, 3); assert.equal(a.rel.family, 80); assert.equal(a.rel.work, 60); assert.equal(a.boxer.level, 2); assert.equal(a.eco.peaches, 90);
  const future = { ...v1, version: 99, shiny: { new: 'thing' }, boxer: { ...v1.boxer, newMove: 'x' } };
  const b = sanitizeSave(future);
  assert.equal(b.version, SAVE_VERSION); assert.equal(b.day, 3); assert.equal(b.shiny, undefined); assert.equal(b.boxer.newMove, undefined);
});

test('a save code round-trips, is short, and survives being pasted untidily', () => {
  const s = rich();
  const code = encodeSave(s);
  assert.match(code, /^ORI2-[A-Za-z0-9_-]+-[0-9a-f]{8}$/);
  assert.ok(code.length < 2200, `short enough to paste (${code.length} chars)`);
  const r = decodeSave(code);
  assert.ok(r.ok); assert.deepEqual(r.save, s);
  assert.deepEqual(decodeSave(`  "${code}"\n`).save, s, 'spaces, quotes, a newline');
  assert.deepEqual(decodeSave(`${code.slice(0, 40)}\n${code.slice(40, 90)} ${code.slice(90)}`).save, s, 'broken over lines');
  const up = code.replace(/-([0-9a-f]{8})$/, (m, h) => `-${h.toUpperCase()}`);
  assert.ok(decodeSave(up).ok, 'an upper-case checksum');
  assert.equal(describeSave(s), 'Day 4 · boxer Lv 5 · 333 peaches');
});

test('a bad code says why: empty, format, checksum, data', () => {
  assert.equal(decodeSave('').error, 'empty'); assert.equal(decodeSave('  \n ').error, 'empty'); assert.equal(decodeSave(null).error, 'empty'); assert.equal(decodeSave(undefined).error, 'empty');
  assert.equal(decodeSave('hello world').error, 'format'); assert.equal(decodeSave('ORI1-abc-12345678').error, 'format'); assert.equal(decodeSave(12345).error, 'format');
  const code = encodeSave(rich());
  const flipped = code.slice(0, 30) + (code[30] === 'A' ? 'B' : 'A') + code.slice(31);
  assert.equal(decodeSave(flipped).error, 'checksum', 'one changed character');
  assert.equal(decodeSave(code.slice(0, -3)).error, 'format', 'cut short');
  assert.equal(decodeSave(code.slice(0, 50) + code.slice(60)).error, 'checksum', 'a piece missing');
  // right checksum, wrong content
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
  const wrap = (text) => { const b = btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); return `ORI2-${b}-${fnv(b)}`; };
  assert.equal(decodeSave(wrap('not json at all')).error, 'data');
  assert.equal(decodeSave(wrap('[1,2,3]')).error, 'data');
  assert.equal(decodeSave(wrap('"just a string"')).error, 'data');
  assert.ok(decodeSave(wrap('{}')).ok, 'an empty object is a fresh start, not an error');
  for (const k of ['empty', 'format', 'checksum', 'data']) assert.ok(CODE_ERRORS[k].length > 8, k);
});

test('storage: saved with a version stamp, read back sanitised', () => {
  const st = mem(); const s = safeStorage(st);
  assert.equal(s.read(), null); assert.equal(s.problem, null);
  assert.equal(s.write(rich()), true);
  const raw = JSON.parse(st.d[SAVE_KEY]);
  assert.equal(raw.version, SAVE_VERSION); assert.ok(raw.savedAt > 1.7e12, 'a time stamp');
  assert.deepEqual({ ...s.read(), savedAt: 0 }, { ...rich(), savedAt: 0 });
  s.clear(); assert.equal(s.read(), null);
});

test('storage: a corrupted save is kept aside, not trampled, and the game starts fresh', () => {
  for (const text of ['{not json', '[]', '"x"', '7', 'null']) {
    const st = mem({ [SAVE_KEY]: text }); const s = safeStorage(st);
    assert.equal(s.read(), null, text); assert.equal(s.problem, 'corrupt', text);
    assert.equal(st.d[`${SAVE_KEY}-bad`], text, `the bad text is kept (${text})`);
    assert.equal(st.d[SAVE_KEY], undefined, 'and the slot is free for a good save');
    assert.equal(s.write(rich()), true); assert.equal(s.problem, null);
  }
});

test('storage: blocked or full storage never throws; the problem is named', () => {
  const blocked = safeStorage({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } });
  assert.equal(blocked.read(), null); assert.equal(blocked.problem, 'blocked');
  assert.equal(blocked.write(rich()), false); assert.equal(blocked.problem, 'blocked'); blocked.clear();
  const full = safeStorage({ getItem: () => null, setItem() { throw quota(); }, removeItem() {} });
  assert.equal(full.write(rich()), false); assert.equal(full.problem, 'full');
  const none = safeStorage(null); // (tests and old browsers: no localStorage at all)
  assert.equal(none.read(), null); assert.equal(none.write(rich()), false); none.clear();
});

test('campaign: odd saves give a sane game, and the old tests\' shape still works', () => {
  const st = mem({ [SAVE_KEY]: JSON.stringify({ day: 'x', love: 'lots', rel: 5, boxer: 'strong', progress: [1], eco: { peaches: 'rich', owned: 7 }, golden: 'all' }) });
  const c = createCampaign({ storage: safeStorage(st) });
  assert.equal(c.day, 1); assert.equal(c.state.love, 0); assert.equal(c.state.rel.family, 60); assert.equal(c.state.boxer.level, 1); assert.equal(c.eco.peaches, ECON.start); assert.deepEqual(c.state.golden, []);
  assert.equal(c.save(), true);
  const d = createCampaign({ storage: { read() { throw new Error('boom'); }, write() {}, clear() {} } });
  assert.equal(d.day, 1, 'a storage that throws on read is a fresh start');
});

test('campaign: export, then import into another game gives the same game; a bad code changes nothing', () => {
  const a = createCampaign({ storage: safeStorage(mem()), fresh: true });
  a.addLove(33); a.addXp(200); a.bump('hellos', 5); a.eco.earn(120, 'x'); a.eco.buy('engine'); a.state.rel.family = 91; a.pickGolden(1); a.mark('race');
  const code = a.exportCode();
  const b = createCampaign({ storage: safeStorage(mem()), fresh: true });
  const before = JSON.stringify(b.state);
  const bad = b.importCode('ORI2-AAAA-00000000');
  assert.equal(bad.ok, false); assert.equal(JSON.stringify(b.state), before, 'a bad code leaves the game as it was');
  const ok = b.importCode(code);
  assert.equal(ok.ok, true);
  assert.equal(b.state.love, a.state.love); assert.deepEqual(b.state.boxer, a.state.boxer); assert.equal(b.state.progress.hellos, 5);
  assert.deepEqual(b.eco.snapshot(), a.eco.snapshot()); assert.equal(b.state.rel.family, 91); assert.deepEqual(b.state.golden, [1]); assert.equal(b.won('race'), true);
  assert.equal(b.exportCode(), code, 'the imported game exports the very same code');
});

test('campaign: a save that fails is reported once per problem, and the game goes on', () => {
  const seen = [];
  const full = { problem: null, read: () => null, write() { this.problem = 'full'; return false; }, clear() {} };
  const c = createCampaign({ storage: full, onProblem: (p) => seen.push(p) });
  assert.equal(c.save(), false); c.save(); c.save();
  assert.deepEqual(seen, ['full'], 'told once, not every autosave');
  const bad = safeStorage(mem({ [SAVE_KEY]: '{oops' }));
  const seen2 = [];
  createCampaign({ storage: bad, onProblem: (p) => seen2.push(p) });
  assert.deepEqual(seen2, ['corrupt'], 'a save that could not be read is reported at the start');
});

test('a first game is already in the saved shape: state -> save code -> state changes nothing (the life soak found `evDone` missing once)', () => {
  const c = createCampaign({ storage: safeStorage(mem()), fresh: true });
  const was = JSON.parse(JSON.stringify(c.state));
  assert.deepEqual(was.progress, sanitizeSave({}).progress, 'a new game starts with the whole progress shape');
  assert.equal(c.importCode(c.exportCode()).ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(c.state)), was);
  c.reset();
  assert.deepEqual(JSON.parse(JSON.stringify(c.state.progress)), sanitizeSave({}).progress, 'and so does a new week');
});

console.log(`${n} save tests passed`);
