// "Ori, Can You...?" — the missions (PURE: no DOM, no three, seeded). A favour used to be "walk to the door, press Space". Now every kind of favour has its
// own mechanic that uses the world:
//   verb      a little action at the door (verbs.js: fix, handle, queue, chat, shop, assemble, carry)
//   delivery  fetch it, carry it gently (a meter drops with bumps, hard turns, sprinting, melting), hand it over
//   taxi      a passenger with a mood (rushed / nervous / sightseer / chatty): drive them, the tip is the mood
//   find      hot-and-cold search for something lost
//   chase     catch the runaway (the parrot, the hat): it flees, bolts, and can be cornered
//   list      a shopping list over several shops, free order, a sold-out detour
//   race      race Dov the courier round the crossings, checkpoint by checkpoint
//   gauntlet  several verbs back to back (the Inspector's inspection)
// A mission lives on a task of the quest engine (quests.js) - or on its own (a street hail). The game feeds it `update(ctx)` each frame and `act(ctx)`
// when Space is pressed; it answers with events and a `view()` for the HUD, and finishes with a quality 0..1 (and a tip).
//   ctx = { dt, p: { x, z, speed, sprinting }, car: null | { x, z, speed, heading, yawRate, boost }, bump (impact m/s this frame), rain 0..1, perks, min }
//   env = { places, blocked(x, z, r), seed, day }
import { mulberry32, subSeed } from '../rng.js';
import { CARGO, PASSENGERS, FIND_KINDS, CHASE_KINDS, LISTS, RACE, GAUNTLET, WEEK, VERB_PARAMS, LIKES } from './play-content.js';
import { buildTrack, GRID_GAP } from './tracks.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const REACH_FOOT = 3.8;
const REACH_CAR = 6.5;

/** The outcome for a mission that is never fully "done": the friendly retry. */
export const MISSION_KINDS = ['verb', 'delivery', 'taxi', 'find', 'chase', 'list', 'race', 'gauntlet'];

/** The spec of a task's mission: the template's `mech` (+ `mp` parameters), else the plain verb at the door. */
export function specFor(tpl) {
  const base = { at: tpl.at, tone: tpl.tone, verb: tpl.verb, doText: tpl.doText, title: tpl.title };
  if (tpl.mech) return { ...base, kind: tpl.mech, ...(tpl.mp || {}) };
  let verb = tpl.verb;
  const params = { ...(VERB_PARAMS[tpl.id] || {}), ...(tpl.vp || {}) };
  if (verb === 'escort') verb = 'chat'; // (walking someone along comes with the escort mission; until then it is a good talk on the way)
  if (verb === 'chat') { params.likes = params.likes || LIKES[tpl.rel] || 'warm'; params.prompts = params.prompts || [tpl.body, 'Well?', 'So... what do you think?']; }
  if (verb === 'shop') params.aisle = params.aisle || 'default';
  return { ...base, kind: 'verb', verb, params };
}

const doorOf = (env, id) => env.places[id].door;
const standAt = (env, id) => { const d = doorOf(env, id); return { x: d.x, z: d.z }; };
/** The target of a stage: a place door or a point. */
const at = (env, where) => (typeof where === 'string' ? standAt(env, where) : where);

/** A random free point inside a rectangle, at least `min` metres from (ax, az). */
function freePoint(rnd, env, rect, ax, az, min = 12) {
  for (let k = 0; k < 80; k++) {
    const x = rect.x0 + 3 + rnd() * (rect.x1 - rect.x0 - 6);
    const z = rect.z0 + 3 + rnd() * (rect.z1 - rect.z0 - 6);
    if (!env.blocked(x, z, 0.6) && dist(x, z, ax, az) >= min) return { x, z };
  }
  return { x: (rect.x0 + rect.x1) / 2, z: (rect.z0 + rect.z1) / 2 };
}
const zoneRect = (env, id) => (id === 'promenade' ? env.zones.promenade : id === 'park' ? env.zones.park : env.places[id].rect);

// ───────────────────────────── the shared shell ─────────────────────────────
function shell(kind, spec, env, body) {
  const m = {
    kind, spec, title: spec.title || kind, t: 0, done: false, result: null, stage: null, started: false, events: [], over: false,
    emit(e) { m.events.push(e); },
    finish(quality, extra = {}) { if (m.done) return; m.done = true; m.result = { quality: clamp(quality, 0.15, 1), tip: 0, ...extra }; m.emit({ type: 'done', ...m.result }); },
    /** Events since last asked. */
    drain() { return m.events.splice(0, m.events.length); },
    /** What is drawn in the world: [{ kind, x, z, ... }]. */
    targets() { return []; },
    view() { return { label: '', sub: '', meters: [], steps: [] }; },
    update() {},
    act() { return false; },
    /** Where the beam / arrow points right now: { x, z, place? } or null. */
    goal() { return null; },
    /** True while Ori must not be bumped off the mission by a follow switch (cargo in hand, a passenger aboard). */
    get committed() { return false; },
    /** True while the car must not move (the countdown of a race: no false start). */
    get locked() { return false; },
  };
  Object.defineProperties(m, Object.getOwnPropertyDescriptors(body)); // (not a spread: the getters must stay getters)
  return m;
}

/** Near enough to a stage point: on foot within 3.8 m, in the car within 6.5 m and nearly stopped. */
function arrived(ctx, pt, { auto = false } = {}) {
  if (ctx.car) return dist(ctx.car.x, ctx.car.z, pt.x, pt.z) < REACH_CAR && Math.abs(ctx.car.speed) < (auto ? 3.2 : 99);
  return dist(ctx.p.x, ctx.p.z, pt.x, pt.z) < REACH_FOOT && (!auto || ctx.p.speed < 1.6);
}

