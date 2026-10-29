// "Ori, Can You...?" — the quest engine (PURE, seeded: no DOM, no three, no Math.random). The phone keeps buzzing: a DIRECTOR plans the
// whole day from the seed (a rising stream of tasks, bursts, double bookings, fake-URGENT mum calls), the engine runs the life of each
// task (new -> accepted -> done / failed / declined / delegated), the chaos meter, seven relationships, the score, the Do-Not-Disturb
// power-up, the mentors who take over trivial jobs, and the report card at midnight. Times are GAME MINUTES since 00:00.
import { mulberry32, subSeed, clamp } from '../rng.js';
import { TEMPLATES, CAST, REL, RANKS, DAY } from './content.js';
import { TEXT } from './texts.js';

export const DAY_START = DAY.startHour * 60;
export const DAY_END = DAY.endHour * 60;
export const MIN_PER_SEC = (DAY_END - DAY_START) / (DAY.realMinutes * 60); // game minutes per real second
export const TRAVEL_SPEED = 6; // m/s the feasibility guard assumes (a mix of walking and sprinting)
export const VERB_SECS = { carry: 9, fix: 12, queue: 20, chat: 11, shop: 11, escort: 18, assemble: 16, handle: 8 };
/** Extra seconds a mission's own mechanic takes on top of the verb (missions.js): searching, chasing, shopping round, a race, a gauntlet. */
export const MECH_SECS = { find: 55, chase: 60, list: 40, race: 75, gauntlet: 75, taxi: 10, delivery: 6 };
/** Defaults by tone: priority, extra minutes allowed (on top of the trip and the doing), score, relationship gain / loss, chaos on failure. */
export const TONES = {
  trivial: { pri: 1, mins: 80, score: 30, rel: 4, penRel: 3, chaos: 3 },
  absurd: { pri: 2, mins: 100, score: 60, rel: 6, penRel: 6, chaos: 6 },
  epic: { pri: 3, mins: 130, score: 100, rel: 9, penRel: 10, chaos: 10 },
};
export const DIFFICULTY = { chill: { rate: 0.7, slack: 1.25 }, normal: { rate: 1, slack: 1 }, hectic: { rate: 1.35, slack: 0.85 } };
export const CLOSES = { cityhall: 15 * 60 }; // City Hall shuts at 15:00: its tasks must be done by then
/** Game minutes to walk `metres` at the guard's assumed pace. */
export const travelMinutes = (metres) => (metres / TRAVEL_SPEED) * MIN_PER_SEC;
export const REPLY_LATER_MIN = 30;
export const FOCUS_MAX = 60; // Do Not Disturb lasts at most this many game minutes ...
export const FOCUS_COOLDOWN = 180; // ... and can be used again this long after it ended
export const MENTORS = { tokens: 3, regen: 120, delay: [35, 65], success: 0.85 };
const HOLD_MAX = FOCUS_MAX; // a held task has this much less time

// tasks per game hour through the day (a rising curve with a little rest at the end)
const RATE = [[6, 0.7], [8, 1.2], [11, 1.9], [14, 2.3], [17, 2.7], [20, 2.8], [22, 2.1], [24, 1.2]];
const rateAt = (h) => { for (let i = 0; i < RATE.length - 1; i++) if (h < RATE[i + 1][0]) { const [a, ra] = RATE[i]; const [b, rb] = RATE[i + 1]; return ra + ((rb - ra) * (h - a)) / (b - a); } return RATE[RATE.length - 1][1]; };
const BURSTS = [9.5, 13.25, 17.5, 21];
/** The first three tasks are always the same (the tutorial: an easy one, the coffee, an errand); the director takes over after 07:20. */
const OPENING = [[375, 'mum-remote'], [405, 'h-coffee'], [440, 'mum-bread']];
const FAMILY_W = (h) => ({ family: 1.2 + (h < 9 || h > 18 ? 0.4 : 0), work: h >= 8.5 && h <= 17 ? 1.6 : 0.2, perach: h >= 13 && h <= 19.5 ? 1.5 : 0.1, city: h < 12.5 ? 1.5 : 0, friends: 0.9 + (h > 17 ? 0.6 : 0), strangers: 0.8, hobbies: 0.5 + (h > 16 ? 0.7 : 0) });

