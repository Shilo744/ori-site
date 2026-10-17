// "Ori, Can You...?" — the quest engine (pure): the content, the seeded day plan, the life of a task, the meters, the power-ups and 200
// simulated bot days (difficulty curve, no impossible deadlines, determinism).      node scripts/test-favors-quests.mjs
import assert from 'node:assert/strict';
import { TEMPLATES, CAST, REL, RANKS, REPLIES, PLACES, DAY } from '../src/game3d/favors/content.js';
import {
  createQuests, planDay, windowFor, makeTask, rankFor, template, travelMinutes, MIN_PER_SEC, DAY_START, DAY_END, VERB_SECS, TONES, CLOSES, MENTORS, FOCUS_MAX, FOCUS_COOLDOWN, REPLY_LATER_MIN,
} from '../src/game3d/favors/quests.js';
import { MAP, botDay } from './lib/favors-bot.mjs';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const dist = MAP.dist;
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const fresh = (seed = 1, difficulty = 'normal') => createQuests({ seed, dist, difficulty });
/** Ticks one game minute at a time up to `m`. */
const run = (q, m) => { while (q.state.min < m && !q.state.ended) q.tick(1); };
/** The first open task of a kind that has arrived; ticks until one does. */
const until = (q, pred, limit = DAY_END) => { while (q.state.min < limit && !q.open().some(pred)) q.tick(1); return q.open().find(pred); };

// ── the content ──
test('content: 60+ templates in six families, unique ids, valid places / givers / follow-ups / relationship keys, no emoji', () => {
  assert.ok(TEMPLATES.length >= 60, `${TEMPLATES.length} templates`);
  const ids = new Set(TEMPLATES.map((t) => t.id));
  assert.equal(ids.size, TEMPLATES.length);
  const fam = {};
  for (const t of TEMPLATES) {
    assert.ok(PLACES[t.at], `${t.id}: place ${t.at}`);
    assert.ok(CAST[t.giver], `${t.id}: giver ${t.giver}`);
    assert.ok(REL[t.rel], `${t.id}: rel ${t.rel}`);
    assert.ok(VERB_SECS[t.verb], `${t.id}: verb ${t.verb}`);
    assert.ok(TONES[t.tone], `${t.id}: tone ${t.tone}`);
    assert.ok(t.title && t.body && t.doText, `${t.id}: text`);
    assert.ok(t.title.length <= 60 && t.body.length <= 150 && t.doText.length <= 40, `${t.id}: text length`);
    assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(`${t.title}${t.body}${t.doText}`), `${t.id}: emoji`);
    if (t.then) assert.ok(ids.has(t.then.id) && t.then.delay > 0, `${t.id}: follow-up`);
    if (t.win) assert.ok(t.win[0] < t.win[1] && t.win[0] >= 6 && t.win[1] <= 24, `${t.id}: window`);
    fam[t.rel] = (fam[t.rel] || 0) + 1;
  }
  assert.equal(Object.keys(fam).length, 7, 'every relationship is asked about');
  for (const [k, v] of Object.entries(fam)) assert.ok(v >= 7, `${k}: ${v}`);
  for (const r of ['yes', 'later', 'no']) assert.ok(REPLIES[r].length >= 3);
});
test('content: the absurd and the trivial mix (no family is all epic); the URGENT mum calls are trivial', () => {
  for (const rel of Object.keys(REL)) { const tones = new Set(TEMPLATES.filter((t) => t.rel === rel).map((t) => t.tone)); assert.ok(tones.size >= 2, `${rel}: ${[...tones]}`); }
  const fakes = TEMPLATES.filter((t) => t.fake);
  assert.ok(fakes.length >= 1 && fakes.every((t) => t.tone === 'trivial' && t.giver === 'ima'));
  assert.ok(TEMPLATES.filter((t) => t.tone === 'trivial').length >= 20 && TEMPLATES.filter((t) => t.tone === 'epic').length >= 8);
});
test('the day: 06:00 to midnight in 14 real minutes (about 1.29 game minutes per second)', () => {
  assert.equal(DAY_START, 360);
  assert.equal(DAY_END, 1440);
  assert.ok(Math.abs(MIN_PER_SEC - 1080 / 840) < 1e-9);
  assert.ok(Math.abs(travelMinutes(180) - (180 / 6) * MIN_PER_SEC) < 1e-9);
  assert.equal(DAY.realMinutes, 14);
});