// ───────────────────────────── verb: a little action at the door ─────────────────────────────
function verbMission(spec, env) {
  let asked = false;
  const m = shell('verb', spec, env, {
    get committed() { return false; },
    goal() { return m.done ? null : { ...standAt(env, spec.at), place: spec.at }; },
    view() { return { label: spec.doText || 'Do the favour', sub: '', meters: [], steps: [] }; },
    act(ctx) {
      if (m.done || asked) return false;
      if (!arrived(ctx, standAt(env, spec.at))) return false;
      asked = true;
      m.emit({ type: 'verb', kind: spec.verb, tone: spec.tone, params: spec.params || {}, seed: subSeed(env.seed, 5) });
      return true;
    },
    /** The overlay finished: quality 0..1. */
    verbDone(q) { asked = false; m.finish(q); },
    verbCancelled() { asked = false; },
  });
  return m;
}

// ───────────────────────────── delivery: fetch it, carry it gently ─────────────────────────────
function deliveryMission(spec, env) {
  const cargo = CARGO[spec.cargo] || CARGO.casserole;
  const par = spec.par || 120;
  const s = { stage: 'pickup', integrity: 1, prevSpeed: 0, clock: 0, bumps: 0, lastHurt: 0 };
  const from = spec.from;
  const to = spec.at;
  const m = shell('delivery', spec, env, {
    get committed() { return s.stage === 'carry'; },
    get integrity() { return s.integrity; },
    goal() { if (m.done) return null; const pl = s.stage === 'pickup' ? from : to; return { ...standAt(env, pl), place: pl }; },
    update(ctx) {
      if (m.done) return;
      s.clock += ctx.dt;
      const g = m.goal();
      if (s.stage === 'pickup') {
        if (arrived(ctx, g, { auto: true })) { s.stage = 'carry'; s.prevSpeed = ctx.car ? ctx.car.speed : ctx.p.speed; m.emit({ type: 'stage', id: 'carry', say: cargo.pickup }); }
        return;
      }
      // carrying: what hurts the cargo
      const k = cargo.fragile * (ctx.perks ? ctx.perks.cargo : 1) * (ctx.rain > 0.4 ? 1.2 : 1);
      let hurt = 0;
      if (ctx.car) {
        const sp = ctx.car.speed;
        const accel = (sp - s.prevSpeed) / Math.max(ctx.dt, 1e-3);
        s.prevSpeed = sp;
        if (ctx.bump > 2.2) { hurt += ctx.bump * 0.03; s.bumps++; }
        if (accel < -9) hurt += (-accel - 9) * 0.0006 * ctx.dt * 60;
        const lat = Math.abs(ctx.car.yawRate || 0) * Math.abs(sp);
        if (lat > 9) hurt += (lat - 9) * 0.004 * ctx.dt;
      } else {
        s.prevSpeed = ctx.p.speed;
        if (ctx.p.sprinting) hurt += 0.012 * ctx.dt; // do not run with a casserole
        if (ctx.bump > 0) hurt += ctx.bump * 0.01;
      }
      hurt *= k;
      if (cargo.melt > 0) hurt += ctx.dt / cargo.melt;
      if (hurt > 0) { s.integrity = Math.max(0.15, s.integrity - hurt); s.lastHurt = s.clock; }
      if (arrived(ctx, g, { auto: true })) {
        const early = clamp(1 - Math.max(0, s.clock - par) / par, 0.4, 1);
        m.emit({ type: 'stage', id: 'drop', say: cargo.drop });
        m.finish(s.integrity * 0.82 + 0.18 * early, { tip: s.integrity > 0.9 ? 6 : 0, integrity: s.integrity });
      }
    },
    view() {
      const done = s.stage === 'carry';
      return {
        label: done ? `Take ${cargo.name} to ${env.places[to].name}` : `Pick up ${cargo.name} at ${env.places[from].name}`, sub: done ? (cargo.melt ? 'It is melting - quick, but smooth!' : 'Gently now: bumps, sprints and hard turns shake it.') : 'Walk or drive up to the door.',
        meters: done ? [{ k: 'cargo', label: cargo.name, v: s.integrity, warn: s.integrity < 0.45 }] : [],
        steps: [{ label: `Pick up at ${env.places[from].name}`, done: done }, { label: `Hand over at ${env.places[to].name}`, done: false }],
      };
    },
    targets() { return s.stage === 'carry' && !m.done ? [{ kind: 'cargo', x: 0, z: 0, integrity: s.integrity, name: spec.cargo }] : []; },
  });
  return m;
}