/** Game minutes from the arrival of a task until it is due, so that it can be done ALONE from anywhere in town. */
export function windowFor(tpl, dist, difficulty = 'normal', slack = 1) {
  const tone = TONES[tpl.tone];
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  let far;
  if (tpl.legs && tpl.legs.length) { // a favour that goes through some places first (the pick-up, the shops) and ends at `at`
    const chain = [...tpl.legs, tpl.at];
    far = Math.max(...Object.values(dist[chain[0]] || { x: 0 }));
    for (let i = 0; i + 1 < chain.length; i++) far += dist[chain[i]][chain[i + 1]];
  } else far = Math.max(...Object.values(dist[tpl.at] || { x: 0 }));
  const trip = (far / TRAVEL_SPEED) * MIN_PER_SEC;
  const doing = (VERB_SECS[tpl.verb] + (MECH_SECS[tpl.mech] || 0)) * MIN_PER_SEC;
  return { trip, doing, total: trip + doing + (tpl.mins ?? tone.mins) * diff.slack * slack };
}

/**
 * The whole day in advance: [{ at, tplId, kind }] sorted by time — deterministic from the seed.
 * `o` (the week, campaign.js): rate (x tasks per hour), slack (x time allowed), noEpic (the first days have no epic favours), setpieces [{ at: game minute, id }].
 */
export function planDay(seed, dist, difficulty = 'normal', o = {}) {
  const rnd = mulberry32(subSeed(seed, 1));
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  const slackMul = o.slack ?? 1;
  const plan = [];
  const last = {}; // template id → last arrival
  const pick = (t, preferFar) => {
    const h = t / 60;
    const w = FAMILY_W(h);
    const cands = TEMPLATES.filter((tp) => {
      if (tp.win && (h < tp.win[0] || h > tp.win[1])) return false;
      if (tp.id === 'auntie-verdict' || tp.id === 'city-stamp') return false; // follow-ups only arrive through their chain
      if (tp.setpiece || (o.noEpic && tp.tone === 'epic')) return false; // the set pieces are planned by the week, not drawn
      if (last[tp.id] != null && t - last[tp.id] < 240) return false;
      const cl = CLOSES[tp.at];
      const win = windowFor(tp, dist, difficulty, slackMul);
      if (cl != null && t + win.trip + win.doing + 12 > cl) return false; // it could not be done before the doors shut
      return (w[tp.rel] || 0) > 0;
    });
    if (!cands.length) return null;
    let total = 0;
    const ws = cands.map((tp) => { let x = (w[tp.rel] || 0) * (tp.fake ? 1.5 : 1); if (preferFar && preferFar.at && dist[preferFar.at][tp.at] < 140) x *= 0.15; total += x; return x; });
    let r = rnd() * total;
    for (let i = 0; i < cands.length; i++) { r -= ws[i]; if (r <= 0) return cands[i]; }
    return cands[cands.length - 1];
  };
  const add = (t, tp, kind) => {
    plan.push({ at: Math.round(t), tplId: tp.id, kind });
    last[tp.id] = t;
    return tp;
  };
  for (const [at, id] of OPENING) { plan.push({ at, tplId: id, kind: 'opening' }); last[id] = at; }
  let t = 7 * 60 + 20;
  const bursts = BURSTS.map((b) => b * 60 + (rnd() - 0.5) * 50);
  let bi = 0;
  while (t < DAY_END - 100) {
    while (bi < bursts.length && bursts[bi] <= t) {
      // a burst: two or three tasks within a few minutes
      const n = 2 + Math.floor(rnd() * 2);
      let prev = null;
      for (let k = 0; k < n; k++) { const tp = pick(bursts[bi] + k * (2 + rnd() * 3), prev); if (tp) { add(bursts[bi] + k * (2 + rnd() * 3), tp, 'burst'); prev = tp; } }
      bi++;
    }
    const rate = rateAt(t / 60) * diff.rate * (o.rate ?? 1);
    t += clamp((-Math.log(1 - rnd()) / rate) * 60, 7, 95);
    if (t >= DAY_END - 100) break;
    const tp = pick(t, null);
    if (!tp) continue;
    add(t, tp, tp.fake ? 'fake' : 'drip');
    // a double booking: another one, somewhere else entirely, a few minutes later
    if (rnd() < 0.2) { const tp2 = pick(t + 3, tp); if (tp2) add(t + 3 + rnd() * 5, tp2, 'double'); }
  }
  for (const sp of o.setpieces || []) plan.push({ at: sp.at, tplId: sp.id, kind: 'setpiece' });
  plan.sort((a, b) => a.at - b.at);
  return plan;
}

const byId = new Map(TEMPLATES.map((t) => [t.id, t]));
export const template = (id) => byId.get(id);