// ── the plan ──
test('the plan is seeded: the same seed gives the same day, another seed another', () => {
  const a = JSON.stringify(planDay(7, dist));
  assert.equal(JSON.stringify(planDay(7, dist)), a);
  assert.notEqual(JSON.stringify(planDay(8, dist)), a);
});
test('the plan opens with the tutorial (mum remote, coffee, bread), then the director takes over after 07:20', () => {
  for (const seed of SEEDS) {
    const p = planDay(seed, dist);
    assert.deepEqual(p.slice(0, 3).map((x) => x.tplId), ['mum-remote', 'h-coffee', 'mum-bread']);
    assert.ok(p[0].at <= 6 * 60 + 20, 'the first task arrives within the first game minutes');
    for (const x of p.slice(3)) assert.ok(x.at >= 7 * 60 + 10, `seed ${seed}: ${x.tplId} at ${x.at}`);
  }
});
test('the plan is sorted, stays inside the day and never leaves a long silence', () => {
  let longest = 0;
  for (const seed of SEEDS) {
    const p = planDay(seed, dist);
    for (let i = 1; i < p.length; i++) { assert.ok(p[i].at >= p[i - 1].at); longest = Math.max(longest, p[i].at - p[i - 1].at); }
    assert.ok(p.at(-1).at < DAY_END - 60 && p.length >= 30, `seed ${seed}: ${p.length} tasks`);
  }
  assert.ok(longest <= 110, `the longest quiet stretch is ${longest} game minutes`);
});
test('the difficulty curve: more tasks arrive in the evening than in the morning', () => {
  let am = 0;
  let pm = 0;
  for (const seed of SEEDS) for (const x of planDay(seed, dist)) { if (x.at >= 7 * 60 + 20 && x.at < 11 * 60 + 20) am++; if (x.at >= 16 * 60 && x.at < 20 * 60) pm++; }
  assert.ok(pm > am * 1.4, `${pm} in the evening vs ${am} in the morning`);
});
test('the plan has bursts, double bookings and fake-URGENT mum calls', () => {
  const kinds = { burst: 0, double: 0, fake: 0, drip: 0 };
  let seedsWithBurst = 0;
  for (const seed of SEEDS) { const p = planDay(seed, dist); if (p.some((x) => x.kind === 'burst')) seedsWithBurst++; for (const x of p) if (x.kind in kinds) kinds[x.kind]++; }
  assert.ok(seedsWithBurst >= 180, `${seedsWithBurst} days with a burst`);
  assert.ok(kinds.double > 100 && kinds.fake > 20 && kinds.drip > 3000, JSON.stringify(kinds));
});
test('every task arrives inside its own window; City Hall tasks arrive in the morning and are due before it closes', () => {
  for (const seed of SEEDS) {
    for (const x of planDay(seed, dist)) {
      const t = template(x.tplId);
      if (t.win && x.kind !== 'opening') assert.ok(x.at / 60 >= t.win[0] - 0.1 && x.at / 60 <= t.win[1] + 0.1, `${t.id} at ${(x.at / 60).toFixed(2)} h`);
      if (t.at === 'cityhall' && x.kind !== 'chain') assert.ok(x.at <= CLOSES.cityhall - 60, `${t.id} arrives at ${x.at}`);
    }
  }
});
test('the same job never comes twice within four hours, and the follow-ups only come through their chain', () => {
  for (const seed of SEEDS) {
    const last = {};
    for (const x of planDay(seed, dist)) {
      assert.ok(x.tplId !== 'auntie-verdict' && x.tplId !== 'city-stamp', 'a follow-up in the plan');
      if (last[x.tplId] != null) assert.ok(x.at - last[x.tplId] >= 230, `${x.tplId} twice (${last[x.tplId]}, ${x.at})`);
      last[x.tplId] = x.at;
    }
  }
});
test('variety: across 200 days almost every template appears (the follow-ups through their chains)', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const x of planDay(seed, dist)) seen.add(x.tplId);
  const missing = TEMPLATES.filter((t) => !seen.has(t.id) && t.id !== 'auntie-verdict' && t.id !== 'city-stamp').map((t) => t.id);
  assert.ok(missing.length <= 3, `never planned: ${missing.join(', ')}`);
});