// ───────────────────────────── taxi: a passenger with a mood ─────────────────────────────
function taxiMission(spec, env) {
  const rnd = mulberry32(subSeed(env.seed, 11));
  const mood = spec.mood || 'rushed';
  const who = spec.who || PASSENGERS[mood][Math.floor(rnd() * PASSENGERS[mood].length)];
  const from = spec.from;
  const to = spec.at;
  const via = mood === 'sightseer' ? spec.via || 'park' : null;
  const start = at(env, from);
  const end = at(env, to);
  const trip = dist(start.x, start.z, end.x, end.z) * 1.25;
  const s = { stage: 'pickup', mood: 1, clock: 0, ride: 0, seen: !via, prevSpeed: 0, waited: 0 };
  const patience = trip / 13 + 22; // seconds the rushed passenger is happy for
  const m = shell('taxi', { ...spec, passenger: who.name, say: who.say }, env, {
    get committed() { return s.stage !== 'pickup'; },
    get mood() { return s.mood; },
    who,
    goal() {
      if (m.done) return null;
      if (s.stage === 'pickup') return { ...start, place: typeof from === 'string' ? from : null };
      if (!s.seen) return { ...standAt(env, via), place: via, via: true };
      return { ...end, place: typeof to === 'string' ? to : null };
    },
    update(ctx) {
      if (m.done) return;
      s.clock += ctx.dt;
      if (s.stage === 'pickup') {
        // the passenger waits for a car: pull up and they hop in (a hail waits less patiently on foot: it just says so)
        if (ctx.car && dist(ctx.car.x, ctx.car.z, start.x, start.z) < 7.5 && Math.abs(ctx.car.speed) < 3.4) { s.stage = 'ride'; s.prevSpeed = ctx.car.speed; m.emit({ type: 'stage', id: 'board', say: who.say }); }
        else if (!ctx.car && dist(ctx.p.x, ctx.p.z, start.x, start.z) < 3 && s.waited < 1) { s.waited = 1; m.emit({ type: 'hint', say: 'taxi-car' }); }
        return;
      }
      s.ride += ctx.dt;
      const car = ctx.car;
      if (!car) { s.mood = Math.max(0.2, s.mood - 0.02 * ctx.dt); return; } // out of the car: the passenger waits a bit grumpy (never lost)
      const sp = Math.abs(car.speed);
      const accel = (car.speed - s.prevSpeed) / Math.max(ctx.dt, 1e-3);
      s.prevSpeed = car.speed;
      const lat = Math.abs(car.yawRate || 0) * sp;
      if (mood === 'rushed') s.mood = clamp(1 - Math.max(0, s.ride - 8) / patience, 0.2, 1);
      else if (mood === 'nervous') {
        let d = 0;
        if (ctx.bump > 2) d += ctx.bump * 0.05;
        if (sp > 15) d += (sp - 15) * 0.012 * ctx.dt;
        if (car.boost > 0.1) d += 0.3 * ctx.dt;
        if (lat > 7) d += (lat - 7) * 0.012 * ctx.dt;
        if (accel < -11) d += 0.002;
        s.mood = clamp(s.mood - d + 0.004 * ctx.dt, 0, 1);
      } else if (mood === 'sightseer') {
        s.mood = clamp(s.mood - 0.006 * ctx.dt - (ctx.bump > 3 ? ctx.bump * 0.01 : 0), 0.3, 1);
      } else { // chatty: likes 6 - 13 m/s, hates being rushed or crawling
        const happy = sp >= 5 && sp <= 13;
        s.mood = clamp(s.mood + (happy ? 0.03 : sp > 16 ? -0.09 : sp < 1.5 ? -0.03 : -0.01) * ctx.dt, 0, 1);
      }
      if (!s.seen && dist(car.x, car.z, standAt(env, via).x, standAt(env, via).z) < 16) { s.seen = true; s.mood = Math.min(1, s.mood + 0.15); m.emit({ type: 'stage', id: 'via', say: 'Oh! Lovely. Now take me on.' }); }
      const g = m.goal();
      if (s.seen && dist(car.x, car.z, g.x, g.z) < REACH_CAR + 1 && sp < 3.8) {
        const mq = clamp(s.mood, 0.15, 1);
        m.emit({ type: 'stage', id: 'drop', say: mq > 0.7 ? 'Wonderful! Keep the change.' : 'Thank you, dear!' });
        m.finish(0.45 + 0.55 * mq, { tip: Math.round((spec.tipMax ?? 26) * mq * (via ? 1.25 : 1)), mood: mq });
      }
    },
    view() {
      const on = s.stage === 'ride';
      const face = s.mood > 0.7 ? 'happy' : s.mood > 0.4 ? 'ok' : 'tense';
      const nm = who.name;
      return {
        label: on ? (s.seen ? `Take ${nm} to ${typeof to === 'string' ? env.places[to].name : 'the drop-off'}` : `Pass ${env.places[via].name} first`) : `Pick up ${nm}`,
        sub: on ? ({ rushed: 'They are in a hurry: every second counts.', nervous: 'Smooth and gentle: no bumps, no flames.', sightseer: 'Show them the sights, then the destination.', chatty: 'A relaxed pace keeps the conversation going.' }[mood]) : 'Pull up next to them in your car.',
        meters: on ? [{ k: 'mood', label: 'Mood', v: s.mood, face, warn: s.mood < 0.35 }] : [],
        steps: [{ label: 'Pick up', done: on }, ...(via ? [{ label: `Pass ${env.places[via].name}`, done: s.seen }] : []), { label: 'Drop off', done: false }],
      };
    },
    targets() { return s.stage === 'pickup' && !m.done ? [{ kind: 'passenger', x: start.x, z: start.z, name: who.name, seed: Math.floor(rnd() * 99) }] : []; },
  });
  return m;
}

// ───────────────────────────── find: hot and cold ─────────────────────────────
function findMission(spec, env) {
  const rnd = mulberry32(subSeed(env.seed, 13));
  const kind = FIND_KINDS[spec.what] || FIND_KINDS.cat;
  const rect = zoneRect(env, kind.zone);
  const p0 = standAt(env, spec.at);
  const tgt = freePoint(rnd, env, rect, p0.x, p0.z, 14);
  const par = spec.par || 80;
  const s = { clock: 0, pingIn: 0, d: 99, found: false };
  const band = (d) => (d < 4 ? 'Burning hot!' : d < 11 ? 'Hot!' : d < 22 ? 'Warm' : d < 40 ? 'Cool' : 'Cold');
  const m = shell('find', { ...spec, what: spec.what }, env, {
    get committed() { return s.clock > 1; },
    goal() { return m.done ? null : { ...standAt(env, spec.at), place: spec.at, soft: s.clock > 1 }; }, // the zone is shown, the target is not
    zone() { return rect; },
    update(ctx) {
      if (m.done) return;
      s.clock += ctx.dt;
      const px = ctx.car ? ctx.car.x : ctx.p.x;
      const pz = ctx.car ? ctx.car.z : ctx.p.z;
      s.d = dist(px, pz, tgt.x, tgt.z);
      s.pingIn -= ctx.dt;
      if (s.pingIn <= 0 && s.clock > 1.5) { s.pingIn = clamp(s.d / 26, 0.3, 2.6); m.emit({ type: 'ping', v: clamp(1 - s.d / 45, 0, 1) }); }
      if (s.d < 3.3 && !ctx.car) { s.found = true; const q = clamp(1 - Math.max(0, s.clock - par) / (par * 2), 0.45, 1); m.emit({ type: 'stage', id: 'found', say: kind.found }); m.finish(q, { tip: s.clock < par * 0.6 ? 8 : 0 }); }
    },
    act(ctx) { if (m.done) return false; if (ctx.car) return false; if (s.d < 4.2) return true; return false; },
    view() {
      const w = clamp(1 - s.d / 45, 0, 1);
      return { label: `Find ${kind.name}`, sub: s.clock < 3 ? kind.clue : 'Warmer means closer. Walk slowly; look around.', meters: [{ k: 'warmth', label: band(s.d), v: w, warn: false, hot: w > 0.7 }], steps: [] };
    },
    targets() { return [{ kind: spec.what || 'cat', x: tgt.x, z: tgt.z, d: s.d, found: s.found }]; },
    secret: tgt,
  });
  return m;
}