/** One task instance from a template, created at game minute `at`. */
export function makeTask(uid, tpl, at, dist, difficulty, planned = at, slack = 1) {
  const tone = TONES[tpl.tone];
  const win = windowFor(tpl, dist, difficulty, slack);
  let deadline = Math.round(planned + win.total);
  if (CLOSES[tpl.at] != null) deadline = Math.min(deadline, CLOSES[tpl.at]);
  const giver = CAST[tpl.giver];
  const boost = tpl.rewardBoost || 1;
  return {
    uid, tplId: tpl.id, rel: tpl.rel, giver: tpl.giver, giverName: giver.name, at: tpl.at, verb: tpl.verb, tone: tpl.tone, fake: !!tpl.fake,
    title: tpl.title, body: tpl.body, doText: tpl.doText,
    pri: tpl.fake ? 3 : tpl.pri ?? tone.pri,
    createdAt: Math.round(at), deadline, window: deadline - Math.round(planned),
    score: Math.round(tone.score * boost), relGain: tone.rel, penRel: tone.penRel, chaos: tone.chaos,
    mech: tpl.mech || null, setpiece: !!tpl.setpiece, optional: !!tpl.optional, delegable: (tpl.delegable ?? tpl.tone === 'trivial') && !tpl.mech, calm: !!tpl.calm, coffee: !!tpl.coffee, then: tpl.then || null,
    state: 'new', later: false, doneAt: null, resolveAt: null,
  };
}

export function rankFor(score) {
  let r = RANKS[0];
  for (const x of RANKS) if (score >= x.min) r = x;
  return r.title;
}

/**
 * The engine. `dist` = map.dist (walking metres between places). Drive it with tick(gameMinutes); read `state`; listen to `drain()` events.
 * Events: { type: 'new' | 'accepted' | 'later' | 'declined' | 'done' | 'failed' | 'delegated' | 'focus' | 'day-end' | 'coffee', ... }.
 */