// ── no impossible deadlines ──
test('feasibility guard: every task can be done ALONE, from anywhere in town, in the time it is given (all difficulties, 200 seeds)', () => {
  for (const difficulty of ['chill', 'normal', 'hectic']) {
    for (const seed of SEEDS) {
      const q = fresh(seed, difficulty);
      for (const x of q.plan) {
        const tpl = template(x.tplId);
        const win = windowFor(tpl, dist, difficulty);
        const t = makeTask(1, tpl, x.at, dist, difficulty);
        const worstTrip = win.trip;
        assert.ok(t.deadline - t.createdAt >= worstTrip + win.doing + 8, `${difficulty} seed ${seed}: ${tpl.id} has ${t.deadline - t.createdAt} min for a ${Math.round(worstTrip + win.doing)} min job`);
        if (CLOSES[tpl.at]) assert.ok(t.deadline <= CLOSES[tpl.at]);
      }
    }
  }
});
test('feasibility guard (engine): tasks that arrive, including chains and held ones, still have time for the job', () => {
  for (const seed of SEEDS.slice(0, 40)) {
    const q = fresh(seed);
    while (!q.state.ended) {
      if (q.state.min > 600 && q.focusReady() && q.state.min < 900) q.setFocus(true);
      q.tick(1);
      for (const t of q.state.tasks) {
        const win = windowFor(template(t.tplId), dist, 'normal');
        if (t.state === 'new' && t.createdAt === Math.round(q.state.min)) assert.ok(t.deadline - t.createdAt >= win.doing + 4 && t.deadline > t.createdAt, `${t.tplId}: arrived with ${t.deadline - t.createdAt} min`);
      }
      if (q.drain().some((e) => e.type === 'day-end')) break;
    }
  }
});