// ───────────────────────────── chase: catch the runaway ─────────────────────────────
function chaseMission(spec, env) {
  const rnd = mulberry32(subSeed(env.seed, 17));
  const kind = CHASE_KINDS[spec.what] || CHASE_KINDS.parrot;
  const rect = zoneRect(env, kind.zone);
  const p0 = standAt(env, spec.at);
  const start = freePoint(rnd, env, rect, p0.x, p0.z, 10);
  const day = clamp((env.day || 1) - 1, 0, 4);
  const base = kind.speed * (1 + day * 0.04);
  const limit = spec.limit || 85;
  const s = { x: start.x, z: start.z, vx: 0, vz: 0, burst: 0, nextBurst: 3 + rnd() * 2, clock: 0, tries: 0, flee: 0, spooked: false, heading: 0, rest: 0, dir: rnd() * 6.28 };
  const m = shell('chase', { ...spec, what: spec.what }, env, {
    get committed() { return s.clock > 1; },
    goal() { return m.done ? null : { x: s.x, z: s.z, place: null, live: true }; },
    update(ctx) {
      if (m.done) return;
      s.clock += ctx.dt;
      const px = ctx.car ? ctx.car.x : ctx.p.x;
      const pz = ctx.car ? ctx.car.z : ctx.p.z;
      const dx = s.x - px;
      const dz = s.z - pz;
      const d = Math.hypot(dx, dz) || 1e-6;
      // flee: away from Ori when he is near (with a sidestep so it curves instead of running dead straight), wander when he is far
      let wx; let wz; let sp;
      if (d < 11) {
        const side = ((Math.floor(s.clock / 1.7) % 2) ? 1 : -1) * 0.55;
        wx = dx / d - (dz / d) * side; wz = dz / d + (dx / d) * side;
        sp = base * (d < 4 ? 1.12 : 1);
        s.nextBurst -= ctx.dt;
        if (s.nextBurst <= 0) { s.burst = 1.3; s.nextBurst = 3.5 + rnd() * 2.5; }
        s.spooked = true;
      } else {
        s.dir += (rnd() - 0.5) * 1.6 * ctx.dt;
        wx = Math.sin(s.dir); wz = Math.cos(s.dir);
        sp = base * 0.35;
      }
      if (s.burst > 0) { s.burst -= ctx.dt; sp *= kind.burst; }
      const l = Math.hypot(wx, wz) || 1;
      // it stays in its zone: near the edge (or outside it) it is pulled back towards the middle
      let ax = wx / l; let az = wz / l;
      const into = Math.max(rect.x0 + 6 - s.x, s.x - (rect.x1 - 6), rect.z0 + 6 - s.z, s.z - (rect.z1 - 6), 0);
      if (into > 0) { const pull = Math.min(1, into / 7); const cx = (rect.x0 + rect.x1) / 2 - s.x; const cz = (rect.z0 + rect.z1) / 2 - s.z; const cl = Math.hypot(cx, cz) || 1; ax = ax * (1 - pull) + (cx / cl) * pull; az = az * (1 - pull) + (cz / cl) * pull; }
      // walls: sample ahead; if blocked, turn towards the freer side (this is how it gets cornered)
      for (let k = 0; k < 7 && env.blocked(s.x + ax * 1.6, s.z + az * 1.6, 0.35); k++) { const a = Math.atan2(ax, az) + (k % 2 ? -1 : 1) * 0.45 * Math.ceil((k + 1) / 2); ax = Math.sin(a); az = Math.cos(a); }
      s.vx += (ax * sp - s.vx) * Math.min(1, 7 * ctx.dt);
      s.vz += (az * sp - s.vz) * Math.min(1, 7 * ctx.dt);
      let nx = s.x + s.vx * ctx.dt;
      let nz = s.z + s.vz * ctx.dt;
      if (env.blocked(nx, nz, 0.3)) { s.vx *= -0.2; s.vz *= -0.2; nx = s.x; nz = s.z; s.dir += 2.4; }
      s.x = nx; s.z = nz;
      s.heading = Math.atan2(s.vx, s.vz);
      if (d < 1.35 || (ctx.car && d < 2.6)) { m.emit({ type: 'stage', id: 'caught', say: kind.caught }); m.finish(clamp(1 - Math.max(0, s.clock - 25) / 120, 0.5, 1), { tip: s.clock < 25 ? 8 : 0 }); }
      else if (s.clock > limit) { s.clock = 0; s.tries++; const r = freePoint(rnd, env, rect, px, pz, 18); s.x = r.x; s.z = r.z; s.vx = s.vz = 0; m.emit({ type: 'hint', say: 'chase-again' }); }
    },
    view() { return { label: `Catch ${kind.name}`, sub: s.spooked ? 'Sprint! Corner it against a wall. (Coffee helps.)' : `It is somewhere in the ${kind.zone === 'park' ? 'park' : 'area'}. Walk up quietly...`, meters: [{ k: 'time', label: 'Time', v: clamp(1 - s.clock / limit, 0, 1), warn: s.clock > limit * 0.8 }], steps: [] }; },
    targets() { return [{ kind: spec.what || 'parrot', x: s.x, z: s.z, heading: s.heading, moving: Math.hypot(s.vx, s.vz) > 1, burst: s.burst > 0 }]; },
    state: s,
  });
  return m;
}