export function createQuests({ seed = 1, dist, difficulty = 'normal', rel = null, day = 1, rate = 1, slack = 1, noEpic = false, setpieces = [], mentors = 0, noTasks = false } = {}) {
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  const plan = noTasks ? [] : planDay(seed, dist, difficulty, { rate, slack, noEpic, setpieces }); // (noTasks: the phone stays quiet - the day is for hellos, the ring and the street)
  const state = {
    seed, difficulty, day, min: DAY_START, planIndex: 0, uid: 0,
    tasks: [], extra: [], held: [], chaos: 0, chaosPeak: 0, rel: rel ? { ...Object.fromEntries(Object.keys(REL).map((k) => [k, 60])), ...rel } : Object.fromEntries(Object.keys(REL).map((k) => [k, 60])),
    score: 0, streak: 0, bestStreak: 0, focus: { on: false, since: 0, cooldownUntil: 0 }, mentors: { tokens: MENTORS.tokens + mentors, max: MENTORS.tokens + mentors, nextRegen: DAY_START + MENTORS.regen },
    stats: { arrived: 0, done: 0, failed: 0, declined: 0, delegated: 0, early: 0, chains: 0 }, ended: false, report: null,
  };
  const events = [];
  const emit = (e) => events.push({ ...e, at: state.min });
  const get = (uid) => state.tasks.find((t) => t.uid === uid) || null;
  const isOpen = (t) => t.state === 'new' || t.state === 'accepted';
  const adjRel = (k, d) => { state.rel[k] = clamp(state.rel[k] + d, 0, 100); };

  function deliver(planned, tplId, kind) {
    const tpl = byId.get(tplId);
    const t = makeTask(++state.uid, tpl, state.min, dist, difficulty, planned, slack);
    t.kind = kind;
    state.tasks.push(t);
    state.stats.arrived++;
    emit({ type: 'new', uid: t.uid, silent: false, kind });
    return t;
  }

  function fail(t) {
    if (t.optional) { t.state = 'dropped'; t.doneAt = state.min; emit({ type: 'declined', uid: t.uid }); return; } // (a race he chose and did not run: nothing is lost)
    t.state = 'failed';
    t.doneAt = state.min;
    state.stats.failed++;
    state.streak = 0;
    adjRel(t.rel, -t.penRel);
    state.chaos = clamp(state.chaos + t.chaos, 0, 100);
    emit({ type: 'failed', uid: t.uid });
  }

  function finish(t, quality, share = 1) {
    const left = Math.max(0, t.deadline - state.min);
    const early = clamp(left / Math.max(1, t.window), 0, 1);
    const combo = 1 + Math.min(0.5, state.streak * 0.05);
    const pts = Math.round(t.score * (0.7 + 0.5 * quality) * (1 + 0.3 * early) * combo * share);
    t.state = 'done';
    t.doneAt = state.min;
    t.points = pts;
    state.score += pts;
    state.streak++;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.stats.done++;
    if (early > 0.5) state.stats.early++;
    adjRel(t.rel, t.relGain * share);
    state.chaos = clamp(state.chaos - (t.chaos * 1.2 + 2) - (t.calm ? 15 : 0), 0, 100);
    emit({ type: 'done', uid: t.uid, points: pts, quality, share });
    if (t.coffee) emit({ type: 'coffee', uid: t.uid });
    if (t.then) { state.extra.push({ at: state.min + t.then.delay, tplId: t.then.id }); state.stats.chains++; }
  }

  function chaosTarget() {
    let w = 0;
    for (const t of state.tasks) {
      if (!isOpen(t) || t.optional) continue; // (a race he chose is no pressure)
      const urgency = clamp(1 - (t.deadline - state.min) / Math.max(1, t.window), 0, 1);
      w += t.pri * (0.5 + 1.0 * urgency);
    }
    return clamp(w * 4.2 * (state.focus.on ? 0.6 : 1), 0, 100);
  }

  const api = {
    /** A conversation's effects: relationship (a REL key) +/-, chaos +/-. */
    nudge(relKey, dRel = 0, dChaos = 0) { if (relKey && relKey in state.rel) adjRel(relKey, dRel); state.chaos = clamp(state.chaos + dChaos, 0, 100); },
    state, plan,
    get(uid) { return get(uid); },
    open() { return state.tasks.filter(isOpen); },
    /** Open tasks, soonest deadline first, with the numbers the phone shows. `from` = the place Ori is at (for the distance). */
    list(from = 'home') {
      return state.tasks.filter(isOpen).map((t) => ({ ...t, remaining: t.deadline - state.min, urgency: clamp(1 - (t.deadline - state.min) / Math.max(1, t.window), 0, 1), metres: Math.round(dist[from]?.[t.at] ?? 0) })).sort((a, b) => a.deadline - b.deadline || b.pri - a.pri);
    },
    drain() { return events.splice(0, events.length); },
    /** Dev / tests: a task from a template arrives right now. */
    inject(tplId) { return byId.has(tplId) ? deliver(state.min, tplId, 'test') : null; },

    /** Advances the clock by `dm` game minutes: arrivals, deadlines, delegations, chaos, the Do Not Disturb timer, the end of the day. */
    tick(dm) {
      if (state.ended || dm <= 0) return;
      const target = Math.min(DAY_END, state.min + dm);
      // small sub-steps so a long step cannot skip an arrival or a deadline
      while (state.min < target) {
        const before = state.min;
        state.min = Math.min(target, state.min + 1);
        const m = state.min;
        const step = m - before;
        if (state.focus.on && m - state.focus.since >= FOCUS_MAX) api.setFocus(false);
        while (state.planIndex < plan.length && plan[state.planIndex].at <= m) {
          const p = plan[state.planIndex++];
          if (state.focus.on) state.held.push(p); else deliver(p.at, p.tplId, p.kind);
        }
        for (let i = state.extra.length - 1; i >= 0; i--) if (state.extra[i].at <= m) { const x = state.extra.splice(i, 1)[0]; if (state.focus.on) state.held.push({ at: x.at, tplId: x.tplId, kind: 'chain' }); else deliver(x.at, x.tplId, 'chain'); }
        for (const t of state.tasks) {
          if (isOpen(t) && m >= t.deadline) fail(t);
          else if (t.state === 'delegated' && m >= t.resolveAt) {
            const ok = mulberry32(subSeed(state.seed, t.uid * 13 + 7))() < MENTORS.success;
            if (ok) finish(t, 0.8, 0.6); else { t.state = 'failed'; t.doneAt = m; state.stats.failed++; adjRel(t.rel, -t.penRel * 0.5); emit({ type: 'failed', uid: t.uid, mentor: true }); }
          }
        }
        if (m >= state.mentors.nextRegen) { state.mentors.nextRegen += MENTORS.regen; state.mentors.tokens = Math.min(state.mentors.max, state.mentors.tokens + 1); }
        const ct = chaosTarget();
        state.chaos += (ct - state.chaos) * (1 - Math.pow(0.94, step)); // eases towards the pressure of the open tasks (6% per game minute)
        state.chaosPeak = Math.max(state.chaosPeak, state.chaos);
      }
      if (state.min >= DAY_END && !state.ended) {
        state.ended = true;
        for (const t of state.tasks) if (isOpen(t)) fail(t);
        state.report = api.report();
        emit({ type: 'day-end', report: state.report });
      }
    },

    /** A quick reply on the phone: 'yes' (accepts), 'later' (30 more minutes, once), 'no' (declines, costs a little). */
    reply(uid, kind) {
      const t = get(uid);
      if (!t || !isOpen(t)) return false;
      if (kind === 'yes') { if (t.state === 'new') { t.state = 'accepted'; adjRel(t.rel, 0.5); emit({ type: 'accepted', uid }); } return true; }
      if (kind === 'later') {
        if (t.later) return false;
        t.later = true;
        t.deadline = Math.min(DAY_END - 1, CLOSES[t.at] != null ? Math.min(CLOSES[t.at], t.deadline + REPLY_LATER_MIN) : t.deadline + REPLY_LATER_MIN);
        t.window += REPLY_LATER_MIN;
        if (!t.optional) adjRel(t.rel, -2);
        if (t.state === 'new') t.state = 'accepted';
        emit({ type: 'later', uid });
        return true;
      }
      if (kind === 'no') {
        if (t.optional) { t.state = 'dropped'; t.doneAt = state.min; emit({ type: 'declined', uid }); return true; }
        t.state = 'declined';
        t.doneAt = state.min;
        state.stats.declined++;
        state.streak = 0;
        adjRel(t.rel, -t.penRel * 0.6);
        state.chaos = clamp(state.chaos - 2, 0, 100);
        emit({ type: 'declined', uid });
        return true;
      }
      return false;
    },

    /** Ori did it: `quality` 0..1 (how well the little action went). */
    complete(uid, quality = 1) {
      const t = get(uid);
      if (!t || !isOpen(t)) return null;
      finish(t, clamp(quality, 0, 1));
      return t;
    },

    /** The mentors take a trivial task over (a token each; they are right 85% of the time and earn 60%). */
    delegate(uid) {
      const t = get(uid);
      if (!t || !isOpen(t) || !t.delegable || state.mentors.tokens <= 0) return false;
      state.mentors.tokens--;
      t.state = 'delegated';
      const [a, b] = MENTORS.delay;
      t.resolveAt = Math.min(DAY_END - 1, state.min + a + (b - a) * mulberry32(subSeed(state.seed, t.uid * 31 + 3))());
      state.stats.delegated++;
      emit({ type: 'delegated', uid });
      return true;
    },

    /** Do Not Disturb: nothing new arrives for up to an hour (it all lands together afterwards, with less time left). */
    setFocus(on) {
      const f = state.focus;
      if (on) {
        if (f.on || state.min < f.cooldownUntil) return false;
        f.on = true;
        f.since = state.min;
        emit({ type: 'focus', on: true });
        return true;
      }
      if (!f.on) return false;
      f.on = false;
      f.cooldownUntil = state.min + FOCUS_COOLDOWN;
      emit({ type: 'focus', on: false, released: state.held.length });
      const held = state.held.splice(0);
      for (const p of held) deliver(p.at, p.tplId, p.kind);
      return true;
    },
    focusReady() { return !state.focus.on && state.min >= state.focus.cooldownUntil; },

    /** The report card (also built when the day ends). */
    report() {
      const mine = (g, st) => state.tasks.filter((t) => t.giver === g && st.includes(t.state)).length;
      const helped = state.stats.done;
      const ignoredAunts = mine('auntie', ['failed', 'declined']);
      const mumCalls = state.tasks.filter((t) => t.giver === 'ima').length;
      const fake = state.tasks.filter((t) => t.fake).length;
      return {
        score: state.score, rank: rankFor(state.score), helped, ignoredAunts, mumCalls, fakeUrgent: fake, missed: state.stats.failed, declined: state.stats.declined, delegated: state.stats.delegated,
        arrived: state.stats.arrived, bestStreak: state.bestStreak, chaosPeak: Math.round(state.chaosPeak), slept: 0, rel: { ...state.rel },
        lines: TEXT.reportLines(helped, ignoredAunts, mumCalls, fake),
      };
    },
    /** A plain-JSON copy (save / resume) and its inverse. Everything else is derived from the seed. */
    snapshot() { return JSON.parse(JSON.stringify(state)); },
    restore(s) { Object.assign(state, JSON.parse(JSON.stringify(s))); },
  };
  void diff;
  return api;
}