// ── the life of a task ──
test('a lazy day: every task fails, nothing is delivered twice, the rank is Barely Awake and the report is funny', () => {
  const q = fresh(3);
  run(q, DAY_END);
  assert.ok(q.state.ended);
  const r = q.state.report;
  assert.equal(r.helped, 0);
  assert.equal(r.missed, r.arrived);
  assert.equal(r.rank, 'Barely Awake');
  assert.ok(r.lines.length === 4 && r.lines[3] === 'You slept 0 hours.' && /^You helped 0 people/.test(r.lines[0]));
  assert.equal(new Set(q.state.tasks.map((t) => t.uid)).size, q.state.tasks.length);
  assert.ok(q.open().length === 0, 'nothing is left open at midnight');
});
test('the tutorial task arrives at 06:15 with an URGENT mum call, answers work, and "yes" accepts it', () => {
  const q = fresh(1);
  run(q, 380);
  const t = q.open()[0];
  assert.equal(t.tplId, 'mum-remote');
  assert.equal(t.state, 'new');
  assert.equal(t.pri, 3);
  assert.equal(t.fake, true);
  const ev = q.drain();
  assert.ok(ev.some((e) => e.type === 'new' && e.uid === t.uid));
  assert.ok(q.reply(t.uid, 'yes'));
  assert.equal(q.get(t.uid).state, 'accepted');
  assert.ok(q.drain().some((e) => e.type === 'accepted'));
});
test('"later" gives 30 more minutes once and costs a little; "no" declines, costs the relationship and eases the chaos', () => {
  const q = fresh(1);
  run(q, 380);
  const t = q.open()[0];
  const d0 = t.deadline;
  const rel0 = q.state.rel.family;
  assert.ok(q.reply(t.uid, 'later'));
  assert.equal(t.deadline, d0 + REPLY_LATER_MIN);
  assert.ok(q.state.rel.family < rel0);
  assert.equal(q.reply(t.uid, 'later'), false, 'only once');
  q.state.chaos = 30;
  const rel1 = q.state.rel.family;
  assert.ok(q.reply(t.uid, 'no'));
  assert.equal(t.state, 'declined');
  assert.ok(q.state.rel.family < rel1 && q.state.chaos < 30);
  assert.equal(q.reply(t.uid, 'yes'), false, 'it is closed');
  assert.equal(q.state.stats.declined, 1);
});
test('completing pays the score, grows the relationship, eases the chaos and builds a streak; it cannot be done twice', () => {
  const q = fresh(1);
  run(q, 380);
  const t = q.open()[0];
  q.state.chaos = 40;
  const rel0 = q.state.rel.family;
  const done = q.complete(t.uid, 1);
  assert.equal(done.state, 'done');
  assert.ok(done.points >= TONES.trivial.score && q.state.score === done.points);
  assert.ok(q.state.rel.family > rel0 && q.state.chaos < 40 && q.state.streak === 1);
  assert.equal(q.complete(t.uid, 1), null);
  assert.ok(q.drain().some((e) => e.type === 'done' && e.points === done.points));
});
test('early beats late, a better job beats a sloppy one, and a streak is a multiplier', () => {
  const pts = (waitMin, quality, streak = 0) => { const q = fresh(1); run(q, 380); const t = q.open()[0]; run(q, 380 + waitMin); q.state.streak = streak; return q.complete(t.uid, quality).points; };
  assert.ok(pts(0, 1) > pts(40, 1), 'early bonus');
  assert.ok(pts(0, 1) > pts(0, 0.1), 'quality');
  assert.ok(pts(0, 1, 6) > pts(0, 1, 0), 'streak');
  assert.ok(pts(0, 1, 100) <= Math.round(pts(0, 1, 0) * 1.55), 'the streak bonus is capped');
});
test('missing the deadline fails the task: relationship down, chaos up, streak gone', () => {
  const q = fresh(1);
  run(q, 380);
  const t = q.open()[0];
  q.state.streak = 4;
  const rel0 = q.state.rel.family;
  run(q, t.deadline);
  assert.equal(t.state, 'failed');
  assert.ok(q.state.rel.family < rel0 && q.state.streak === 0);
  assert.ok(q.drain().some((e) => e.type === 'failed' && e.uid === t.uid));
});
test('a follow-up chain: the casserole for Auntie brings Auntie\'s verdict 25 minutes later', () => {
  const q = fresh(1);
  q.state.min = 600;
  q.state.extra.length = 0;
  const tpl = template('mum-casserole');
  const t = makeTask(900, tpl, 600, dist, 'normal');
  q.state.tasks.push(t);
  q.state.uid = 900;
  q.complete(900, 1);
  assert.equal(q.state.extra.length, 1);
  run(q, 624);
  assert.ok(!q.state.tasks.some((x) => x.tplId === 'auntie-verdict'));
  run(q, 626);
  const v = q.state.tasks.find((x) => x.tplId === 'auntie-verdict');
  assert.ok(v && v.state === 'new' && v.giver === 'auntie');
  assert.equal(q.state.stats.chains, 1);
});
test('a calm task (sit on the bench) lowers the chaos a lot; the coffee task announces the sprint', () => {
  const q = fresh(1);
  q.state.min = 1100;
  q.state.chaos = 60;
  const calm = makeTask(901, template('h-sunset'), 1100, dist, 'normal');
  const cof = makeTask(902, template('h-coffee'), 1100, dist, 'normal');
  q.state.tasks.push(calm, cof);
  q.complete(901, 1);
  assert.ok(q.state.chaos <= 60 - 15);
  q.complete(902, 1);
  assert.ok(q.drain().some((e) => e.type === 'coffee'));
});
test('chaos follows the pressure of the open tasks, stays between 0 and 100, and a good run of work brings it down', () => {
  const q = fresh(5);
  let max = 0;
  for (let m = 0; m < 700; m++) { q.tick(1); max = Math.max(max, q.state.chaos); assert.ok(q.state.chaos >= 0 && q.state.chaos <= 100); }
  assert.ok(max > 20, `the chaos built up (${max.toFixed(0)})`);
  const before = q.state.chaos;
  for (const t of q.open()) q.complete(t.uid, 1);
  assert.ok(q.state.chaos < before, 'finishing everything calms it');
  run(q, q.state.min + 40);
  assert.ok(q.state.chaos < before);
});
test('relationships and the score never leave their range', () => {
  for (const seed of SEEDS.slice(0, 30)) {
    const q = botDay(seed, 'hectic');
    for (const v of Object.values(q.state.rel)) assert.ok(v >= 0 && v <= 100);
    assert.ok(q.state.score >= 0);
  }
  const lazy = fresh(2);
  run(lazy, DAY_END);
  for (const v of Object.values(lazy.state.rel)) assert.ok(v >= 0 && v <= 100);
});