// ───────────────────────────── list: a shopping list over several shops ─────────────────────────────
function listMission(spec, env) {
  const rnd = mulberry32(subSeed(env.seed, 19));
  const list = LISTS[spec.list] || LISTS.milk;
  const items = list.items.map((it) => ({ name: it.name, shops: it.shops.slice(), shop: it.shops[0], got: false, soldOut: false }));
  // one item is sold out at its first shop (when it has an alternative): the detour
  const alts = items.filter((it) => it.shops.length > 1);
  const twist = alts.length ? alts[Math.floor(rnd() * alts.length)] : null;
  const to = spec.at;
  const par = spec.par || 150;
  const s = { clock: 0, stage: 'shops', revealed: false };
  const open = () => items.filter((i) => !i.got);
  const place = (id) => env.places[id];
  const nearestShop = (px, pz) => {
    let best = null; let bd = Infinity;
    for (const it of open()) { const d0 = standAt(env, it.shop); const d = dist(px, pz, d0.x, d0.z); if (d < bd) { bd = d; best = it.shop; } }
    return best;
  };
  let lastPos = standAt(env, 'home');
  const m = shell('list', spec, env, {
    get committed() { return items.some((i) => i.got); },
    goal() {
      if (m.done) return null;
      if (s.stage === 'back') return { ...standAt(env, to), place: to };
      const id = nearestShop(lastPos.x, lastPos.z);
      return id ? { ...standAt(env, id), place: id } : null;
    },
    update(ctx) {
      if (m.done) return;
      s.clock += ctx.dt;
      lastPos = ctx.car ? { x: ctx.car.x, z: ctx.car.z } : { x: ctx.p.x, z: ctx.p.z };
      if (s.stage === 'shops') {
        for (const id of new Set(open().map((i) => i.shop))) {
          if (!arrived(ctx, standAt(env, id), { auto: true })) continue;
          const here = open().filter((i) => i.shop === id);
          const gone = [];
          for (const it of here) {
            if (it === twist && !s.revealed && id === it.shops[0]) { s.revealed = true; it.soldOut = true; it.shop = it.shops[1]; gone.push(it); continue; }
            it.got = true;
            m.emit({ type: 'item', name: it.name, place: id });
          }
          if (gone.length) m.emit({ type: 'stage', id: 'soldout', say: `${gone[0].name} is sold out here! Try ${place(gone[0].shop).name}.` });
          else if (here.length) m.emit({ type: 'stage', id: 'shop', say: `Got ${here.map((i) => i.name).join(' and ')}.` });
        }
        if (!open().length) { s.stage = 'back'; m.emit({ type: 'stage', id: 'back', say: `All of it! Back to ${place(to).name}.` }); }
      } else if (arrived(ctx, standAt(env, to), { auto: true })) {
        const q = clamp(1 - Math.max(0, s.clock - par) / (par * 1.2), 0.55, 1);
        m.emit({ type: 'stage', id: 'delivered', say: 'Everything on the list. Wonderful.' });
        m.finish(q, { tip: s.clock < par * 0.75 ? 10 : 0 });
      }
    },
    view() {
      return {
        label: s.stage === 'back' ? `Bring it to ${place(to).name}` : `Shopping: ${open().length} to go`, sub: s.stage === 'back' ? 'Everything is in the bag.' : 'Any order. The glowing shop is the closest one.',
        meters: [], steps: items.map((i) => ({ label: `${i.name} (${place(i.shop).name})${i.soldOut ? ' - sold out, try next door' : ''}`, done: i.got })),
      };
    },
    items,
  });
  return m;
}

// ───────────────────────────── race: Dov the courier ─────────────────────────────
function raceMission(spec, env) {
  if (spec.rivals) return fieldRaceMission(spec, env); // (a whole field on a track out of town)
  const loop = RACE.loop;
  const day = clamp((env.day || 1) - 1, 0, 4);
  const speed = (spec.rival || RACE.rival[day]) * (spec.scale || 1);
  const who = spec.who || 'Dov'; // (the Sababa Cup races somebody else, in his own car; the story's race is Dov's)
  const prize = spec.prize ?? 120;
  const consolation = spec.consolation ?? 35;
  // the rival's polyline and cumulative lengths
  const cum = [0];
  for (let i = 1; i < loop.length; i++) cum.push(cum[i - 1] + dist(loop[i][0], loop[i][1], loop[i - 1][0], loop[i - 1][1]));
  const total = cum[cum.length - 1];
  const rivalAt = (d) => {
    d = clamp(d, 0, total);
    let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
    const u = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    return { x: loop[i - 1][0] + (loop[i][0] - loop[i - 1][0]) * u, z: loop[i - 1][1] + (loop[i][1] - loop[i - 1][1]) * u, heading: Math.atan2(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1]) };
  };
  const s = { stage: 'grid', cp: 1, clock: 0, count: RACE.countdown, rival: 0, place: 0, finished: false, rivalDone: null };
  const start = { x: loop[0][0], z: loop[0][1] };
  const m = shell('race', spec, env, {
    get committed() { return s.stage === 'go' || s.stage === 'count'; },
    get locked() { return s.stage === 'count'; },
    goal() { if (m.done) return null; if (s.stage === 'grid') return { ...start, place: null }; const p = loop[Math.min(s.cp, loop.length - 1)]; return { x: p[0], z: p[1], place: null }; },
    update(ctx) {
      if (m.done) return;
      const car = ctx.car;
      if (s.stage === 'grid') {
        if (car && dist(car.x, car.z, start.x, start.z) < 9 && Math.abs(car.speed) < 5) { s.stage = 'count'; s.count = RACE.countdown; m.emit({ type: 'stage', id: 'count', say: `${who} grins. Ready?` }); }
        return;
      }
      if (s.stage === 'count') {
        const before = Math.ceil(s.count);
        s.count -= ctx.dt;
        if (Math.ceil(s.count) !== before && s.count > 0) m.emit({ type: 'count', n: Math.ceil(s.count) });
        if (s.count <= 0) { s.stage = 'go'; s.clock = 0; m.emit({ type: 'count', n: 0 }); }
        return;
      }
      s.clock += ctx.dt;
      s.rival = Math.min(total, s.rival + speed * ctx.dt);
      if (s.rival >= total && s.rivalDone == null) s.rivalDone = s.clock;
      if (car) {
        const p = loop[s.cp];
        if (dist(car.x, car.z, p[0], p[1]) < RACE.radius) {
          s.cp++;
          m.emit({ type: 'checkpoint', n: s.cp - 1, of: loop.length - 1 });
          if (s.cp >= loop.length) {
            const win = s.rivalDone == null || s.clock <= s.rivalDone;
            s.place = win ? 1 : 2;
            m.emit({ type: 'stage', id: win ? 'win' : 'lose', say: win ? `You beat ${who}! ${who === 'Dov' ? 'He is delighted.' : 'Well driven!'}` : `${who} wins by a whisker - a kind word and a coffee!` });
            m.finish(win ? 1 : 0.62, { tip: win ? prize : consolation, place: s.place, special: 'race' });
          }
        }
      }
    },
    view() {
      const total_ = loop.length - 1;
      const gap = s.stage === 'go' ? (s.rival - 0) : 0;
      void gap;
      return {
        label: s.stage === 'grid' ? `Race ${who}: line up at the start` : s.stage === 'count' ? `Get ready... ${Math.max(1, Math.ceil(s.count))}` : `Race ${who}! Checkpoint ${Math.min(s.cp, total_)} of ${total_}`,
        sub: s.stage === 'grid' ? 'Drive your own car to the glowing ring and stop.' : 'Pass every ring in order. Shift is the afterburner!',
        meters: s.stage === 'go' ? [{ k: 'race', label: 'Rival', v: clamp(s.rival / total, 0, 1), mine: clamp((cum[Math.min(s.cp - 1, cum.length - 1)] || 0) / total, 0, 1) }] : [],
        steps: [],
      };
    },
    targets() {
      const out = [];
      if (s.stage !== 'grid') out.push({ kind: 'rival', ...rivalAt(s.rival), name: who, car: spec.car }); else out.push({ kind: 'rival', ...rivalAt(0), name: who, car: spec.car });
      const p = loop[Math.min(s.cp, loop.length - 1)];
      if (!m.done) out.push({ kind: 'checkpoint', x: p[0], z: p[1], next: s.cp, r: RACE.radius });
      return out;
    },
    state: s,
    total,
  });
  return m;
}

// ───────────────────────────── field race: several cars on a track out of town ─────────────────────────────
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
export const ordinal = (n) => ORD[n] || `${n}th`;
const RIVAL_ACCEL = 11; // m/s² (the player's own car pulls away quicker, but a rival gets there)
const RIVAL_BRAKE = 22;
const RIVAL_LAT = 2.6; // m/s sideways when he changes his mind
/** A race with a whole field: spec = { track, laps, rivals: [{ who, speed, aLat, block, error, car }], prizes: [peaches by place], consolation, cup }. The player starts at the back of the grid and every car stands still until GO.
 * Each rival is a driver: he accelerates, carries a turn only as fast as his grip allows (aLat) and brakes for it, slips now and then (error), steers round the cones and the cars in front, and defends his line against a car right behind him (block).
 * He is quicker when the player is far ahead (never unbeatable: +10 % at most) and a touch slower when he is far ahead. A bump from the player costs him speed and moves him sideways (`shove`); the game keeps the cars apart (`cars`).
 * The place at the line is the number of rivals that finished before him + 1. */