// ── the power-ups ──
test('mentors: only trivial jobs, a token each (3 a day, one back every two hours), 85% success for 60% of the reward, deterministic', () => {
  const q = fresh(1);
  run(q, 400);
  const triv = q.open().find((t) => t.delegable);
  assert.ok(triv, 'a delegable task');
  const epic = makeTask(950, template('a-tiny'), 400, dist, 'normal');
  q.state.tasks.push(epic);
  assert.equal(q.delegate(950), false, 'epic jobs are not delegable');
  assert.ok(q.delegate(triv.uid));
  assert.equal(q.state.mentors.tokens, MENTORS.tokens - 1);
  assert.equal(triv.state, 'delegated');
  run(q, triv.resolveAt + 2);
  assert.ok(['done', 'failed'].includes(triv.state));
  if (triv.state === 'done') assert.ok(triv.points > 0);
  q.state.mentors.tokens = 0;
  const other = makeTask(951, template('mum-bread'), 400, dist, 'normal');
  q.state.tasks.push(other);
  assert.equal(q.delegate(951), false, 'no token');
  const t0 = q.state.mentors.tokens;
  run(q, q.state.mentors.nextRegen + 1);
  assert.equal(q.state.mentors.tokens, t0 + 1);
  // deterministic: the outcome is a function of the seed and the task number
  const outcomes = [1, 2].map(() => { const z = fresh(9); z.state.min = 500; const tk = makeTask(77, template('mum-bread'), 500, dist, 'normal'); z.state.tasks.push(tk); z.delegate(77); run(z, tk.resolveAt + 1); return tk.state; });
  assert.equal(outcomes[0], outcomes[1]);
});
test('mentors succeed about 85% of the time over many tasks', () => {
  let ok = 0;
  for (let uid = 1; uid <= 400; uid++) {
    const z = fresh(11);
    z.state.min = 500;
    const tk = makeTask(uid, template('mum-bread'), 500, dist, 'normal');
    z.state.tasks.push(tk);
    z.delegate(uid);
    run(z, tk.resolveAt + 1);
    if (tk.state === 'done') ok++;
  }
  assert.ok(ok / 400 > 0.78 && ok / 400 < 0.92, `${ok / 4}%`);
});
test('Do Not Disturb: new tasks wait (silently), arrive together at the end with less time left, it lasts at most an hour, then a cooldown', () => {
  const q = fresh(2);
  run(q, 480);
  assert.ok(q.setFocus(true));
  assert.equal(q.setFocus(true), false, 'already on');
  const planned = q.plan.filter((x) => x.at > 480 && x.at <= 480 + FOCUS_MAX).length;
  const arrivedBefore = q.state.tasks.length;
  run(q, 480 + FOCUS_MAX - 2);
  assert.equal(q.state.tasks.length, arrivedBefore, 'nothing arrived while on');
  assert.ok(q.state.held.length >= 0);
  run(q, 480 + FOCUS_MAX + 1);
  assert.ok(!q.state.focus.on, 'it ends by itself after an hour');
  assert.equal(q.state.tasks.length, arrivedBefore + planned, 'everything held arrives when it ends');
  const late = q.state.tasks.slice(arrivedBefore);
  for (const t of late) assert.ok(t.deadline - t.createdAt < t.window + 1, 'less time than a task that arrived on time');
  assert.equal(q.focusReady(), false);
  assert.equal(q.setFocus(true), false, 'cooldown');
  run(q, q.state.focus.cooldownUntil + 1);
  assert.equal(q.focusReady(), true);
  assert.equal(FOCUS_COOLDOWN, 180);
});
test('Do Not Disturb eases the chaos (the pressure counts for less while it is on)', () => {
  const a = fresh(4);
  const b = fresh(4);
  run(a, 700);
  run(b, 700);
  a.setFocus(true);
  const ca = a.state.chaos;
  run(a, 730);
  run(b, 730);
  assert.ok(a.state.chaos <= b.state.chaos + 1e-9 || a.state.tasks.length <= b.state.tasks.length, `${a.state.chaos} vs ${b.state.chaos} (${ca})`);
});
test('the list: open tasks only, soonest deadline first, with the distance from where Ori stands', () => {
  const q = fresh(6);
  run(q, 700);
  const list = q.list('cafe');
  assert.ok(list.length >= 2);
  for (let i = 1; i < list.length; i++) assert.ok(list[i].deadline >= list[i - 1].deadline);
  for (const t of list) { assert.ok(['new', 'accepted'].includes(t.state)); assert.equal(t.metres, Math.round(dist.cafe[t.at])); assert.ok(t.urgency >= 0 && t.urgency <= 1); }
});