function fieldRaceMission(spec, env) {
  const T = buildTrack(spec.track);
  const laps = spec.laps || T.laps;
  const total = T.total * laps;
  const field = spec.rivals;
  const nR = field.length;
  const cps = [];
  for (let l = 0; l < laps; l++) for (const c of T.cps) cps.push({ x: c.x, z: c.z, d: l * T.total + c.d });
  const backOf = (k) => GRID_GAP * (1 + Math.floor(k / 2));
  const slot = T.slot(nR);
  const start = { x: slot.x, z: slot.z };
  const pp0 = -backOf(nR);
  const ring = T.width / 2 + 2;
  const half = T.width / 2;
  const rnd = mulberry32(subSeed(env.seed || 1, 77));
  const R = field.map((r, i) => ({ ...r, i, d: -backOf(i), lane: i % 2 ? 3 : -3, lat: i % 2 ? 3 : -3, v: 0, finish: null, wob: i * 1.7, stun: 0, slip: 0, nextSlip: 5 + rnd() * 9, x: 0, z: 0, h: 0, aLat: r.aLat || 28, block: r.block ?? 0.4, error: r.error ?? 0.3 }));
  const place = (r) => { const q = T.offsetAt(r.d, r.lat); r.x = q.x; r.z = q.z; r.h = q.h; };
  R.forEach(place);
  const s = { stage: 'grid', cp: 0, clock: 0, count: RACE.countdown, place: 0, pp: pp0, rank: nR + 1, lap: 1 };
  const prizeOf = (pl) => spec.prizes[pl - 1] ?? spec.consolation ?? 10;
  const keep = (lat) => clamp(lat, -half + 2.2, half - 2.2);
  /** Where the player is on the track, counted in laps like the race (distance along and sideways), or null. */
  const along = (car) => { if (!car) return null; const q = T.nearest(car.x, car.z); return { d: q.d + T.total * Math.round((s.pp - q.d) / T.total), lat: q.lat }; };
  /** What is in this rival's way: the cars just ahead of (or beside) him and the obstacles near him, each with its sideways place and its radius. */
  const blockers = (r) => {
    const out = [];
    for (const o of R) { if (o === r || o.finish != null) continue; const ahead = o.d - r.d; if (ahead > -3 && ahead < 15) out.push({ lat: o.lat, r: 1 }); }
    const here = ((r.d % T.total) + T.total) % T.total;
    for (const h of T.hazards) { let ahead = (((h.d - here) % T.total) + T.total) % T.total; if (ahead > T.total / 2) ahead -= T.total; if (ahead > -6 && ahead < 24) out.push({ lat: h.lat, r: h.r }); } // (until it is well behind him: the car is 5 m long)
    return out;
  };
  const drive = (r, pl, dt) => {
    if (r.finish != null) { r.v *= Math.max(0, 1 - 1.4 * dt); r.d += r.v * dt; place(r); return; }
    // sideways first: into a lane with room round what is in the way (on the side he is already on: never across it), else, boxed in, he stays and queues; else he defends the line against a car right behind; else back to his own lane
    const bl = blockers(r);
    let target = r.lane; let rate = RIVAL_LAT; let queue = 1;
    if (bl.length) {
      const room = (lat) => Math.min(...bl.map((b) => Math.abs(b.lat - lat) - b.r));
      rate = 4.4;
      if (room(r.lane) < 1.5) {
        let best = null; let cost = 99;
        for (let c = -half + 1.8; c <= half - 1.8 + 1e-6; c += 0.4) {
          if (room(c) < 1.1) continue; // (no room there)
          // going round on the side he is on beats cutting across what is in his way (only when he is clear of it now)
          const cross = bl.some((x) => Math.abs(r.lat - x.lat) > x.r + 1.2 && (c - x.lat) * (r.lat - x.lat) < 0);
          const k = Math.abs(c - r.lat) + (cross ? 8 : 0);
          if (k < cost) { cost = k; best = c; }
        }
        if (best != null) target = best; else { target = r.lat; queue = 0.78; } // (boxed in: he lifts and follows)
      }
    } else if (pl && r.block > 0.25 && pl.d < r.d && r.d - pl.d < 18 && r.v > 8) target = keep(r.lane + (pl.lat - r.lane) * r.block);
    r.lat += clamp(target - r.lat, -rate * dt, rate * dt);
    // then the speed
    const gap = clamp((s.pp - r.d) / 120, -1, 1); // > 0: the player is ahead of him
    const rub = s.clock < 6 ? 0 : gap > 0 ? 0.1 * gap : 0.04 * gap;
    let want = r.speed * (1 + rub) * (1 + 0.025 * Math.sin(s.clock * 0.7 + r.wob)) * queue;
    if (r.slip > 0) { r.slip -= dt; want *= 0.7; } else if ((r.nextSlip -= dt) <= 0) { r.nextSlip = 6 + rnd() * 10; if (rnd() < r.error) r.slip = 0.9; }
    if (r.stun > 0) { r.stun -= dt; want *= 0.8; }
    want = Math.min(want, T.speedAt(r.d, r.aLat));
    r.v += clamp(want - r.v, -RIVAL_BRAKE * dt, RIVAL_ACCEL * dt);
    r.d += r.v * dt;
    place(r);
  };
  const m = shell('race', spec, env, {
    get committed() { return s.stage === 'go' || s.stage === 'count'; },
    get locked() { return s.stage === 'count'; },
    goal() { if (m.done) return null; if (s.stage === 'grid') return { ...start, place: null }; const c = cps[Math.min(s.cp, cps.length - 1)]; return { x: c.x, z: c.z, place: null }; },
    update(ctx) {
      if (m.done) return;
      const car = ctx.car;
      if (s.stage === 'grid') {
        if (car && dist(car.x, car.z, start.x, start.z) < 9 && Math.abs(car.speed) < 5) { s.stage = 'count'; s.count = RACE.countdown; m.emit({ type: 'stage', id: 'count', say: `${spec.cup || 'The race'}: ready?` }); }
        return;
      }
      if (s.stage === 'count') {
        const before = Math.ceil(s.count);
        s.count -= ctx.dt;
        if (Math.ceil(s.count) !== before && s.count > 0) m.emit({ type: 'count', n: Math.ceil(s.count) });
        if (s.count <= 0) { s.stage = 'go'; s.clock = 0; m.emit({ type: 'count', n: 0 }); }
        return;
      }
      s.clock += ctx.dt;
      const pl = along(car);
      for (const r of R) drive(r, pl, ctx.dt);
      if (car) {
        const c = cps[s.cp];
        if (c && dist(car.x, car.z, c.x, c.z) < ring) {
          s.cp++;
          const per = T.cps.length;
          if (s.cp % per === 0 && s.cp < cps.length) { s.lap = s.cp / per + 1; m.emit({ type: 'lap', lap: s.lap, of: laps, final: s.lap === laps }); }
        }
        const nxt = cps[Math.min(s.cp, cps.length - 1)];
        const base = s.cp > 0 ? cps[s.cp - 1].d : pp0;
        const span = Math.max(1, nxt.d - base);
        s.pp = s.cp >= cps.length ? total : base + clamp(span - dist(car.x, car.z, nxt.x, nxt.z), 0, span);
      }
      for (const r of R) if (r.finish == null && r.d >= total) r.finish = s.clock;
      s.rank = 1 + R.filter((r) => r.d > s.pp && r.finish == null).length + R.filter((r) => r.finish != null).length;
      if (s.cp >= cps.length) {
        const pos = 1 + R.filter((r) => r.finish != null).length;
        s.place = pos;
        const say = pos === 1 ? `You won ${spec.cup || 'the race'}!` : pos === 2 ? `Second of ${nR + 1}: so close!` : `${ordinal(pos)} of ${nR + 1}: well driven, and a coffee on the house.`;
        m.emit({ type: 'stage', id: pos === 1 ? 'win' : 'lose', say });
        const order = R.slice().sort((a, b) => (a.finish != null ? 0 : 1) - (b.finish != null ? 0 : 1) || (a.finish ?? 0) - (b.finish ?? 0) || b.d - a.d).map((r) => r.who);
        order.splice(pos - 1, 0, 'You');
        m.finish(pos === 1 ? 1 : pos <= 3 ? 0.85 : 0.65, { tip: prizeOf(pos), place: pos, field: nR + 1, special: 'race', board: order.map((w, i) => `${ordinal(i + 1)} ${w}`).join(' · ') });
      }
    },
    view() {
      const lead = Math.max(0, ...R.map((r) => r.d));
      const lap = Math.min(laps, Math.floor(Math.max(0, s.pp) / T.total) + 1);
      return {
        label: s.stage === 'grid' ? `${spec.cup || 'Race'}: roll up to the grid` : s.stage === 'count' ? `Get ready... ${Math.max(1, Math.ceil(s.count))}` : `${spec.cup || 'Race'}`,
        sub: s.stage === 'grid' ? 'Drive to the glowing ring at your place on the grid and stop.' : s.stage === 'count' ? 'The engines are held until GO.' : 'Stay on the road, mind the cones, oil and tyres. Shift is the afterburner!',
        meters: s.stage === 'go' ? [{ k: 'race', label: 'Leader', v: clamp(lead / total, 0, 1), mine: clamp(s.pp / total, 0, 1) }] : [],
        steps: [],
        race: s.stage === 'grid' ? null : { lap, laps, rank: s.rank, field: nR + 1, clock: s.stage === 'go' ? s.clock : 0, count: s.stage === 'count' ? Math.max(1, Math.ceil(s.count)) : 0, final: lap === laps },
      };
    },
    targets() {
      const out = R.map((r) => ({ kind: 'rival', x: r.x, z: r.z, heading: r.h, name: r.who, car: r.car }));
      if (!m.done && s.stage === 'grid') out.push({ kind: 'checkpoint', x: start.x, z: start.z, next: s.cp, r: ring }); // (a glowing ring only where he lines up; on the road he follows the road)
      return out;
    },
    /** The cars of the field, for the game to keep apart from the player's: [{ i, x, z, h, v }]. */
    cars() { return R.map((r) => ({ i: r.i, x: r.x, z: r.z, h: r.h, v: r.v })); },
    /** The player touched rival `i`: (nx, nz) = the unit vector from the rival to the player, `pen` = how deep, `closing` = how fast they met (m/s), `fromBehind` = the player hit him from behind. */
    shove(i, nx, nz, pen, closing, fromBehind) {
      const r = R[i];
      if (!r || r.finish != null) return;
      const lx = Math.cos(r.h); const lz = -Math.sin(r.h);
      r.lat = clamp(r.lat - (nx * lx + nz * lz) * pen * 0.7, -half + 1.4, half - 1.4);
      r.v = Math.max(0, r.v + (fromBehind ? 1 : -1) * Math.min(3.5, closing * 0.25));
      r.stun = 0.35;
    },
    state: s,
    total,
    field: R,
  });
  return m;
}