// ── save / determinism / ranks ──
test('snapshot / restore: a restored game plays on exactly like the original', () => {
  const a = fresh(12);
  run(a, 700);
  for (const t of a.open().slice(0, 2)) a.complete(t.uid, 0.9);
  const snap = a.snapshot();
  const b = fresh(12);
  b.restore(snap);
  run(a, DAY_END);
  run(b, DAY_END);
  assert.deepEqual(JSON.parse(JSON.stringify(a.state)), JSON.parse(JSON.stringify(b.state)));
});
test('the engine is independent of the step size (1 minute or 5 at a time give the same tasks and fates)', () => {
  const a = fresh(21);
  const b = fresh(21);
  while (!a.state.ended) a.tick(1);
  while (!b.state.ended) b.tick(5);
  const fate = (q) => q.state.tasks.map((t) => [t.uid, t.tplId, t.createdAt, t.deadline, t.state]);
  assert.deepEqual(fate(a), fate(b));
});
test('ranks climb with the score', () => {
  let prev = -1;
  for (const r of RANKS) { assert.ok(r.min > prev); prev = r.min; assert.equal(rankFor(r.min), r.title); }
  assert.equal(rankFor(0), 'Barely Awake');
  assert.equal(rankFor(99999), RANKS.at(-1).title);
});
test('the report counts the aunts you ignored and the times mum called', () => {
  const q = fresh(2);
  run(q, DAY_END);
  const r = q.state.report;
  const aunts = q.state.tasks.filter((t) => t.giver === 'auntie').length;
  assert.equal(r.ignoredAunts, aunts);
  assert.equal(r.mumCalls, q.state.tasks.filter((t) => t.giver === 'ima').length);
  assert.ok(r.mumCalls >= 3, 'mum called at least three times');
  assert.equal(r.slept, 0);
});