// ───────────────────────────── gauntlet: several verbs back to back ─────────────────────────────
function gauntletMission(spec, env) {
  const rounds = (GAUNTLET[spec.set || 'inspection'] || GAUNTLET.inspection).slice();
  const s = { i: 0, qs: [], asked: false };
  const m = shell('gauntlet', spec, env, {
    get committed() { return s.i > 0; },
    goal() { return m.done ? null : { ...standAt(env, spec.at), place: spec.at }; },
    view() { return { label: spec.doText || 'The inspection', sub: `Trial ${Math.min(s.i + 1, rounds.length)} of ${rounds.length}`, meters: [], steps: rounds.map((r, i) => ({ label: `${r.verb}`, done: i < s.i })) }; },
    act(ctx) {
      if (m.done || s.asked) return false;
      if (!arrived(ctx, standAt(env, spec.at))) return false;
      s.asked = true;
      const r = rounds[s.i];
      m.emit({ type: 'verb', kind: r.verb, tone: r.tone, params: r.params || {}, seed: subSeed(env.seed, 40 + s.i), round: s.i, rounds: rounds.length });
      return true;
    },
    verbDone(q) {
      s.asked = false;
      s.qs.push(q);
      s.i++;
      if (s.i >= rounds.length) m.finish(s.qs.reduce((a, v) => a + v, 0) / s.qs.length, { tip: 150 * (s.qs.reduce((a, v) => a + v, 0) / s.qs.length), special: 'inspection' });
      else m.emit({ type: 'stage', id: 'round', say: `Trial ${s.i} done. Next one!` });
    },
    verbCancelled() { s.asked = false; },
  });
  return m;
}

const BUILD = { verb: verbMission, delivery: deliveryMission, taxi: taxiMission, find: findMission, chase: chaseMission, list: listMission, race: raceMission, gauntlet: gauntletMission };

/**
 * @param {object} spec from specFor() (or a hail: { kind: 'taxi', from, at, mood, hail: true })
 * @param {{ places: object, zones: object, blocked: (x:number, z:number, r:number) => boolean, seed: number, day?: number }} env
 */
export function createMission(spec, env) {
  const build = BUILD[spec.kind];
  if (!build) throw new Error(`unknown mission kind ${spec.kind}`);
  return build(spec, env);
}

/** A random street hail: a passenger at `from` (a point on a sidewalk) who wants to go to `to` (a place), in a random mood. */
export function makeHail(rnd, env, near) {
  const moods = ['rushed', 'nervous', 'sightseer', 'chatty'];
  const mood = moods[Math.floor(rnd() * moods.length)];
  const ids = Object.keys(env.places).filter((k) => env.places[k].kind !== 'open' || k === 'park' || k === 'busstop');
  const sorted = ids.map((id) => ({ id, d: dist(env.places[id].door.x, env.places[id].door.z, near.x, near.z) })).filter((e) => e.d > 25).sort((a, b) => a.d - b.d);
  const dest = sorted.length ? sorted[Math.min(sorted.length - 1, 2 + Math.floor(rnd() * 5))].id : 'cafe';
  const start = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(rnd() * 2))].id : 'busstop';
  return { kind: 'taxi', mood, from: start, at: dest, hail: true, tipMax: 22 + Math.floor(rnd() * 12), via: 'park', title: 'A fare!' };
}

void WEEK;