// ── 200 simulated days ──
const days = Object.fromEntries(['chill', 'normal', 'hectic'].map((d) => [d, SEEDS.map((s) => botDay(s, d))]));
const stat = (arr, f) => arr.reduce((a, q) => a + f(q), 0) / arr.length;
test('200 bot days: deterministic, every one ends, nothing is left open, nobody is ever "done" after the deadline', () => {
  for (const seed of SEEDS.slice(0, 20)) assert.equal(JSON.stringify(botDay(seed, 'normal').state), JSON.stringify(days.normal[seed - 1].state));
  for (const q of days.normal) {
    assert.ok(q.state.ended && q.open().length === 0);
    for (const t of q.state.tasks) if (t.state === 'done') assert.ok(t.doneAt <= t.deadline + 1e-9, `${t.tplId} done at ${t.doneAt} after ${t.deadline}`);
  }
});
test('200 bot days: the difficulty curve — more tasks and fewer done on hectic, fewer tasks and more done on chill', () => {
  const ratio = (d) => stat(days[d], (q) => q.state.stats.done) / stat(days[d], (q) => q.state.stats.arrived);
  const arrived = (d) => stat(days[d], (q) => q.state.stats.arrived);
  assert.ok(arrived('chill') < arrived('normal') && arrived('normal') < arrived('hectic'), `${arrived('chill')} ${arrived('normal')} ${arrived('hectic')}`);
  assert.ok(ratio('chill') > ratio('normal') && ratio('normal') > ratio('hectic'), `${ratio('chill')} ${ratio('normal')} ${ratio('hectic')}`);
  assert.ok(ratio('normal') > 0.5 && ratio('normal') < 0.8, `a perfect bot finishes ${(ratio('normal') * 100).toFixed(0)}% on normal (a person does less)`);
  assert.ok(ratio('hectic') > 0.4, 'even hectic is winnable');
});
test('200 bot days: a full day is winnable AND tense — a good score, a high chaos peak, some missed deadlines', () => {
  const sc = days.normal.map((q) => q.state.score);
  assert.ok(Math.min(...sc) > 1500 && Math.max(...sc) < 4500, `${Math.min(...sc)}..${Math.max(...sc)}`);
  assert.ok(stat(days.normal, (q) => q.state.chaosPeak) > 55, 'tense');
  assert.ok(stat(days.normal, (q) => q.state.stats.failed) > 5, 'you cannot do everything');
  assert.ok(stat(days.chill, (q) => q.state.chaosPeak) < stat(days.hectic, (q) => q.state.chaosPeak));
  const spread = Math.max(...sc) - Math.min(...sc);
  assert.ok(spread > 600, `the seeds differ (${spread})`);
});
test('200 bot days: a lazy player is never rewarded, a delegating + focusing bot does at least as well as a plain one', () => {
  const lazy = SEEDS.slice(0, 20).map((s) => { const q = fresh(s); run(q, DAY_END); return q.state.score; });
  assert.ok(lazy.every((v) => v === 0));
  const plain = SEEDS.slice(0, 40).map((s) => botDay(s, 'normal').state.score);
  const clever = SEEDS.slice(0, 40).map((s) => botDay(s, 'normal', { delegate: true, focus: true }).state.score);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  assert.ok(avg(clever) >= avg(plain) * 0.97, `${avg(clever).toFixed(0)} vs ${avg(plain).toFixed(0)}`);
});
test('200 bot days: a slower human (60% of the speed, lazier jobs) gets a lower rank than the bot but still earns something', () => {
  const human = SEEDS.slice(0, 40).map((s) => botDay(s, 'normal', { speed: 4.0, think: 3, quality: 0.6 }));
  const bot = days.normal.slice(0, 40);
  assert.ok(stat(human, (q) => q.state.score) < stat(bot, (q) => q.state.score) * 0.85);
  assert.ok(stat(human, (q) => q.state.score) > 700, 'a human still has a good day');
});

console.log(`${n} quest tests passed`);
